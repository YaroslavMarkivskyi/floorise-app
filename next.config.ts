import type { NextConfig } from "next"

// Aiven uses a self-signed CA chain that Node.js rejects by default.
// Remove once you switch to Neon/Vercel Postgres or configure ssl.ca in db.ts.
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
}

const nextConfig: NextConfig = {}

export default nextConfig
