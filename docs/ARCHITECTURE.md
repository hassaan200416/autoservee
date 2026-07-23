# AutoServe — Stage 1 Architecture

Scope: **Dealer Web App + Admin Panel only, plus one dealer-facing AI assistant feature.** No customer app, no payments, no delivery, no WhatsApp automation. Those stay Stage 2/3 — designing them now would be guessing at requirements you don't have yet.

Stack: Next.js (TypeScript) frontends, Supabase (Postgres, Auth, Storage, Edge Functions) as the backend, **Groq** (`llama-3.3-70b-versatile`) for the AI assistant (called server-side only from the `ai-assist` Edge Function — never from the browser). Hosting: Vercel (frontend) + Supabase (backend). Design system: `design-system/autoserve/MASTER.md` (navy `#0F172A`, accent `#0369A1`, Plus Jakarta Sans, dense dashboard).

---

## 1. Repo structure

One monorepo, not separate repos. For a 2-person team, juggling multiple repos, versioning, and shared-type syncing costs more time than it saves. Split into separate repos later only if you bring on more engineers or need independent deploy pipelines.

```
autoserve/
├── apps/
│   ├── dealer-web/            # Next.js app — dealer staff use this
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/home|inventory|leads|staff/
│   │   │   ├── accept-invite/ | forgot-password/ | preview/
│   │   │   └── layout.tsx
│   │   ├── middleware.ts       # route protection + deactivated/suspended re-check
│   │   └── package.json
│   │
│   └── admin-panel/            # Next.js app — founders only
│       ├── app/
│       │   ├── (auth)/login/
│       │   ├── dealers/        # create, detail, approve/suspend
│       │   ├── overview/       # platform-wide stats + WoW leads
│       │   └── layout.tsx
│       └── package.json
│
├── packages/
│   ├── shared-types/            # TS domain types (Stage 1 hand-maintained)
│   ├── shared-ui/                # Button, Field, Card, Skeleton, ConfirmDialog, etc.
│   └── supabase-client/          # browser + server Supabase clients
│
├── design-system/autoserve/      # MASTER.md from ui-ux-pro-max
├── supabase/
│   ├── migrations/               # 0001_init … 0005_ops_enrichment
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── create-dealer/ | invite-staff/ | check-dealer-status/
│   │   ├── approve-dealer/ | assign-lead/ | dealer-stats/ | ai-assist/
│   ├── seed.sql                  # sample data for local dev
│   └── config.toml
│
├── docs/
│   ├── ARCHITECTURE.md           # this file, kept up to date
│   ├── DATABASE.md               # schema + ERD, regenerated when schema changes
│   ├── API.md                    # contract for every edge function (input/output/errors)
│   └── adr/                      # architecture decision records — one file per major decision
│       └── 0001-monorepo-vs-separate-repos.md
│
├── pnpm-workspace.yaml
├── turbo.json                    # if using Turborepo for build orchestration
└── README.md
```

Why this split matters: `packages/shared-types` and `packages/supabase-client` mean the dealer app and admin panel never define the database shape twice. If a column changes, you regenerate types once and both apps get type errors anywhere they're now wrong — that's the "secure and scalable" property doing real work, not just a buzzword.

---

## 2. Database schema

Written as actual SQL you'll put in `supabase/migrations/0001_init.sql`. Every table has `created_at`; RLS is described separately in section 3.

