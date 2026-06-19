import { config } from "dotenv"
import { expand } from "dotenv-expand"
import path from "path"
import { defineConfig } from "prisma/config"

// Load .env and .env.local explicitly relative to this file so that
// `prisma db push / migrate` work regardless of the cwd pnpm is invoked from.
for (const file of [".env", ".env.local"]) {
  expand(config({ path: path.resolve(__dirname, file), override: false }))
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
})
