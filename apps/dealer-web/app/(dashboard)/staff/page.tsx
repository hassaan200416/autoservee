"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import type { DealerStaff } from "@autoserve/shared-types";

export default function StaffPage() {
  const supabase = createSupabaseBrowserClient();
  const [myRole, setMyRole] = useState<"owner" | "staff" | null>(null);
  const [roster, setRoster] = useState<DealerStaff[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  async function loadEverything() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: myRow } = await supabase
      .from("dealer_staff").select("role").eq("user_id", user.id).maybeSingle();
    setMyRole((myRow?.role as "owner" | "staff") ?? null);

    const { data: rosterRows } = await supabase
      .from("dealer_staff").select("*").order("created_at", { ascending: false });
    setRoster((rosterRows as DealerStaff[]) ?? []);

    setLoading(false);
  }

  useEffect(() => { loadEverything(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) { setInviteError("Email is required."); return; }
    setInviteError(null);
    setInviting(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: myRow } = await supabase
      .from("dealer_staff").select("dealer_id").eq("user_id", user!.id).maybeSingle();

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-staff`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dealer_id: myRow?.dealer_id, email: inviteEmail, full_name: inviteName || undefined }),
    });
    const result = await res.json();

    setInviting(false);
    if (!res.ok) { setInviteError(result.error ?? "Failed to invite."); return; }

    setInviteEmail("");
    setInviteName("");
    loadEverything();
  }

  async function handleDeactivate(member: DealerStaff) {
    if (!window.confirm(`Deactivate ${member.full_name}? They'll immediately lose access. Their existing leads stay assigned to them — reassign those separately if needed.`)) {
      return;
    }
    const { error } = await supabase
      .from("dealer_staff")
      .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
      .eq("id", member.id);
    if (error) { alert(error.message); return; }
    loadEverything();
  }

  async function handleReactivate(member: DealerStaff) {
    const { error } = await supabase
      .from("dealer_staff")
      .update({ status: "active", deactivated_at: null })
      .eq("id", member.id);
    if (error) { alert(error.message); return; }
    loadEverything();
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-lg font-medium">Staff</h1>

      {myRole === "owner" && (
        <form onSubmit={handleInvite} className="mb-8 flex flex-col gap-3 rounded-md border p-4">
          <h2 className="text-sm font-medium">Invite staff</h2>
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Email"
            value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <input className="rounded-md border px-3 py-2 text-sm" placeholder="Full name (optional)"
            value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
          <button disabled={inviting} className="self-start rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
            {inviting ? "Sending invite…" : "Send invite"}
          </button>
        </form>
      )}

      <h2 className="mb-2 text-sm font-medium">Roster</h2>
      {roster.length === 0 ? (
        <p className="text-sm text-gray-500">No staff yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {roster.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{member.full_name}</p>
                <p className="text-xs text-gray-500">
                  {member.role} ·{" "}
                  <span className={
                    member.status === "active" ? "text-green-700" :
                    member.status === "invited" ? "text-amber-700" : "text-gray-500"
                  }>
                    {member.status}
                  </span>
                </p>
              </div>
              {myRole === "owner" && member.role !== "owner" && (
                member.status === "deactivated" ? (
                  <button onClick={() => handleReactivate(member)}
                    className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    Reactivate
                  </button>
                ) : (
                  <button onClick={() => handleDeactivate(member)}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                    Deactivate
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