```sql
-- Dealers (the business, not a person)
create table dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  contact_phone text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_at timestamptz not null default now()
);

-- Links a Supabase auth user to a dealer, with a role.
-- Rows are created by the invite-staff edge function, not by self-signup —
-- the owner invites, there is no separate "approval" step for staff.
create table dealer_staff (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('owner', 'manager', 'salesperson')),
  status text not null default 'invited' check (status in ('invited', 'active', 'deactivated')),
  invited_by uuid references dealer_staff(id),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dealer_id, user_id)
);

-- Tracks invite emails sent, independent of whether the person has signed in yet.
-- Lets an owner see "pending invites" and resend/revoke, without touching auth.users directly.
create table staff_invites (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'salesperson')), -- owners aren't invited this way; only the first owner is created at dealer approval time
  invited_by uuid not null references dealer_staff(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  dealer_staff_id uuid references dealer_staff(id), -- filled in once the invite is accepted
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Cars
create table cars (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  make text not null,
  model text not null,
  year int not null,
  price numeric(12,2) not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  specs jsonb default '{}',        -- mileage, fuel type, color, etc — flexible, no schema migration needed to add a spec field
  created_by uuid references dealer_staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Car photos live in Supabase Storage; this just tracks metadata/order
create table car_photos (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars(id) on delete cascade,
  storage_path text not null,       -- e.g. "{dealer_id}/{car_id}/1.jpg"
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Leads (a person interested in a car)
create table leads (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  car_id uuid references cars(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  source text not null default 'other' check (source in ('pakwheels', 'walk_in', 'referral', 'phone', 'website', 'other')),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'test_drive_scheduled', 'negotiating', 'closed_won', 'closed_lost')),
  assigned_to uuid references dealer_staff(id),
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every stage change / note, for the "nothing disappears when staff leave" guarantee
create table lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  actor_id uuid references dealer_staff(id),
  action text not null,             -- 'stage_change', 'note', 'assigned'
  detail text,
  created_at timestamptz not null default now()
);

-- Platform admins (you + your friend)
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

-- Auto-update updated_at on cars/leads
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cars_updated_at before update on cars
  for each row execute function set_updated_at();
create trigger leads_updated_at before update on leads
  for each row execute function set_updated_at();
```

Notes / things you should question, not just accept:
- `specs jsonb` on `cars` is a deliberate tradeoff: flexible car attributes without a migration every time you add a field, at the cost of losing SQL-level type checking on that column. Fine for v1. Revisit if you need to query deep into specs often (e.g. "all cars with sunroof") — that's when a real column beats jsonb.
- `lead_activity` is what actually delivers your pitch line "nothing disappears when a salesman quits." Don't skip building this even though it's not in your original doc's wording — without it, the pipeline board is just a snapshot, not a history.

---

## 3. Row Level Security (RLS) — this is not optional

If you only remember one thing from this section: **RLS is enforced by Postgres itself, not by your app code.** Even if someone finds your API URL and calls it directly, bypassing your frontend entirely, the database refuses to return rows they shouldn't see. This is what "secure by default" actually means in Supabase — turn it on for every table, with no exceptions, from migration 0001.

```sql
alter table dealers enable row level security;
alter table dealer_staff enable row level security;
alter table cars enable row level security;
alter table car_photos enable row level security;
alter table leads enable row level security;
alter table lead_activity enable row level security;
alter table admin_users enable row level security;

-- Helper: is the current user staff at a given dealer?
create or replace function is_dealer_staff(target_dealer_id uuid) returns boolean as $$
  select exists (
    select 1 from dealer_staff
    where dealer_id = target_dealer_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Helper: is the current user a platform admin?
create or replace function is_admin() returns boolean as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$ language sql security definer stable;

-- Dealer staff can see/manage only their own dealer's cars
create policy "staff manage own dealer cars" on cars
  for all using (is_dealer_staff(dealer_id) or is_admin())
  with check (is_dealer_staff(dealer_id) or is_admin());

-- Same pattern for leads
create policy "staff manage own dealer leads" on leads
  for all using (is_dealer_staff(dealer_id) or is_admin())
  with check (is_dealer_staff(dealer_id) or is_admin());

-- Dealer row: staff can read their own dealer; only admins can approve/suspend
create policy "staff read own dealer" on dealers
  for select using (is_dealer_staff(id) or is_admin());
create policy "admin manage dealers" on dealers
  for update using (is_admin()) with check (is_admin());

-- admin_users table: only admins can see who else is an admin
create policy "admins see admins" on admin_users
  for select using (is_admin());

-- Helper: is the current user an owner at a given dealer? (only owners invite/manage staff)
create or replace function is_dealer_owner(target_dealer_id uuid) returns boolean as $$
  select exists (
    select 1 from dealer_staff
    where dealer_id = target_dealer_id and user_id = auth.uid() and role = 'owner' and status = 'active'
  );
$$ language sql security definer stable;

-- dealer_staff: any active staff at the dealer can see their colleagues; only the owner can insert/update/deactivate
create policy "staff read own dealer roster" on dealer_staff
  for select using (is_dealer_staff(dealer_id) or is_admin());
create policy "owner manages own dealer staff" on dealer_staff
  for insert with check (is_dealer_owner(dealer_id) or is_admin());
create policy "owner updates own dealer staff" on dealer_staff
  for update using (is_dealer_owner(dealer_id) or is_admin())
  with check (is_dealer_owner(dealer_id) or is_admin());

-- staff_invites: only the owner who runs the dealer can see/create invites for it
create policy "owner manages own invites" on staff_invites
  for all using (is_dealer_owner(dealer_id) or is_admin())
  with check (is_dealer_owner(dealer_id) or is_admin());
```

