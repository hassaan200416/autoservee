-- Lock down client inserts: only service_role (edge functions) may insert.
-- Authenticated users retain select/update where already granted.

drop policy if exists "system inserts notifications" on notifications;
drop policy if exists "system inserts ai usage" on ai_usage_log;

-- Explicit deny for authenticated role (service_role bypasses RLS).
create policy "no client insert notifications" on notifications
  for insert to authenticated
  with check (false);

create policy "no client insert ai usage" on ai_usage_log
  for insert to authenticated
  with check (false);
