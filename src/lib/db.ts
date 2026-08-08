import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

function createPrismaClient() {
  // Parse URL manually so we can enforce ssl rejectUnauthorized:false
  // without pg v8 overriding it from the sslmode query param.
  const url = new URL(process.env.DATABASE_URL!)
  const pool = new Pool({
    host: url.hostname,
    port: Number(url.port),
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

let _db: PrismaClient | undefined

function getDb(): PrismaClient {
  if (!_db) {
    _db = globalForPrisma.prisma ?? createPrismaClient()
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = _db
  }
  return _db
}

// Proxy defers real Prisma initialization until the first property access,
// so importing this module never throws on a missing DATABASE_URL (e.g.
// during Next.js "Collecting page data" at build time). All existing
// `db.xxx.yyy(...)` call sites keep working unchanged.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop as keyof PrismaClient)
  },
})