Apply the same `is_dealer_staff(dealer_id) or is_admin()` pattern to `car_photos` (join through `cars`) and `lead_activity` (join through `leads`). Every policy should follow this shape: **default deny, then explicitly allow by role** — never write a policy that starts permissive and tries to exclude cases.

**Roles (Stage 1 reality):** `owner` | `staff` only (migration `0002`). Older sections below that mention manager/salesperson are historical — do not implement three-tier roles unless you explicitly expand Stage 1.

**Why owners get a separate `is_dealer_owner` check, not just `is_dealer_staff`:** a staff member should never be able to add or remove other staff. Enforce this in RLS, not just by hiding the "invite staff" button in the UI for non-owners.

---

## 4. Auth & roles

- Supabase Auth handles login (start with email/password; phone OTP is a reasonable upgrade later given WhatsApp-culture users, but adds SMS provider cost — not zero-budget compatible yet).
- Role is **not** stored in a JWT claim you trust blindly — it's looked up from `dealer_staff` / `admin_users` on every request via the RLS functions above. This means revoking someone's access is instant (deactivate their `dealer_staff` row) rather than waiting for a token to expire.
- Three real-world roles to model in the dealer app UI (not just the DB): `owner` (sees everything, invites/manages staff), `manager` (sees all leads/cars, can't manage staff), `salesperson` (sees only leads assigned to them). Enforce this in RLS too, not just by hiding UI buttons — hiding a button is not security.

**Approval hierarchy, matching what you confirmed:** admin approves *dealers only*; a dealer's owner approves/creates *their own staff only*. Admin never touches an individual staff account, and a dealer owner can never approve another dealer. This is enforced two different ways because the two relationships aren't symmetric:
- Dealer approval: admin flips `dealers.status` from `pending` → `approved` (via the `approve-dealer` function). No self-service — a dealer can't approve itself.
- Staff onboarding: no approval step at all, by your choice — the owner *creates* the account directly via invite. There's nothing to approve because the owner already has full authority over who joins their own dealer.

**Staff invite flow (owner invites directly, no request/approval step):**
1. Owner fills in an invite form (email, role) in the dealer web app.
2. This calls the `invite-staff` edge function (never a direct client insert — inviting a user requires the Supabase service role to call `auth.admin.inviteUserByEmail`, which must never run in the browser).
3. The function checks the caller is an active owner of that dealer (`is_dealer_owner`), then: creates the `auth.users` row via Supabase's invite API (this sends the actual invite email with a magic link), inserts a `staff_invites` row (`status = 'pending'`), and inserts a `dealer_staff` row (`status = 'invited'`) using the `user_id` Supabase returns immediately — the person doesn't need to have clicked anything yet for the row to exist.
4. The invited person clicks the email link, sets a password, and lands in the dealer app already logged in. A database trigger on `auth.users` (on confirmed sign-in) flips their `dealer_staff.status` to `'active'` and the matching `staff_invites.status` to `'accepted'`.
5. Owner can see pending invites (and resend/revoke) in a simple staff list — this is why `staff_invites` is a separate table from `dealer_staff`, not just a status flag: it lets you show "invited 3 days ago, not yet accepted" without a confusing half-populated staff row.

Edge case worth deciding now, not later: if an invite expires (past `expires_at`, still `pending`), the owner has to send a new one — don't auto-extend silently, since an old unused invite link floating in someone's inbox for months is a minor security smell.

---

## 5. Storage

One bucket, `car-photos`, with path convention `{dealer_id}/{car_id}/{filename}`. Storage RLS policy: a dealer's staff can upload/read only under their own `{dealer_id}/` prefix; public (anon) read access is **not** granted yet — that only gets added in Stage 2 when there's a public catalog. Storing this as a policy now (even if unused) costs nothing and means Stage 2 doesn't need a security redesign, just a new `select` policy for anon.

---

## 6. Edge Functions — what actually needs one vs. what doesn't

Don't reach for an edge function by default. A plain insert/update through the Supabase client, protected by RLS, is enough for most of Stage 1. Use an edge function only when you need logic that shouldn't run on the client, or a privileged action:

| Function | Why it needs to be a function, not a direct client call |
|---|---|
| `approve-dealer` | Requires admin privilege check + writes an audit log entry — a client-side "just update the status field" call can't be trusted to also log who approved it correctly. |
| `assign-lead` | Writes to both `leads` and `lead_activity` atomically — do this in one function so a network hiccup can't update the lead but skip the log entry. |
| `dealer-stats` | Aggregation query (leads this week, conversion %, per-staff performance) — keep this off the client so you're not shipping raw row data just to compute a count in JS. |
| `invite-staff` | Must call `auth.admin.inviteUserByEmail`, which requires the service role key — this can never run in the browser. Also enforces "only an active owner can invite" server-side, not just via a hidden button. |
| `ai-assist` | Calls the Groq API with your `GROQ_API_KEY` — a secret that must never reach the client. See section 6c. |

Everything else (adding a car, moving a lead card between columns, adding a note) is a direct, RLS-protected client call. Fewer moving parts = fewer things to secure and debug.

---

## 6a. What Edge Functions are NOT for

**Login/sign-up does not go through an Edge Function.** Supabase Auth (`supabase.auth.signInWithPassword`, `signUp`, session refresh) is a managed service — call it directly from the frontend via the Supabase client SDK. Wrapping it in your own function adds latency and a failure point for zero security gain, and risks you accidentally reimplementing session handling worse than Supabase already does it.

The one legitimate auth-adjacent use of a function: a **post-login gate check** — e.g. "reject login if this staff member's dealer has been suspended," which is business logic Supabase Auth itself doesn't know about. That's a function that runs *after* Supabase confirms the password is correct, not a replacement for the login call itself.

```
Client: supabase.auth.signInWithPassword() → Supabase Auth verifies credentials, returns session
Client: calls check-dealer-status edge function with the new session → function checks dealer.status = 'approved', otherwise signs the user back out and returns an error
```

---

## 6c. AI assistant (dealer-facing, Groq API)

**What it does in v1** — deliberately narrow, not a general chatbot: given a lead, the assistant can (a) summarize the lead's activity history into one readable paragraph ("customer called about a 2019 Corolla, test drive done Tuesday, hesitant on price, said he's also checking a competitor"), and (b) draft a follow-up message the salesperson can review, edit, and send manually. It never sends anything itself — this stays a text-generation helper, not automated outreach, and doesn't touch WhatsApp (that's still Stage 3 territory, unchanged from before).

**Why scoped this narrow:** you said "AI would be impressive" — the honest version of that is: a vague AI feature that's slow, expensive, or wrong erodes trust faster than having no AI at all. A tightly-scoped, obviously-useful feature (turns messy notes into a clean summary a busy salesperson would actually read) is the version that's actually impressive to a dealer owner, versus a chatbot bolted on for demo value.

**Architecture:**
```
Dealer app: staff clicks "summarize" or "draft follow-up" on a lead
  → calls ai-assist edge function with { lead_id, action }
  → function verifies caller is staff at that lead's dealer (is_dealer_staff)
  → function fetches the lead + its lead_activity rows from Postgres (server-side, service role)
  → function calls the Groq API (Groq) with a system prompt + that data
  → returns generated text to the client
  → staff reviews it in the UI; nothing is saved or sent without them clicking again
```

```sql
-- Log every AI call: what it cost you, who used it, so cost never becomes a mystery
create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  staff_id uuid references dealer_staff(id),
  lead_id uuid references leads(id) on delete set null,
  action text not null check (action in ('summarize_notes', 'draft_followup')),
  created_at timestamptz not null default now()
);
alter table ai_usage_log enable row level security;
create policy "staff see own dealer ai usage" on ai_usage_log
  for select using (is_dealer_staff(dealer_id) or is_admin());
create policy "system inserts ai usage" on ai_usage_log
  for insert with check (true); -- only ever inserted by the edge function using the service role
```

**Cost control — this is the part I'm adding that you didn't ask for, and you should keep it:** Groq API calls cost real money per call, and this is the one part of your stack that isn't free. Without a cap, one dealer accidentally spamming the "summarize" button 200 times in an afternoon becomes your problem, not theirs, since you're paying for the API key. Two cheap safeguards:
- A simple per-dealer daily limit (e.g. 50 AI calls/day) checked in the `ai-assist` function against `ai_usage_log` counts before calling Groq — return a clear "daily AI limit reached" message rather than silently degrading.
- Keep prompts short (send only the specific lead's notes, not the dealer's whole history) — this is both cheaper per call and more accurate, since Groq isn't guessing which conversation you mean.

**What I'd explicitly ask you before building this, rather than assume:** is this a free feature bundled into every dealer's access, or something you'd eventually gate behind a paid tier? You don't have a revenue model yet (flagged back in the first conversation) — and "AI features" is usually the first thing that becomes a paid tier once you do have one. Doesn't need answering today, but the `ai_usage_log` table above is exactly what you'd need to bill against later, so building it now costs nothing and saves you a migration if you gate it later.

---

## 6b. Edge cases and failure handling

These are the scenarios that don't show up until real dealers are using this — designing for them now is cheap, retrofitting them later after data is already inconsistent is not.

**Concurrency / data races**
- Two staff edit the same lead at the same time → last write wins by default in Postgres. Acceptable for v1 (low concurrency, one dealer, few staff), but `lead_activity` gives you a trail to see it happened. Don't build optimistic-locking/conflict-resolution UI for v1 — it's real engineering effort solving a problem you don't have yet at this scale.
- A car marked `sold` while another staff member still has it open on their screen → the UI should re-fetch/refresh car status on any save attempt and reject stale updates with a clear "this car was already marked sold by X" message, not a silent overwrite.

**Referential / lifecycle edge cases**
- A salesperson is removed from `dealer_staff` while they still have leads `assigned_to` them → don't hard-delete the staff row (breaks the FK and orphans history); instead add a `deactivated_at` column and keep the row. Reassignment of their open leads becomes a manual admin action, not automatic — don't guess who should inherit them.
- A dealer is suspended by admin while their staff are actively logged in → the post-login gate check (6a) only fires on new logins. For an already-active session, add a lightweight status check on the dealer dashboard's main layout load (not every single request — that's wasteful) so a suspended dealer's staff see a clear "account suspended, contact support" state within one page load, not mid-action.
- A car is deleted while it has open leads pointing to it → don't allow hard delete from the UI while `leads.car_id` references exist; either block deletion with a clear message, or set `car_id` to null on the lead (already modeled as `on delete set null` in the schema) and surface "this lead's car is no longer listed" in the lead view.

