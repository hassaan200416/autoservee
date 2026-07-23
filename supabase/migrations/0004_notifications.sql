create table notifications (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references dealers(id) on delete cascade,
  recipient_staff_id uuid not null references dealer_staff(id) on delete cascade,
  type text not null check (type in ('lead_assigned')),
  lead_id uuid references leads(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "staff read own notifications" on notifications
  for select using (
    recipient_staff_id in (select id from dealer_staff where user_id = auth.uid())
    or is_admin()
  );

create policy "staff mark own notifications read" on notifications
  for update using (recipient_staff_id in (select id from dealer_staff where user_id = auth.uid()))
  with check (recipient_staff_id in (select id from dealer_staff where user_id = auth.uid()));

-- Only the assign-lead edge function inserts these, using the service role.
create policy "system inserts notifications" on notifications
  for insert with check (true);

-- Allow the new AI "suggest next step" action in usage logs.
alter table ai_usage_log drop constraint ai_usage_log_action_check;
alter table ai_usage_log add constraint ai_usage_log_action_check
  check (action in ('summarize_notes', 'draft_followup', 'suggest_next_step'));
