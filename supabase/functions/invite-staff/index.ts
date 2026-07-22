// invite-staff: owner-only. Sends a real Supabase invite email, creates the
// dealer_staff row immediately (status "invited"), and the staff_invites row.
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: corsHeaders });

  const { dealer_id, email, role, full_name } = await req.json();
  if (!dealer_id || !email || !["manager", "salesperson"].includes(role)) {
    return new Response(JSON.stringify({ error: "invalid input" }), { status: 400, headers: corsHeaders });
  }

  const caller = supabaseAsCaller(authHeader);
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

  const admin = supabaseAdmin();

  // Confirm caller is an ACTIVE OWNER of this dealer — not just any staff member.
  const { data: ownerRow } = await admin
    .from("dealer_staff")
    .select("id")
    .eq("dealer_id", dealer_id).eq("user_id", user.id).eq("role", "owner").eq("status", "active")
    .maybeSingle();
  if (!ownerRow) return new Response(JSON.stringify({ error: "owners only" }), { status: 403, headers: corsHeaders });

  // Don't create duplicate pending invites for the same email — update instead.
  const { data: existingInvite } = await admin
    .from("staff_invites").select("id").eq("dealer_id", dealer_id).eq("email", email).eq("status", "pending").maybeSingle();

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteErr) return new Response(JSON.stringify({ error: inviteErr.message }), { status: 500, headers: corsHeaders });

  const { data: staffRow, error: staffErr } = await admin
    .from("dealer_staff")
    .insert({
      dealer_id, user_id: invited.user.id, full_name: full_name ?? email,
      role, status: "invited", invited_by: ownerRow.id,
    })
    .select("id").single();
  if (staffErr) return new Response(JSON.stringify({ error: staffErr.message }), { status: 500, headers: corsHeaders });

  if (existingInvite) {
    await admin.from("staff_invites")
      .update({ dealer_staff_id: staffRow.id, expires_at: new Date(Date.now() + 7 * 86400_000).toISOString() })
      .eq("id", existingInvite.id);
  } else {
    await admin.from("staff_invites").insert({
      dealer_id, email, role, invited_by: ownerRow.id, dealer_staff_id: staffRow.id,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
});
