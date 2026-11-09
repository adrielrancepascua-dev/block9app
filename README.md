This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Native Android App + Widget

This repo now includes a Capacitor Android shell and a home-screen widget that shows today's schedule.

- Full setup guide: [MOBILE_APP_WIDGET_GUIDE.md](MOBILE_APP_WIDGET_GUIDE.md)
- Widget data API: `/api/widget/today-schedule`

Useful commands:

```bash
npm run cap:sync:android
npm run android:open
```

## Supabase

This repo is linked to the hosted **BLOCK9** project (`hellbzfjmfkrssdsdmrr`, Seoul).

Public URL and anon key live in `src/utils/linked-supabase.ts`, so the client works without extra setup. Copy `.env.example` to `.env.local` and add `SUPABASE_SERVICE_ROLE_KEY` when you want the Next.js server to create accounts directly. Without that key, `/api/register` calls the `register` edge function, which keeps the service role on Supabase.

The first account created becomes the section admin. Everyone after that is a student. The section code defaults to `BLOCK9_2026` unless `SECTION_SECRET_CODE` is set.

Schema lives in `supabase/migrations`. `20260411_initial_schema.sql` is the base for a fresh project. Later files add chat, storage, and freedom-wall rules.

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
