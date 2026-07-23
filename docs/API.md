# Edge function contracts

## approve-dealer
- Auth: admin only
- Input: `{ dealer_id: string, action: "approve" | "suspend" }`
- Output: `{ ok: true, dealer_id, status }`
- Errors: 401 unauthorized, 403 admins only, 500

## create-dealer
- Auth: admin only
- Input: `{ name, city, contact_phone?, owner_email, owner_full_name? }`
- Behavior: invites owner by email, inserts `dealers` (status `approved`) + `dealer_staff` (role `owner`, status `invited`)
- Output: `{ ok: true, dealer_id }`
- Errors: 400 invalid input, 401, 403 admins only, 500 (invite/DB failure; rolls back dealer if staff insert fails)

## invite-staff
- Auth: active dealer owner only
- Input: `{ dealer_id, email, role: "staff", full_name? }`
- Output: `{ ok: true }`
- Errors: 401, 403 owners only, 500

## check-dealer-status
- Auth: any logged-in user (called right after sign-in)
- Input: `{ app?: "admin" | "dealer" }` (uses bearer token)
- Output: `{ allowed: boolean, role?, dealer_id?, reason? }`

## assign-lead
- Auth: staff of the lead's dealer
- Input: `{ lead_id, assigned_to: string | null, note? }` — pass `null` or `""` to unassign
- Side effect: inserts `lead_activity`; if assigning to another staff member, inserts a `lead_assigned` notification
- Output: `{ ok: true }`

## dealer-stats
- Auth: staff of the dealer (query param `dealer_id`)
- Output: `{ leads_this_week, cars_available, leads_by_stage }`

## ai-assist
- Auth: staff of the lead's dealer
- Input: `{ lead_id, action: "summarize_notes" | "draft_followup" | "suggest_next_step" }`
- Output: `{ text }`
- Errors: 422 not_enough_history, 429 daily_limit_reached, 502 ai_unavailable
- Secret: `GROQ_API_KEY` (server-side only)
