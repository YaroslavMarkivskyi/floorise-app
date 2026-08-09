import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { routes } from "@/lib/routes"
import {
  SILPO_OAUTH_COOKIE,
  exchangeCodeForToken,
  expiryFromResponse,
  getAuthServerMetadata,
  verifyState,
} from "@/lib/silpo-oauth"

function fail(request: Request): NextResponse {
  return NextResponse.redirect(new URL(`${routes.settings}?silpo=error`, request.url))
}

// GET /api/silpo/callback — finish the OAuth handshake: validate state, exchange
// the authorization code for tokens, and persist the SilpoConnection.
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL(routes.login, request.url))
  }
  const userId = session.user.id

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const returnedState = url.searchParams.get("state")
  if (url.searchParams.get("error") || !code || !returnedState) {
    return fail(request)
  }

  const cookieValue = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${SILPO_OAUTH_COOKIE}=`))
    ?.slice(SILPO_OAUTH_COOKIE.length + 1)

  const saved = verifyState(cookieValue ? decodeURIComponent(cookieValue) : undefined)
  if (!saved || saved.state !== returnedState) {
    return fail(request)
  }

  try {
    const metadata = await getAuthServerMetadata()
    const token = await exchangeCodeForToken(
      metadata,
      { clientId: saved.clientId, clientSecret: saved.clientSecret },
      code,
      saved.codeVerifier,
      saved.redirectUri,
    )

    const data = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: expiryFromResponse(token),
    }
    await db.silpoConnection.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })

    const response = NextResponse.redirect(
      new URL(`${routes.settings}?silpo=connected`, request.url),
    )
    response.cookies.delete(SILPO_OAUTH_COOKIE)
    return response
  } catch (err) {
    console.error("[silpo/callback]", err)
    return fail(request)
  }
}
