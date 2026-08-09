import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { routes } from "@/lib/routes"
import {
  SILPO_OAUTH_COOKIE,
  SILPO_OAUTH_COOKIE_MAX_AGE,
  buildAuthorizationUrl,
  generatePkce,
  getAuthServerMetadata,
  randomState,
  resolveClientCredentials,
  signState,
} from "@/lib/silpo-oauth"

// GET /api/silpo/connect — start the Silpo OAuth 2.1 + PKCE handshake for the
// currently logged-in floorise user.
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(routes.login, request.url))
  }

  const redirectUri = new URL("/api/silpo/callback", request.url).toString()

  try {
    const metadata = await getAuthServerMetadata()
    const creds = await resolveClientCredentials(metadata, redirectUri)
    const { verifier, challenge } = generatePkce()
    const state = randomState()

    const authUrl = buildAuthorizationUrl(metadata, creds, {
      state,
      codeChallenge: challenge,
      redirectUri,
    })

    const response = NextResponse.redirect(authUrl)
    response.cookies.set(
      SILPO_OAUTH_COOKIE,
      signState({
        state,
        codeVerifier: verifier,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        redirectUri,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SILPO_OAUTH_COOKIE_MAX_AGE,
      },
    )
    return response
  } catch (err) {
    console.error("[silpo/connect]", err)
    return NextResponse.redirect(new URL(`${routes.settings}?silpo=error`, request.url))
  }
}