**Input / upload failures**
- Photo upload to Storage fails partway (bad network, large file) → don't create the `car_photos` row until the Storage upload confirms success; show a retry option per photo rather than failing the whole car listing.
- Duplicate lead submitted twice (e.g. staff double-clicks "add lead") → add a simple client-side debounce on submit, and treat exact duplicates (same phone + same car within a short window) as a soft warning ("similar lead exists — add anyway?") rather than a hard block, since a genuine second inquiry from the same person is valid.

**Auth / access edge cases**
- Someone tries to query the API directly (bypassing the UI) for data outside their dealer → RLS denies it at the database level regardless of what the client sends; verify this by testing, don't just assume the policy is correct because you wrote it.
- A staff member is added to `dealer_staff` for a dealer that's still `pending` (not yet approved by admin) → they should be able to log in and prep data, but the `check-dealer-status` gate (6a) should distinguish `pending` (allow, read-only or full access per your call) from `suspended` (always block) — decide which behavior you want before building it, since both currently map to "not approved."

**Invite-flow edge cases**
- Owner invites an email that already has a `dealer_staff` row at a *different* dealer → allow it (people can plausibly work at more than one dealer over time), but the invite function should warn the owner in the response, not silently proceed as if it's a brand-new person.
- Owner re-invites the same email while a `pending` invite already exists → don't create a duplicate `staff_invites` row; update the existing one's `expires_at` and resend, so an owner mashing "invite" doesn't spam five emails at one address.
- Invited person never accepts, invite expires → a scheduled check (or just check at read-time) flips `status` to `'expired'`; the owner's staff list should visibly distinguish "invited," "expired," and "active" so this isn't invisible.

