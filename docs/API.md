# Edge function contracts

Fill this in as each function stabilizes. Template per function:

## approve-dealer
- Auth: admin only
- Input: `{ dealer_id: string, action: "approve" | "suspend" }`
- Output: `{ ok: true, dealer_id, status }`
- Errors: 401 unauthorized, 403 admins only, 500

## invite-staff
- Auth: active dealer owner only
- Input: `{ dealer_id, email, role: "manager" | "salesperson", full_name? }`
- Output: `{ ok: true }`
- Errors: 401, 403 owners only, 500

## check-dealer-status
- Auth: any logged-in user (called right after sign-in)
- Input: none (uses bearer token)
- Output: `{ allowed: boolean, role?, dealer_id?, reason? }`

## assign-lead
- Auth: staff of the lead's dealer
- Input: `{ lead_id, assigned_to, note? }`
- Output: `{ ok: true }`

## dealer-stats
- Auth: staff of the dealer (query param `dealer_id`)
- Output: `{ leads_this_week, cars_available, leads_by_stage }`

## ai-assist
- Auth: staff of the lead's dealer
- Input: `{ lead_id, action: "summarize_notes" | "draft_followup" }`
- Output: `{ text }`
- Errors: 422 not_enough_history, 429 daily_limit_reached, 502 ai_unavailable
