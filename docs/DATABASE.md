# Database

Source of truth: `supabase/migrations/0001_init.sql`. This file is a plain-English
companion — update it in the same PR whenever a migration changes the schema.

## Tables (Stage 1)
- `dealers` — the business. `status`: pending → approved (by admin) or suspended.
- `dealer_staff` — links an auth user to a dealer with a role and status.
- `staff_invites` — invite emails sent by an owner; independent of dealer_staff so pending/expired invites are visible without a half-populated staff row.
- `cars`, `car_photos` — inventory.
- `leads`, `lead_activity` — the pipeline board and its full history.
- `admin_users` — you + your friend, added manually via SQL editor.
- `ai_usage_log` — every AI-assist call, for cost control and future billing.

## ERD
Paste into any mermaid live editor, or view via the mermaid VS Code extension:

```
erDiagram
  DEALERS ||--o{ DEALER_STAFF : employs
  DEALERS ||--o{ STAFF_INVITES : invites
  DEALERS ||--o{ CARS : lists
  DEALERS ||--o{ LEADS : has
  CARS ||--o{ CAR_PHOTOS : has
  CARS ||--o{ LEADS : "interested in"
  LEADS ||--o{ LEAD_ACTIVITY : logs
  DEALER_STAFF ||--o{ LEADS : "assigned to"
```