**AI-assistant edge cases**
- Groq API call times out or errors → return a clear failure to the UI ("AI assistant unavailable, try again") rather than a blank/broken state; do **not** silently fall back to fabricating a summary client-side.
- Lead has zero `lead_activity` rows yet (brand new lead) → the function should refuse with "not enough history to summarize yet" rather than asking Groq to invent content from nothing.
- Dealer hits their daily AI-call cap → this must be a normal, expected UI state ("come back tomorrow" / "contact us to raise your limit"), not treated as an error in your logs — it's a limit working as designed, not a bug.

**Empty / zero-state cases**
- New dealer with zero cars and zero leads → every dashboard view needs an explicit empty state ("no cars yet — add your first one"), not a blank screen that looks broken.
- Admin panel viewing platform stats before any dealer has real activity → aggregates (`dealer-stats`) should return zeros, not error out on empty tables — test this explicitly, it's a common function bug.

---

## 7. Security checklist (apply before first real dealer touches this)

- [ ] RLS enabled on every table, verified by trying to query as a non-privileged user and confirming empty/denied results
- [ ] Supabase **service role key** never shipped to any frontend bundle — only used inside edge functions
- [ ] All form inputs validated with `zod` (or similar) on the client **and** re-validated in edge functions — never trust client-side validation alone
- [ ] `.env.local` files git-ignored; secrets set via Vercel/Supabase dashboard env vars, not committed anywhere
- [ ] Admin panel requires `is_admin()` check on every route via middleware, not just on the login page
- [ ] Rate limiting on any publicly reachable edge function (Supabase's built-in limits are a start; revisit if abused)
- [ ] Every sensitive action (approve dealer, suspend dealer, delete car) writes to an activity/audit log

---

## 8. Documentation practice going forward

- `docs/DATABASE.md`: keep an ERD (mermaid `erDiagram` block is enough) and a plain-English description of each table, updated in the same PR as any migration.
- `docs/API.md`: for each edge function — input shape, output shape, error cases, who's allowed to call it.
- `docs/adr/`: one short markdown file per non-obvious decision (e.g. "why monorepo," "why Supabase over custom backend," "why website before app in Stage 2"). This matters more than it sounds — six months from now neither of you will remember *why* you chose something, and re-litigating settled decisions wastes time.
- Every migration file gets a one-line comment at the top explaining what it does and why.

---

## 9. Tech stack — explicit, so nothing is assumed

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 14 (App Router), TypeScript | Type safety end-to-end with `shared-types`; App Router fits the dashboard-style routing both apps need. |
| Styling / components | Tailwind CSS + shadcn/ui | Free, no design system to build from scratch, consistent look across dealer app and admin panel. |
| Data fetching | Supabase JS client directly, wrapped by `packages/supabase-client` | You don't need a separate API layer (Express/tRPC/etc.) — Supabase's client plus RLS *is* your API. Adding a custom backend on top would just be re-implementing what RLS already does, at a security and maintenance cost. |
| Validation | zod | Shared schemas between client-side form validation and edge-function input validation — write the shape once. |
| Database | Postgres via Supabase | Managed, free tier, RLS built in, generates TypeScript types from schema. |
| Auth | Supabase Auth | Managed sessions, invite-by-email built in (used directly by `invite-staff`), no custom password/session handling. |
| File storage | Supabase Storage | Same project, same auth context, RLS-compatible policies — no separate S3 setup needed at this scale. |
| Serverless functions | Supabase Edge Functions (Deno) | Only for privileged/multi-step logic (see section 6) — colocated with the DB, no separate hosting to manage. |
| AI | Groq API, called only from `ai-assist` edge function | Per your choice. Never called from the browser — that would expose your API key. |
| Frontend hosting | Vercel (free tier, 2 projects) | Native Next.js support, automatic preview deploys per PR, zero-config for this stack. |
| Monorepo tooling | pnpm workspaces + Turborepo | Shared types/UI across two apps without publishing packages; Turborepo caches builds so CI stays fast as the repo grows. |
| Testing | Vitest (unit) + Playwright (a handful of smoke e2e tests, not full coverage) | Full e2e coverage is disproportionate effort for a solo/small team pre-traction; a few critical-path tests (login, add car, move a lead) catch the failures that actually matter. |
| Error monitoring | Sentry (free tier) | Without this, a bug on a dealer's machine is invisible to you until they complain — free tier is enough at this scale and it's the difference between debugging blind and debugging with a stack trace. |
| CI/CD | GitHub Actions | Free for this repo size, integrates directly with Vercel and Supabase CLI — see section 10. |

**Two additions in this table I made without being asked — flagging both explicitly, as requested:**
- **Sentry.** You didn't ask for error monitoring, but building this without any visibility into production errors means your first signal of a bug is a dealer complaining, which is the worst possible way to find out. Free tier, ~15 minutes to wire up. Tell me to drop it if you'd rather keep the stack smaller.
- **Playwright smoke tests, not full test coverage.** I'm deliberately *not* recommending a large test suite right now — that's genuine over-engineering for a pre-traction MVP. A few tests on the paths that would be most embarrassing to break (login, adding a car, moving a lead through the pipeline) are worth the hour it takes; more than that is effort better spent validating the product with a real dealer.

---

## 10. CI/CD pipeline

Two independent flows: **frontend** deploys via Vercel's native Git integration (no custom pipeline needed — connect the repo, tell Vercel the app's subfolder, it builds and deploys on every push automatically, with preview URLs per PR). **Backend** (migrations + edge functions) needs an explicit GitHub Actions pipeline, because nothing deploys that for you automatically.

