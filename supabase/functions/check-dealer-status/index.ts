import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ allowed: false, reason: "unauthorized" }), { status: 401, headers: corsHeaders });

  let app: "dealer" | "admin" | null = null;
  try {
    const body = await req.json();
    app = body?.app === "admin" ? "admin" : body?.app === "dealer" ? "dealer" : null;
  } catch (_) { /* no body sent */ }
  if (!app) return new Response(JSON.stringify({ allowed: false, reason: "missing_app" }), { status: 400, headers: corsHeaders });

  const caller = supabaseAsCaller(authHeader);
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return new Response(JSON.stringify({ allowed: false, reason: "unauthorized" }), { status: 401, headers: corsHeaders });

  const admin = supabaseAdmin();

  const { data: adminRow } = await admin.from("admin_users").select("id").eq("user_id", user.id).maybeSingle();
  if (adminRow) {
    if (app !== "admin") {
      return new Response(JSON.stringify({ allowed: false, reason: "admins_use_admin_panel_only" }), { status: 403, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ allowed: true, role: "admin" }), { headers: corsHeaders });
  }

  const { data: staffRow } = await admin
    .from("dealer_staff").select("dealer_id, role, status, dealers(status)")
    .eq("user_id", user.id).maybeSingle();

  if (!staffRow) return new Response(JSON.stringify({ allowed: false, reason: "no_account" }), { status: 403, headers: corsHeaders });
  if (app !== "dealer") {
    return new Response(JSON.stringify({ allowed: false, reason: "staff_use_dealer_app_only" }), { status: 403, headers: corsHeaders });
  }
  if (staffRow.status === "deactivated") {
    return new Response(JSON.stringify({ allowed: false, reason: "staff_deactivated" }), { status: 403, headers: corsHeaders });
  }
  // @ts-ignore - joined shape
  if (staffRow.dealers?.status === "suspended") {
    return new Response(JSON.stringify({ allowed: false, reason: "dealer_suspended" }), { status: 403, headers: corsHeaders });
  }

  if (staffRow.status === "invited") {
    await admin.from("dealer_staff").update({ status: "active" }).eq("user_id", user.id).eq("dealer_id", staffRow.dealer_id);
    await admin.from("staff_invites").update({ status: "accepted" })
      .eq("dealer_id", staffRow.dealer_id).eq("status", "pending");
  }

  return new Response(JSON.stringify({ allowed: true, role: staffRow.role, dealer_id: staffRow.dealer_id }), { headers: corsHeaders });
});
