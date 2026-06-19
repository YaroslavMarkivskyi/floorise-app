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

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
