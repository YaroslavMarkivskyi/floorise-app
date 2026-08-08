This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database migrations

This project uses [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate). Production and Preview currently share a single database, so migrations are applied **only** on Production Vercel builds (`VERCEL_ENV=production`). The `build` script runs `prisma migrate deploy` before `next build` on Production; Preview/Development builds run only `prisma generate && next build`.

Workflow for a schema change:

1. Edit `prisma/schema.prisma`.
2. Create a migration locally:

   ```bash
   pnpm exec prisma migrate dev --name описание_изменения
   ```

3. Commit the generated `prisma/migrations` folder.
4. Push to `main`. The Production Vercel build applies any pending migrations automatically via `prisma migrate deploy`.

> The database was baselined manually (`prisma migrate resolve --applied 0_init`), so the initial `0_init` migration is already marked as applied on Production.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
