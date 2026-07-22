# AutoServe — Stage 1

Dealer web app + admin panel + one dealer-facing AI assistant feature. See `docs/ARCHITECTURE.md`
for the full reasoning behind every decision here — this README is just "how do I get it running."

## Prerequisites (install these first, in order)

1. **Node.js 20 LTS** — https://nodejs.org (check with `node -v`)
2. **pnpm** — `npm install -g pnpm` (check with `pnpm -v`)
3. **Docker Desktop** — https://www.docker.com/products/docker-desktop — required to run Supabase locally. Must be running (not just installed) before step 4 below.
4. **Supabase CLI** — `npm install -g supabase` (check with `supabase -v`)
5. **VS Code** — when you open this folder, VS Code will prompt you to install the recommended extensions (`.vscode/extensions.json`) — accept that prompt. It includes ESLint, Prettier, Tailwind CSS IntelliSense, and a Deno extension scoped only to `supabase/functions` (the rest of the repo stays on the Node TypeScript server — this is already configured in `.vscode/settings.json` so the two don't conflict).
6. **A free Supabase account** — https://supabase.com — for when you're ready to deploy, not needed for local dev.
7. **An xAI (Grok) API key** — for the AI assistant feature. Not needed until you test `ai-assist` — confirm the current model name in xAI's own docs before wiring this up; I used `grok-4` as a placeholder in `supabase/functions/ai-assist/index.ts` and you should verify that's still the correct current model string, since I can't confirm it live.

## First-time setup

```bash
# from the repo root
pnpm install

# start the full local Supabase stack (Postgres, Auth, Storage, Studio, Edge Functions) in Docker
supabase start
```

`supabase start` prints a block of local URLs and keys when it finishes. Keep that output visible — you need it in the next step.

```bash
# apply the schema + RLS policies to your local database
supabase db reset
```

Copy the env template into both apps and fill in the values `supabase start` printed:

```bash
cp apps/dealer-web/.env.example apps/dealer-web/.env.local
cp apps/admin-panel/.env.example apps/admin-panel/.env.local
```

Edit both `.env.local` files:
```
NEXT_PUBLIC_SUPABASE_URL=<the "API URL" from supabase start>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the "anon key" from supabase start>
```

For edge functions to run locally with secrets (needed once you test `invite-staff` or `ai-assist`), create `supabase/.env` (already git-ignored):
```
SUPABASE_URL=<API URL from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
SUPABASE_ANON_KEY=<anon key from supabase start>
XAI_API_KEY=<your xAI key>
```

## Running it

```bash
# both Next.js apps at once (dealer-web on :3000, admin-panel on :3001)
pnpm dev
```

```bash
# serve one edge function locally, in a separate terminal, to test it
supabase functions serve invite-staff --env-file supabase/.env
```

Supabase Studio (a local dashboard to browse tables, run SQL, see auth users) is at `http://localhost:54323` once `supabase start` is running — this is where you'll create your own first user and promote it to admin (see next section).

## Creating your first admin account (you + your friend)

There is no self-signup for admins, by design. Do this once, locally and then again in production:

1. In Supabase Studio → Authentication → add a user (yourself), or sign up through whatever auth UI you build.
2. In Studio → SQL Editor, run:
   ```sql
   insert into admin_users (user_id, full_name)
   values ('<the user id from step 1>', 'Your Name');
   ```
3. Repeat for your friend.

## Creating your first dealer (manual, until a signup-dealer function exists)

Stage 1 doesn't have a public dealer signup flow yet (flagged as a gap in `docs/ARCHITECTURE.md` — the RLS policy comments mention this). For now, create dealers directly in Studio's SQL Editor:
```sql
insert into dealers (name, city, contact_phone, status)
values ('Test Motors', 'Lahore', '03001234567', 'approved');
```
Then insert the first owner manually the same way you'd insert an admin, using that dealer's `id` and a real auth user's `id`. Once you're actually onboarding real dealers, this manual step is exactly what `approve-dealer` (admin function) is meant to replace — worth building a real "dealer signup request" flow before your first pilot dealer, not before.

## Deploying

- **Frontend**: connect this repo to Vercel as two separate projects — one rooted at `apps/dealer-web`, one at `apps/admin-panel`. Set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in each Vercel project's environment variables (from your real, hosted Supabase project — not local).
- **Backend**: `supabase link --project-ref <your-project-ref>` once, then push to `main` — `.github/workflows/deploy-backend.yml` handles migrations + function deploys automatically. Add these as GitHub repo secrets first (Settings → Secrets and variables → Actions): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `XAI_API_KEY`.

## What's scaffolded vs. what you still need to build

**Scaffolded (working skeleton):**
- Full DB schema + RLS (`supabase/migrations/0001_init.sql`)
- All 6 edge functions with real logic, not just stubs (`supabase/functions/`)
- Login pages with the two-step (Auth + check-dealer-status) flow, for both apps
- Route protection middleware, for both apps
- Shared types, shared Supabase client, shared UI package

**Not built yet (Stage 1 remaining work):**
- Inventory UI (add/edit car, upload photos)
- Lead pipeline board UI (the drag-between-columns view)
- Staff management UI (owner invites staff, sees roster)
- Admin dealer-approval UI
- AI assistant UI (buttons on a lead calling `ai-assist`)
- A real dealer-signup request flow (currently manual, see above)
