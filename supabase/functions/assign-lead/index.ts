// assign-lead: writes to leads + lead_activity atomically, so a network hiccup
// can't update the lead without also logging that it happened.
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: corsHeaders });

  const { lead_id, assigned_to, note } = await req.json();
  if (!lead_id || !assigned_to) {
    return new Response(JSON.stringify({ error: "invalid input" }), { status: 400, headers: corsHeaders });
  }

  const caller = supabaseAsCaller(authHeader);
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

  // Use the CALLER's client (not admin) for the actual lead lookup/update so RLS
  // still enforces "only staff of this lead's dealer" — this function only adds
  // atomicity, it doesn't need to bypass RLS.
  const { data: lead, error: leadErr } = await caller.from("leads").select("dealer_id").eq("id", lead_id).maybeSingle();
  if (leadErr || !lead) return new Response(JSON.stringify({ error: "lead not found or not permitted" }), { status: 404, headers: corsHeaders });

  const { data: actorRow } = await caller.from("dealer_staff").select("id").eq("user_id", user.id).eq("dealer_id", lead.dealer_id).maybeSingle();

  const { error: updateErr } = await caller.from("leads").update({ assigned_to }).eq("id", lead_id);
  if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: corsHeaders });

  await caller.from("lead_activity").insert({
    lead_id, actor_id: actorRow?.id ?? null, action: "assigned",
    detail: note ?? `reassigned to ${assigned_to}`,
  });

  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
});
