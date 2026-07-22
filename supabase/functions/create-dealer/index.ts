import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: corsHeaders });

  const { name, city, contact_phone, owner_email, owner_full_name } = await req.json();
  if (!name || !city || !owner_email) {
    return new Response(JSON.stringify({ error: "invalid input" }), { status: 400, headers: corsHeaders });
  }

  const caller = supabaseAsCaller(authHeader);
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

  const admin = supabaseAdmin();
  const { data: adminRow } = await admin.from("admin_users").select("id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return new Response(JSON.stringify({ error: "admins only" }), { status: 403, headers: corsHeaders });

  // Invite FIRST. If this fails (rate limit, bad email, etc.), nothing else
  // has been created yet — no cleanup needed, no orphaned dealer.
  const dealerAppUrl = Deno.env.get("DEALER_APP_URL") ?? "http://localhost:3000";
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(owner_email, {
    redirectTo: `${dealerAppUrl}/accept-invite`,
  });
  if (inviteErr) return new Response(JSON.stringify({ error: inviteErr.message }), { status: 500, headers: corsHeaders });

  const { data: dealer, error: dealerErr } = await admin
    .from("dealers")
    .insert({ name, city, contact_phone: contact_phone ?? null, status: "approved" })
    .select("id").single();
  if (dealerErr) return new Response(JSON.stringify({ error: dealerErr.message }), { status: 500, headers: corsHeaders });

  const { error: staffErr } = await admin.from("dealer_staff").insert({
    dealer_id: dealer.id, user_id: invited.user.id,
    full_name: owner_full_name ?? owner_email, role: "owner", status: "invited",
  });
  if (staffErr) {
    // Compensating cleanup: the dealer row is useless without an owner —
    // remove it rather than leave a broken half-created dealer behind.
    await admin.from("dealers").delete().eq("id", dealer.id);
    return new Response(JSON.stringify({ error: staffErr.message }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true, dealer_id: dealer.id }), { headers: corsHeaders });
});
