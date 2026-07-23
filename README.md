# AutoServe — Stage 1

Dealer OS for used-car dealerships: inventory, leads, staff, and one AI assist — plus a thin admin panel to onboard dealers. Full architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What's built

- **Dealer web** (`:3000`) — inventory CRUD + photos, drag-and-drop lead board, staff invites/roster + salesperson metrics, home “today” view, notifications, AI assist (Groq)
- **Admin panel** (`:3001`) — overview stats, create dealer + invite owner, dealer detail; middleware requires `admin_users` row
- **Public pitch mock** — `/preview` on dealer-web (sample buyer browse; not live marketplace)
- **Backend** — Supabase schema + RLS (migrations through `0006`), edge functions (`create-dealer`, `approve-dealer`, `invite-staff`, `assign-lead`, `ai-assist`, `check-dealer-status`, `dealer-stats`)

## Prerequisites

1. **Node.js 20 LTS** — https://nodejs.org
2. **pnpm** — `npm install -g pnpm`
3. **Docker Desktop** — running before Supabase starts
4. **Supabase CLI** — `npm install -g supabase`
5. **Groq API key** — for `ai-assist` (`GROQ_API_KEY`). Not needed until you test AI.

## Setup

```bash
pnpm install
supabase start
supabase db reset
```

Copy env templates and fill from `supabase start` output:

```bash
cp apps/dealer-web/.env.example apps/dealer-web/.env.local
cp apps/admin-panel/.env.example apps/admin-panel/.env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=<API URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Edge function secrets (`supabase/.env`, git-ignored):

```
SUPABASE_URL=<API URL>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_ANON_KEY=<anon key>
GROQ_API_KEY=<your Groq key>
DEALER_APP_URL=http://localhost:3000
```

## Run

```bash
pnpm dev
# dealer-web → http://localhost:3000
# admin-panel → http://localhost:3001
```

Serve a function locally when testing:

```bash
supabase functions serve create-dealer --env-file supabase/.env
```

Studio: http://localhost:54323

## First admin

1. Studio → Authentication → create a user.
2. SQL Editor:

```sql
insert into admin_users (user_id, full_name)
values ('<auth-user-uuid>', 'Your Name');
```

## First dealer

Prefer **Admin → Dealers**: create dealer + invite owner (calls `create-dealer`). Owner accepts invite in dealer-web.

Or seed manually — see commented sample SQL in [`supabase/seed.sql`](supabase/seed.sql) (create auth users in Studio first; replace UUID placeholders).

## Deploy

- **Apps**: Vercel — two projects rooted at `apps/dealer-web` and `apps/admin-panel`. Set `NEXT_PUBLIC_SUPABASE_*` from your hosted project.
- **Backend**: `supabase link`, then push to `main` (CI deploys migrations + functions). Repo secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `GROQ_API_KEY`.
