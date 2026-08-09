import "server-only"
import crypto from "node:crypto"
import { z } from "zod"

// ─── Constants ────────────────────────────────────────────────────────────────

/** Official Silpo MCP endpoint. */
export const SILPO_MCP_URL = "https://mcp.silpo.ua/mcp"

/** OAuth 2.1 authorization-server metadata document. */
const METADATA_URL = "https://mcp.silpo.ua/.well-known/oauth-authorization-server"

/** Name of the short-lived, signed, httpOnly cookie holding the PKCE state. */
export const SILPO_OAUTH_COOKIE = "silpo_oauth"

/** Cookie TTL for the in-flight OAuth handshake (~10 minutes). */
export const SILPO_OAUTH_COOKIE_MAX_AGE = 600

// ─── Types ──────────────────────────────────────────────────────────────────

const metadataSchema = z.object({
  issuer: z.string().optional(),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  registration_endpoint: z.string().url().optional(),
  scopes_supported: z.array(z.string()).optional(),
  code_challenge_methods_supported: z.array(z.string()).optional(),
})

export type SilpoAuthMetadata = z.infer<typeof metadataSchema>

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
})

export type SilpoTokenResponse = z.infer<typeof tokenResponseSchema>

const registrationResponseSchema = z.object({
  client_id: z.string(),
  client_secret: z.string().optional(),
})

/** Client credentials used across the connect → callback → refresh lifecycle. */
export interface SilpoClientCredentials {
  clientId: string
  clientSecret?: string
}

/** Payload persisted in the signed cookie between /connect and /callback. */
export interface SilpoOAuthState {
  state: string
  codeVerifier: string
  clientId: string
  clientSecret?: string
  redirectUri: string
}

// ─── Metadata discovery ───────────────────────────────────────────────────────

let cachedMetadata: SilpoAuthMetadata | null = null

export async function getAuthServerMetadata(): Promise<SilpoAuthMetadata> {
  if (cachedMetadata) return cachedMetadata
  const res = await fetch(METADATA_URL, { headers: { Accept: "application/json" } })
  if (!res.ok) {
    throw new Error(`Silpo OAuth metadata fetch failed: ${res.status}`)
  }
  cachedMetadata = metadataSchema.parse(await res.json())
  return cachedMetadata
}

// ─── PKCE ─────────────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest())
  return { verifier, challenge }
}

export function randomState(): string {
  return base64url(crypto.randomBytes(24))
}

// ─── Signed cookie (HMAC over AUTH_SECRET) ────────────────────────────────────

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is required to sign the Silpo OAuth cookie")
  return secret
}

export function signState(payload: SilpoOAuthState): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf8"))
  const sig = base64url(crypto.createHmac("sha256", signingSecret()).update(body).digest())
  return `${body}.${sig}`
}

export function verifyState(cookieValue: string | undefined): SilpoOAuthState | null {
  if (!cookieValue) return null
  const [body, sig] = cookieValue.split(".")
  if (!body || !sig) return null
  const expected = base64url(crypto.createHmac("sha256", signingSecret()).update(body).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    return JSON.parse(Buffer.from(body, "base64").toString("utf8")) as SilpoOAuthState
  } catch {
    return null
  }
}

// ─── Client credentials: static env or Dynamic Client Registration ────────────

/**
 * Resolve OAuth client credentials. Prefers static env vars supplied by the
 * Silpo hackathon starter kit; falls back to Dynamic Client Registration so
 * development is not blocked before those values exist.
 */
export async function resolveClientCredentials(
  metadata: SilpoAuthMetadata,
  redirectUri: string,
): Promise<SilpoClientCredentials> {
  const envClientId = process.env.SILPO_MCP_CLIENT_ID
  if (envClientId) {
    return { clientId: envClientId, clientSecret: process.env.SILPO_MCP_CLIENT_SECRET }
  }

  if (!metadata.registration_endpoint) {
    throw new Error(
      "SILPO_MCP_CLIENT_ID is not set and the server does not advertise Dynamic Client Registration",
    )
  }

  const res = await fetch(metadata.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Floorise",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  })
  if (!res.ok) {
    throw new Error(`Silpo Dynamic Client Registration failed: ${res.status}`)
  }
  const parsed = registrationResponseSchema.parse(await res.json())
  return { clientId: parsed.client_id, clientSecret: parsed.client_secret }
}

/**
 * Client credentials usable for a token refresh performed outside the OAuth
 * handshake (no cookie available). Requires the static env client id.
 */
export function refreshClientCredentials(): SilpoClientCredentials | null {
  const clientId = process.env.SILPO_MCP_CLIENT_ID
  if (!clientId) return null
  return { clientId, clientSecret: process.env.SILPO_MCP_CLIENT_SECRET }
}

// ─── Token endpoint calls ─────────────────────────────────────────────────────

async function postToken(
  metadata: SilpoAuthMetadata,
  creds: SilpoClientCredentials,
  params: Record<string, string>,
): Promise<SilpoTokenResponse> {
  const body = new URLSearchParams({ ...params, client_id: creds.clientId })
  if (creds.clientSecret) body.set("client_secret", creds.clientSecret)

  const res = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Silpo token endpoint ${res.status}: ${text}`)
  }
  return tokenResponseSchema.parse(await res.json())
}

export async function exchangeCodeForToken(
  metadata: SilpoAuthMetadata,
  creds: SilpoClientCredentials,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<SilpoTokenResponse> {
  return postToken(metadata, creds, {
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  })
}

export async function refreshAccessToken(
  metadata: SilpoAuthMetadata,
  creds: SilpoClientCredentials,
  refreshToken: string,
): Promise<SilpoTokenResponse> {
  return postToken(metadata, creds, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
}

/** Convert a token response into an absolute expiry, defaulting to 1h. */
export function expiryFromResponse(token: SilpoTokenResponse): Date {
  const seconds = token.expires_in ?? 3600
  return new Date(Date.now() + seconds * 1000)
}

// ─── Authorization URL ────────────────────────────────────────────────────────

export function buildAuthorizationUrl(
  metadata: SilpoAuthMetadata,
  creds: SilpoClientCredentials,
  args: { state: string; codeChallenge: string; redirectUri: string },
): string {
  const url = new URL(metadata.authorization_endpoint)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", creds.clientId)
  url.searchParams.set("redirect_uri", args.redirectUri)
  url.searchParams.set("state", args.state)
  url.searchParams.set("code_challenge", args.codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")
  if (metadata.scopes_supported?.length) {
    url.searchParams.set("scope", metadata.scopes_supported.join(" "))
  }
  return url.toString()
}
