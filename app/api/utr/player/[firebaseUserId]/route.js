import { NextResponse } from 'next/server'
import { db as firestore } from '@/app/services/initializeFirebase' // Corrected: import db and alias as firestore
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

// Helper function to refresh UTR token
async function refreshUtrToken(firebaseUserId, currentRefreshToken) {
  const clientId = process.env.UTR_ENGAGE_CLIENT_ID
  const clientSecret = process.env.UTR_ENGAGE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error(
      'UTR Engage Client ID or Secret not configured for token refresh.'
    )
    throw new Error('Server configuration error for token refresh.')
  }

  const response = await fetch(
    'https://prod-utr-engage-api-data-azapp.azurewebsites.net/api/v1/oauth/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: currentRefreshToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    console.error(
      'Failed to refresh UTR token:',
      errorData,
      'Status:',
      response.status
    )
    // If refresh fails (e.g. invalid refresh token), the user might need to re-authenticate.
    // Consider deleting the invalid token from Firestore or marking it as such.
    if (response.status === 400 || response.status === 401) {
      // Bad request or Unauthorized
      const tokenDocRef = doc(firestore, 'utrTokens', firebaseUserId)
      await updateDoc(tokenDocRef, {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        error: 'refresh_failed',
        updatedAt: serverTimestamp()
      })
      console.log(
        `Invalidated tokens for user ${firebaseUserId} due to refresh failure.`
      )
    }
    throw new Error('Failed to refresh UTR token')
  }

  const newTokens = await response.json()
  const tokenDocRef = doc(firestore, 'utrTokens', firebaseUserId)
  await updateDoc(tokenDocRef, {
    accessToken: newTokens.access_token,
    // UTR might return a new refresh token, or the old one might still be valid.
    // It's safer to store the new one if provided.
    refreshToken: newTokens.refresh_token || currentRefreshToken,
    expiresAt: Date.now() + newTokens.expires_in * 1000,
    scope: newTokens.scope, // Scope might change, update it.
    updatedAt: serverTimestamp(),
    error: null // Clear any previous error
  })
  console.log(
    'UTR token refreshed and updated in Firestore for user:',
    firebaseUserId
  )
  return newTokens.access_token
}

// API route to get UTR player data
export async function GET(request, { params }) {
  const { firebaseUserId } = params

  if (!firebaseUserId) {
    return NextResponse.json(
      { error: 'Firebase User ID is required' },
      { status: 400 }
    )
  }

  const tokenDocRef = doc(firestore, 'utrTokens', firebaseUserId)
  let accessToken

  try {
    const tokenDocSnap = await getDoc(tokenDocRef)

    if (!tokenDocSnap.exists()) {
      console.log('No UTR token found for user:', firebaseUserId)
      // User needs to link their UTR account.
      return NextResponse.json(
        {
          error: 'UTR account not linked for this user.',
          utrLinkRequired: true
        },
        { status: 404 }
      )
    }

    const tokenData = tokenDocSnap.data()
    const now = Date.now()

    // Check if token is expired or close to expiring (e.g., within 5 minutes)
    if (
      !tokenData.accessToken ||
      !tokenData.expiresAt ||
      tokenData.expiresAt < now + 5 * 60 * 1000
    ) {
      if (!tokenData.refreshToken) {
        console.log(
          'UTR access token expired/missing and no refresh token available for user:',
          firebaseUserId
        )
        return NextResponse.json(
          {
            error:
              'UTR token expired, and no refresh token. Please re-link account.',
            utrLinkRequired: true
          },
          { status: 401 }
        )
      }
      console.log(
        'UTR token expired or nearing expiry for user:',
        firebaseUserId,
        '. Refreshing...'
      )
      accessToken = await refreshUtrToken(
        firebaseUserId,
        tokenData.refreshToken
      )
    } else {
      accessToken = tokenData.accessToken
    }

    // Fetch UTR Player Ratings Data
    // UTR Engage API states memberId is required. We assume the memberId is the same as the firebaseUserId for now.
    // Or that the token itself is enough to identify the member if the token is scoped to a specific member.
    // The API documentation for /members/ratings isn't explicit on whether memberId path param is needed if using bearer token.
    // Assuming token is sufficient or memberId is firebaseUid for this context.
    const ratingsResponse = await fetch(
      `https://prod-utr-engage-api-data-azapp.azurewebsites.net/api/v1/members/ratings`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )

    if (!ratingsResponse.ok) {
      const errorData = await ratingsResponse.json()
      console.error(
        'Error fetching UTR ratings data:',
        errorData,
        'Status:',
        ratingsResponse.status
      )
      let errorMessage = 'Failed to fetch UTR ratings data.'
      if (ratingsResponse.status === 401)
        errorMessage =
          'UTR token is invalid or expired. Please re-link your account.'
      else if (ratingsResponse.status === 403)
        errorMessage = 'Forbidden. Ensure token has correct scopes.'
      return NextResponse.json(
        {
          error: errorMessage,
          details: errorData,
          utrLinkRequired: ratingsResponse.status === 401
        },
        { status: ratingsResponse.status }
      )
    }
    const ratingsData = await ratingsResponse.json()

    // Optionally, fetch UTR Player Profile Data if needed and you have 'profile' scope
    // const profileResponse = await fetch(`https://prod-utr-engage-api-data-azapp.azurewebsites.net/api/v1/members/profile`, {
    //     headers: {
    //         'Authorization': `Bearer ${accessToken}`,
    //     },
    // });
    // if (!profileResponse.ok) { /* ... error handling ... */ }
    // const profileData = await profileResponse.json();

    // Combine data as needed
    // const utrData = { ...ratingsData, ...profileData };
    const utrData = ratingsData // For now, just returning ratings

    return NextResponse.json(utrData)
  } catch (error) {
    console.error('Error in /api/utr/player/[firebaseUserId] route:', error)
    let status = 500
    let message = 'Internal Server Error fetching UTR data.'
    let utrLinkRequired = false

    if (
      error.message === 'Failed to refresh UTR token' ||
      error.message.includes('UTR token expired')
    ) {
      status = 401
      message = error.message
      utrLinkRequired = true
    }

    return NextResponse.json({ error: message, utrLinkRequired }, { status })
  }
}
