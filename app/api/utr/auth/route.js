import { NextResponse } from 'next/server'

// This route initiates the UTR Sports Engage API OAuth flow.
// It constructs the authorization URL and redirects the user to UTR Sports.

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  // The userId here is the player's firebaseUid from your application
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  const clientId = process.env.UTR_ENGAGE_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/utr/callback`
  // Scopes determine what data your application can access.
  // Common scopes: 'ratings', 'profile', 'results.read', 'results.write'
  // Request only the scopes you absolutely need.
  const scopes = 'ratings profile'

  if (!clientId || !process.env.NEXT_PUBLIC_BASE_URL) {
    console.error(
      'UTR Engage Client ID or Base URL is not configured in environment variables.'
    )
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { status: 500 }
    )
  }

  const utrAuthUrl = new URL(
    'https://prod-utr-engage-api-data-azapp.azurewebsites.net/api/v1/oauth/authorize'
  )
  utrAuthUrl.searchParams.append('client_id', clientId)
  utrAuthUrl.searchParams.append('redirect_uri', redirectUri)
  utrAuthUrl.searchParams.append('response_type', 'code') // Standard for OAuth Authorization Code flow
  utrAuthUrl.searchParams.append('scope', scopes)
  // 'third_party_user_id' is crucial. It's how UTR knows which user in your system this OAuth flow is for.
  // This ID will be returned to your callback, allowing you to associate the UTR tokens with this user.
  utrAuthUrl.searchParams.append('third_party_user_id', userId)
  // 'state' is recommended for security (CSRF protection) but optional.
  // If used, generate a random string, store it (e.g., in session/cookie), and verify it in the callback.
  // utrAuthUrl.searchParams.append('state', 'your_random_state_string');
  utrAuthUrl.searchParams.append('approval_prompt', 'auto') // 'force' to always show prompt, 'auto' if already approved.

  return NextResponse.redirect(utrAuthUrl.toString())
}
