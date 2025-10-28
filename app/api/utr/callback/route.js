import { NextResponse } from 'next/server'
import { db as firestore } from '@/app/services/initializeFirebase' // Corrected: import db and alias as firestore
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

// This route handles the callback from UTR Sports after user authorization.
// It exchanges the authorization code for an access token and stores it in Firestore.

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  // This is the third_party_user_id you sent in the auth request, which should be your player's firebaseUid.
  const thirdPartyUserId = searchParams.get('third_party_user_id')
  // const state = searchParams.get('state'); // If you used 'state' in the auth request, verify it here.

  if (!code || !thirdPartyUserId) {
    let errorMsg = 'Missing required parameters in callback: '
    if (!code) errorMsg += 'code is missing. '
    if (!thirdPartyUserId) errorMsg += 'third_party_user_id is missing. '
    console.error(errorMsg, searchParams.toString())
    return NextResponse.json({ error: errorMsg.trim() }, { status: 400 })
  }

  const clientId = process.env.UTR_ENGAGE_CLIENT_ID
  const clientSecret = process.env.UTR_ENGAGE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/utr/callback`

  if (!clientId || !clientSecret || !process.env.NEXT_PUBLIC_BASE_URL) {
    console.error(
      'UTR Engage Client ID, Client Secret, or Base URL is not configured.'
    )
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { status: 500 }
    )
  }

  try {
    const tokenResponse = await fetch(
      'https://prod-utr-engage-api-data-azapp.azurewebsites.net/api/v1/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret
        })
      }
    )

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error(
        'UTR Token API Error:',
        errorData,
        'Status:',
        tokenResponse.status
      )
      return NextResponse.json(
        {
          error: 'Failed to exchange authorization code for token',
          details: errorData
        },
        { status: tokenResponse.status }
      )
    }

    const tokenData = await tokenResponse.json()
    // tokenData includes: access_token, refresh_token, expires_in, token_type, scope

    // Store the tokens in Firestore, associated with the third_party_user_id (player's firebaseUid)
    const tokenDocRef = doc(firestore, 'utrTokens', thirdPartyUserId)
    await setDoc(tokenDocRef, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000, // Corrected: Store expiry as a future timestamp from now
      scope: tokenData.scope,
      thirdPartyUserId, // Storing for clarity/querying if needed
      updatedAt: serverTimestamp() // This is fine for tracking update time
    })

    // Redirect user to their profile page or a success page
    // Adjust the redirect URL as needed
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/profile/${thirdPartyUserId}?utr_linked=true`
    )
  } catch (error) {
    console.error('Error in UTR callback:', error)
    return NextResponse.json(
      { error: 'Internal Server Error during UTR callback processing.' },
      { status: 500 }
    )
  }
}
