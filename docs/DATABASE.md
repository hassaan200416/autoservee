# Database

Source of truth: `supabase/migrations/` (`0001`–`0006`). Update this file when migrations change.

## Migrations

| File | Adds |
|------|------|
| `0001_init.sql` | Core tables + RLS helpers (`is_dealer_staff`, `is_dealer_owner`, `is_admin`) |
| `0002_simplify_staff_roles.sql` | Roles → `owner` \| `staff` only |
| `0003_storage_car_photos.sql` | Private `car-photos` bucket + storage RLS |
| `0004_notifications.sql` | `notifications` table; AI action `suggest_next_step` |
| `0005_ops_enrichment.sql` | Car fields, lead follow-up/notes, `admin_activity`, indexes |
| `0006_lock_inserts.sql` | Blocks authenticated inserts on `notifications` + `ai_usage_log` (service_role only) |

## Tables (Stage 1)

- `dealers` — business; `status`: pending \| approved \| suspended
- `dealer_staff` — auth user ↔ dealer; `role`: owner \| staff; `status`: invited \| active \| deactivated
- `staff_invites` — invite audit trail
- `cars`, `car_photos` — inventory (+ enrichment cols from 0005)
- `leads`, `lead_activity` — pipeline + history (`next_follow_up_at`, `notes`)
- `notifications` — in-app bell (inserts via edge functions / service role)
- `admin_users` — platform founders
- `admin_activity` — admin audit (approve/suspend)
- `ai_usage_log` — AI call metering (inserts via `ai-assist` only)

## ERD

```
erDiagram
  DEALERS ||--o{ DEALER_STAFF : employs
  DEALERS ||--o{ STAFF_INVITES : invites
  DEALERS ||--o{ CARS : lists
  DEALERS ||--o{ LEADS : has
  DEALERS ||--o{ NOTIFICATIONS : has
  CARS ||--o{ CAR_PHOTOS : has
  CARS ||--o{ LEADS : "interested in"
  LEADS ||--o{ LEAD_ACTIVITY : logs
  DEALER_STAFF ||--o{ LEADS : "assigned to"
  DEALER_STAFF ||--o{ NOTIFICATIONS : receives
```

## RLS notes

- Staff see their dealer’s data; owners manage staff/invites.
- Admins (`is_admin()`) can read platform-wide for the admin panel.
- `notifications` / `ai_usage_log`: **no** client inserts — edge functions use service role.