`.github/workflows/ci.yml` — runs on every PR, blocks merge on failure:
```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  lint-typecheck-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck
      - run: pnpm turbo build
      - run: pnpm turbo test   # vitest unit tests
```

`.github/workflows/deploy-backend.yml` — runs only on merge to `main`, deploys Supabase migrations and functions:
```yaml
name: Deploy backend
on:
  push:
    branches: [main]

jobs:
  supabase-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - name: Push database migrations
        run: supabase db push --project-ref $SUPABASE_PROJECT_REF
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
      - name: Deploy edge functions
        run: supabase functions deploy --project-ref $SUPABASE_PROJECT_REF
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
      - name: Set function secrets
        run: |
          supabase secrets set GROQ_API_KEY=${{ secrets.GROQ_API_KEY }} --project-ref $SUPABASE_PROJECT_REF
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Required GitHub repo secrets (Settings → Secrets → Actions): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `GROQ_API_KEY`. Vercel needs no secrets here — it manages its own env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) via its dashboard, set once per project.

**Deliberately not included yet:** a separate staging Supabase project wired into this pipeline. For a solo/small team pre-launch, testing migrations locally (`supabase db push` against your local Docker instance) before merging is enough discipline; add a true staging environment once you have a live dealer whose data you can't risk breaking with an untested migration.

---

## 11. Deployment & environments

- **Environments now**: local dev (Supabase CLI + Docker) → production, via the pipeline in section 10. A dedicated staging Supabase project is intentionally deferred (see section 10) until you have a live dealer whose data is too risky to test migrations against directly.
- **Frontend**: both apps deploy to Vercel free tier, connected to their folders in the monorepo (`apps/dealer-web`, `apps/admin-panel`) as separate Vercel projects, auto-deploying on push via Vercel's own Git integration.
- **Backend**: Supabase free tier (500MB DB, 1GB storage, included edge functions) — enough for a one-city pilot with a handful of dealers. Watch these limits as you add dealers; free tier is a pilot budget, not a permanent one.
- **The one paid line item that scales with usage**: Groq API calls. Everything else in this stack stays at $0 until you outgrow free tiers; Groq is metered from day one, which is exactly why section 6c has a hard daily cap per dealer.

---

## What this document deliberately does not cover

Payment/escrow architecture, delivery tracking, WhatsApp Business API integration, and customer-facing AI car-matching (the AI assistant in section 6c is dealer-facing only — matching buyers to cars is still a Stage 2 feature, since there's no customer app yet to use it). Building these now, before Stage 1 has a real dealer using it daily, means designing against guesses instead of what you actually learn from that dealer. Revisit this document — don't start a new one from scratch — once Stage 1 is proven.
