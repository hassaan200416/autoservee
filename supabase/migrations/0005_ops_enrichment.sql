-- Richer inventory + lead follow-ups + notification types + admin audit.

alter table cars add column if not exists mileage int;
alter table cars add column if not exists color text;
alter table cars add column if not exists transmission text;
alter table cars add column if not exists fuel_type text;
alter table cars add column if not exists condition text;

alter table cars drop constraint if exists cars_transmission_check;
alter table cars add constraint cars_transmission_check
  check (transmission is null or transmission in ('manual', 'automatic'));

alter table cars drop constraint if exists cars_fuel_type_check;
alter table cars add constraint cars_fuel_type_check
  check (fuel_type is null or fuel_type in ('petrol', 'diesel', 'hybrid', 'electric', 'cng'));

alter table cars drop constraint if exists cars_condition_check;
alter table cars add constraint cars_condition_check
  check (condition is null or condition in ('excellent', 'good', 'fair'));

alter table leads add column if not exists next_follow_up_at timestamptz;
alter table leads add column if not exists notes text;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('lead_assigned', 'lead_created', 'follow_up_due', 'invite_accepted'));

create table if not exists admin_activity (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  action text not null,
  target_type text,
  target_id uuid,
  detail text,
  created_at timestamptz not null default now()
);

alter table admin_activity enable row level security;

create policy "admins read admin activity" on admin_activity
  for select using (is_admin());

create policy "admins insert admin activity" on admin_activity
  for insert with check (is_admin());

create index if not exists leads_next_follow_up_idx on leads (next_follow_up_at)
  where next_follow_up_at is not null and stage not in ('closed_won', 'closed_lost');

create index if not exists leads_assigned_to_idx on leads (assigned_to);
create index if not exists cars_dealer_status_idx on cars (dealer_id, status);
