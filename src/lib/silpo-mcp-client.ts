import "server-only"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { db } from "@/lib/db"
import {
  SILPO_MCP_URL,
  expiryFromResponse,
  getAuthServerMetadata,
  refreshAccessToken,
  refreshClientCredentials,
} from "@/lib/silpo-oauth"
import type { SilpoConnection } from "@/generated/prisma/client"

/** Thrown when the user has no Silpo connection at all. */
export class SilpoNotConnectedError extends Error {
  constructor() {
    super("User has no Silpo connection")
    this.name = "SilpoNotConnectedError"
  }
}

function isUnauthorized(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\b401\b|invalid_token|unauthorized/i.test(msg)
}

async function getConnection(userId: string): Promise<SilpoConnection> {
  const conn = await db.silpoConnection.findUnique({ where: { userId } })
  if (!conn) throw new SilpoNotConnectedError()
  return conn
}

/**
 * Refresh the access token via the stored refresh_token, persist it, and return
 * the new access token. Requires SILPO_MCP_CLIENT_ID in env (the refresh happens
 * outside the OAuth handshake, so there is no cookie to read the client id from).
 */
async function refreshConnection(conn: SilpoConnection): Promise<string> {
  if (!conn.refreshToken) throw new Error("Silpo token expired and no refresh_token is stored")
  const creds = refreshClientCredentials()
  if (!creds) {
    throw new Error("SILPO_MCP_CLIENT_ID is required to refresh the Silpo token")
  }

  const metadata = await getAuthServerMetadata()
  const token = await refreshAccessToken(metadata, creds, conn.refreshToken)

  const updated = await db.silpoConnection.update({
    where: { userId: conn.userId },
    data: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? conn.refreshToken,
      expiresAt: expiryFromResponse(token),
    },
  })
  return updated.accessToken
}

async function withClient<T>(
  accessToken: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(SILPO_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const client = new Client({ name: "floorise", version: "1.0.0" })
  try {
    await client.connect(transport)
    return await fn(client)
  } finally {
    await client.close().catch(() => {})
  }
}

/**
 * Single entry point for invoking any of the official Silpo MCP tools on behalf
 * of a floorise user. Transparently refreshes an expired access token on a
 * `401 invalid_token` and retries the call exactly once.
 */
export async function callSilpoTool<T = unknown>(
  userId: string,
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const conn = await getConnection(userId)

  // Proactively refresh if the stored token is already past its expiry.
  let accessToken = conn.accessToken
  if (conn.expiresAt.getTime() <= Date.now()) {
    accessToken = await refreshConnection(conn)
  }

  const call = (token: string) =>
    withClient(token, (client) =>
      client.callTool({ name: toolName, arguments: args }),
    )

  try {
    return (await call(accessToken)) as T
  } catch (err) {
    if (!isUnauthorized(err)) throw err
    // Access token was rejected — refresh once and retry.
    const freshToken = await refreshConnection(conn)
    return (await call(freshToken)) as T
  }
}
