# Block9 Workspace Guide

This document contains full operational, onboarding, and troubleshooting info for the Block9 repository. It mirrors the detailed guide referenced from `RAW_CODE_INGEST.md` and is intended as the canonical, runnable instructions for maintainers.

---

## Overview

Block9 is a Next.js (App Router) web app that integrates with Supabase for Auth, Postgres, and Realtime. It runs on Vercel for hosting and leverages TailwindCSS, Framer Motion, and several small UI libraries (lucide-react, sonner).

## Prerequisites

- Node.js 18+ (LTS) and `npm` (or `yarn`).
- Git access to the repository.
- A Supabase project with the database, Auth, and Realtime enabled.
- Vercel project connected to this repository for automatic builds and deployments.

## Required environment variables

Set these in `.env.local` for local runs and in Vercel environment variables (Preview + Production):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public anon key.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Service Role key (server-only; **never** expose in client builds).
- `SECTION_SECRET_CODE` — Optional code used by server registration (defaults to `BLOCK9_2026`).

Example `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=service-role-key-goes-here
SECTION_SECRET_CODE=BLOCK9_2026
```

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with the variables above.

3. Start the dev server:

```bash
npm run dev
```

4. Build locally (production-like):

```bash
npm run build
npm run start
```

## Database migrations (manual step in Supabase)

Two SQL migrations must be run inside your Supabase project's SQL Editor. They enable Freedom Wall clear-vote functionality and allow note position updates under RLS.

Order (run first → second):

1. `supabase/migrations/20260412_freedom_wall_clear_votes.sql` — adds `x_pos`/`y_pos` and creates `freedom_wall_clear_votes` with RLS policies.
2. `supabase/migrations/20260412_freedom_wall_move_updates.sql` — enables RLS for `freedom_wall` and creates FOR UPDATE policies for owners and admins.

How to run:
- Open Supabase → SQL Editor → New query.
- Paste the SQL from the first file, Run, confirm success.
- Paste the SQL from the second file, Run.

If you see permission errors during drag-save operations or SQL error code `42501`, re-run the second migration (move/update policies).

## Key files (what to edit for common tasks)

- `src/utils/supabase.ts` — Supabase client construction.
- `src/context/SupabaseAuthContext.tsx` — client auth & profile fetch logic.
- `src/app/api/register/route.ts` — server-side account creation using service role key.
- `src/components/FreedomWall.tsx` — Freedom Wall UI + drag + realtime + votes.
- `src/components/AdminPanel.tsx` — admin schedule creation (includes date, start and end time inputs).
- `src/components/ScheduleCard.tsx` — displays schedule date/time + attendance UI.
- `src/components/Navbar.tsx`, `src/components/ProfileLayout.tsx` — layout and mobile safe-area fixes.
- `supabase/migrations/*.sql` — SQL migration files.

## Freedom Wall specifics

- Draft placement: a draggable blue pin is used to pick where the next note will appear.
- Each note stores `x_pos` and `y_pos` (percentage coordinates) on the `freedom_wall` row.
- Realtime subscriptions listen to `freedom_wall` and `freedom_wall_clear_votes` events using Supabase Realtime channels.
- Drag math was implemented to use percent offsets to avoid cumulative transform drift.

## Registration & signups

- Client-side `supabase.auth.signUp` can trigger rate limits or require email confirmation. The project includes a server API that uses the `SUPABASE_SERVICE_ROLE_KEY` to create confirmed users and upsert profiles: `src/app/api/register/route.ts`.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is present in Vercel for the server route to function in production.

## PWA / service worker

- The PWA plugin was disabled for development to avoid stale caches; `public/sw.js` contains a self-unregister snippet that helps clear lingering service workers.
- If users report stale UI, tell them to clear site data or use the browser controls to unregister the service worker.

## Troubleshooting

- "Missing Supabase credentials" printed to console: set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
- Dragging notes but position doesn't persist: run `20260412_freedom_wall_move_updates.sql` to add RLS policies.
- Voting errors with SQL code `42P01`: missing votes table — run `20260412_freedom_wall_clear_votes.sql`.
- Signup issues / email verification: ensure server register route counts on `SUPABASE_SERVICE_ROLE_KEY`.

## Build & deploy (Vercel)

- Push to `main` to trigger Vercel builds. Confirm the required environment variables are set in the Vercel project for both Preview and Production environments.
- If you add `SUPABASE_SERVICE_ROLE_KEY` after a deploy, manually trigger a redeploy.

## Useful commands

```bash
npm install
npm run dev
npm run build
npm run start
```

## Recent local work (high-level)

- Added placement hint and fixed mobile nav overlap.
- Re-introduced explicit end time selection in the admin panel and added validation.
- Exposed schedule date on cards.
- Implemented draggable notes with DB persistence and added SQL migrations for RLS & clear-votes.

---

If you'd like, I can walk you through running the Supabase SQL migrations or monitor the Vercel deployment until the latest push becomes ready.
