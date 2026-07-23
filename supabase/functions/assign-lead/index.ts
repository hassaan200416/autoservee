import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: corsHeaders });

  const body = await req.json();
  const { lead_id, note } = body;
  // Allow null/empty string to unassign.
  const assigned_to = body.assigned_to === "" || body.assigned_to === undefined ? null : body.assigned_to;

  if (!lead_id) {
    return new Response(JSON.stringify({ error: "invalid input" }), { status: 400, headers: corsHeaders });
  }

  const caller = supabaseAsCaller(authHeader);
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

  const { data: lead, error: leadErr } = await caller.from("leads").select("dealer_id, customer_name").eq("id", lead_id).maybeSingle();
  if (leadErr || !lead) return new Response(JSON.stringify({ error: "lead not found or not permitted" }), { status: 404, headers: corsHeaders });

  const { data: actorRow } = await caller.from("dealer_staff").select("id").eq("user_id", user.id).eq("dealer_id", lead.dealer_id).maybeSingle();

  const { error: updateErr } = await caller.from("leads").update({ assigned_to }).eq("id", lead_id);
  if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: corsHeaders });

  await caller.from("lead_activity").insert({
    lead_id,
    actor_id: actorRow?.id ?? null,
    action: "assigned",
    detail: note ?? (assigned_to ? `reassigned` : "unassigned"),
  });

  if (assigned_to && assigned_to !== actorRow?.id) {
    const admin = supabaseAdmin();
    await admin.from("notifications").insert({
      dealer_id: lead.dealer_id,
      recipient_staff_id: assigned_to,
      type: "lead_assigned",
      lead_id,
      message: `You were assigned a new lead: ${lead.customer_name ?? "a customer"}`,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
});
