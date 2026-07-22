-- 0001_init.sql
-- Stage 1 schema: dealers, staff (owner-invites model), cars, leads, admin,
-- AI usage logging. See docs/ARCHITECTURE.md for the reasoning behind each choice.

create extension if not exists pgcrypto;

-- =========================================================
-- TABLES
-- =========================================================

create table dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  contact_phone text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_at timestamptz not null default now()
);

-- Links a Supabase auth user to a dealer, with a role.
-- Rows are created by the invite-staff edge function (owner invites directly,
-- no separate approval step for staff — see docs/ARCHITECTURE.md section 4).
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
create table staff_invites (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'salesperson')),
  invited_by uuid not null references dealer_staff(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  dealer_staff_id uuid references dealer_staff(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table cars (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  make text not null,
  model text not null,
  year int not null,
  price numeric(12,2) not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  specs jsonb default '{}',
  created_by uuid references dealer_staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table car_photos (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references cars(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

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

create table lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  actor_id uuid references dealer_staff(id),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- Platform admins (you + your friend). Added manually via SQL editor using the
-- service role — there is no self-signup path for admin accounts, ever.
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

-- Every AI-assist call, for cost tracking and daily rate limiting.
create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  staff_id uuid references dealer_staff(id),
  lead_id uuid references leads(id) on delete set null,
  action text not null check (action in ('summarize_notes', 'draft_followup')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- TRIGGERS
-- =========================================================

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

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table dealers enable row level security;
alter table dealer_staff enable row level security;
alter table staff_invites enable row level security;
alter table cars enable row level security;
alter table car_photos enable row level security;
alter table leads enable row level security;
alter table lead_activity enable row level security;
alter table admin_users enable row level security;
alter table ai_usage_log enable row level security;

-- Helper functions --------------------------------------------------------

create or replace function is_dealer_staff(target_dealer_id uuid) returns boolean as $$
  select exists (
    select 1 from dealer_staff
    where dealer_id = target_dealer_id and user_id = auth.uid() and status = 'active'
  );
$$ language sql security definer stable;

create or replace function is_dealer_owner(target_dealer_id uuid) returns boolean as $$
  select exists (
    select 1 from dealer_staff
    where dealer_id = target_dealer_id and user_id = auth.uid() and role = 'owner' and status = 'active'
  );
$$ language sql security definer stable;

create or replace function is_admin() returns boolean as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$ language sql security definer stable;

-- Policies ------------------------------------------------------------------

-- dealers: staff can read their own dealer; only admins approve/suspend.
-- No insert policy here on purpose — new dealers are created by a
-- (not-yet-built) signup-dealer edge function using the service role,
-- which bypasses RLS entirely. See docs/API.md once that function exists.
create policy "staff read own dealer" on dealers
  for select using (is_dealer_staff(id) or is_admin());
create policy "admin manage dealers" on dealers
  for update using (is_admin()) with check (is_admin());

-- dealer_staff: any active staff can see their own dealer's roster;
-- only the owner (or admin) can add/update staff rows.
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

-- cars
create policy "staff manage own dealer cars" on cars
  for all using (is_dealer_staff(dealer_id) or is_admin())
  with check (is_dealer_staff(dealer_id) or is_admin());

-- car_photos: joins through cars to find the dealer
create policy "staff manage own dealer car photos" on car_photos
  for all using (
    is_admin() or exists (
      select 1 from cars where cars.id = car_photos.car_id and is_dealer_staff(cars.dealer_id)
    )
  )
  with check (
    is_admin() or exists (
      select 1 from cars where cars.id = car_photos.car_id and is_dealer_staff(cars.dealer_id)
    )
  );

-- leads
create policy "staff manage own dealer leads" on leads
  for all using (is_dealer_staff(dealer_id) or is_admin())
  with check (is_dealer_staff(dealer_id) or is_admin());

-- lead_activity: joins through leads to find the dealer
create policy "staff manage own dealer lead activity" on lead_activity
  for all using (
    is_admin() or exists (
      select 1 from leads where leads.id = lead_activity.lead_id and is_dealer_staff(leads.dealer_id)
    )
  )
  with check (
    is_admin() or exists (
      select 1 from leads where leads.id = lead_activity.lead_id and is_dealer_staff(leads.dealer_id)
    )
  );

-- admin_users: only admins can see who else is an admin
create policy "admins see admins" on admin_users
  for select using (is_admin());

-- ai_usage_log: staff can see their own dealer's usage; only the service role
-- (inside the ai-assist edge function) inserts rows
create policy "staff see own dealer ai usage" on ai_usage_log
  for select using (is_dealer_staff(dealer_id) or is_admin());
create policy "system inserts ai usage" on ai_usage_log
  for insert with check (true);
