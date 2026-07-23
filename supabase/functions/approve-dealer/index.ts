import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: corsHeaders });
  }

  const { dealer_id, action } = await req.json(); // action: "approve" | "suspend"
  if (!dealer_id || !["approve", "suspend"].includes(action)) {
    return new Response(JSON.stringify({ error: "invalid input" }), { status: 400, headers: corsHeaders });
  }

  const caller = supabaseAsCaller(authHeader);
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

  const admin = supabaseAdmin();
  const { data: adminRow } = await admin.from("admin_users").select("id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return new Response(JSON.stringify({ error: "admins only" }), { status: 403, headers: corsHeaders });

  const newStatus = action === "approve" ? "approved" : "suspended";
  const { error } = await admin.from("dealers").update({ status: newStatus }).eq("id", dealer_id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  await admin.from("admin_activity").insert({
    admin_user_id: adminRow.id,
    action: newStatus === "approved" ? "dealer_approved" : "dealer_suspended",
    target_type: "dealer",
    target_id: dealer_id,
    detail: `Dealer ${newStatus}`,
  });

  return new Response(JSON.stringify({ ok: true, dealer_id, status: newStatus }), { headers: corsHeaders });
});
