"use client";

import { useEffect, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from "@autoserve/shared-ui";
import type { DealerStaff, Lead } from "@autoserve/shared-types";

function statusTone(status: DealerStaff["status"]): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "invited") return "warning";
  return "neutral";
}

type StaffMetrics = {
  staffId: string;
  open: number;
  won: number;
  lost: number;
};

type ConfirmAction =
  | { type: "deactivate"; member: DealerStaff; openLeadCount: number }
  | { type: "revoke"; member: DealerStaff }
  | null;

export default function StaffPage() {
  const supabase = createSupabaseBrowserClient();
  const [myRole, setMyRole] = useState<"owner" | "staff" | null>(null);
  const [roster, setRoster] = useState<DealerStaff[]>([]);
  const [metrics, setMetrics] = useState<StaffMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [reassignTo, setReassignTo] = useState<string>("unassign");
  const [busy, setBusy] = useState(false);

  async function loadEverything() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: myRow } = await supabase
      .from("dealer_staff")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    setMyRole((myRow?.role as "owner" | "staff") ?? null);

    const { data: rosterRows } = await supabase
      .from("dealer_staff")
      .select("*")
      .order("created_at", { ascending: false });
    setRoster((rosterRows as DealerStaff[]) ?? []);

    const { data: leadRows } = await supabase.from("leads").select("assigned_to, stage");
    const byStaff = new Map<string, StaffMetrics>();
    for (const lead of (leadRows as Pick<Lead, "assigned_to" | "stage">[]) ?? []) {
      if (!lead.assigned_to) continue;
      const row = byStaff.get(lead.assigned_to) ?? {
        staffId: lead.assigned_to,
        open: 0,
        won: 0,
        lost: 0,
      };
      if (lead.stage === "closed_won") row.won += 1;
      else if (lead.stage === "closed_lost") row.lost += 1;
      else row.open += 1;
      byStaff.set(lead.assigned_to, row);
    }
    setMetrics(Array.from(byStaff.values()));

    setLoading(false);
  }

  useEffect(() => {
    loadEverything();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) {
      setInviteError("Email is required.");
      return;
    }
    setInviteError(null);
    setInviting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: myRow } = await supabase
      .from("dealer_staff")
      .select("dealer_id")
      .eq("user_id", user!.id)
      .maybeSingle();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-staff`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dealer_id: myRow?.dealer_id,
          email: inviteEmail,
          full_name: inviteName || undefined,
        }),
      }
    );
    const result = await res.json();

    setInviting(false);
    if (!res.ok) {
      setInviteError(result.error ?? "Failed to invite.");
      return;
    }

    setInviteEmail("");
    setInviteName("");
    loadEverything();
  }

  async function openDeactivate(member: DealerStaff) {
    setActionError(null);
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", member.id)
      .not("stage", "in", '("closed_won","closed_lost")');
    setReassignTo("unassign");
    setConfirm({ type: "deactivate", member, openLeadCount: count ?? 0 });
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    setActionError(null);

    if (confirm.type === "deactivate") {
      const member = confirm.member;
      if (confirm.openLeadCount > 0) {
        const nextAssignee = reassignTo === "unassign" ? null : reassignTo;
        const { error: leadError } = await supabase
          .from("leads")
          .update({ assigned_to: nextAssignee })
          .eq("assigned_to", member.id)
          .not("stage", "in", '("closed_won","closed_lost")');
        if (leadError) {
          setActionError(leadError.message);
          setBusy(false);
          return;
        }
      }
      const { error } = await supabase
        .from("dealer_staff")
        .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
        .eq("id", member.id);
      if (error) {
        setActionError(error.message);
        setBusy(false);
        return;
      }
    }

    if (confirm.type === "revoke") {
      const member = confirm.member;
      await supabase
        .from("dealer_staff")
        .update({ status: "deactivated", deactivated_at: new Date().toISOString() })
        .eq("id", member.id);
      await supabase
        .from("staff_invites")
        .update({ status: "revoked" })
        .eq("dealer_staff_id", member.id)
        .eq("status", "pending");
    }

    setBusy(false);
    setConfirm(null);
    loadEverything();
  }

  async function handleReactivate(member: DealerStaff) {
    setActionError(null);
    const { error } = await supabase
      .from("dealer_staff")
      .update({ status: "active", deactivated_at: null })
      .eq("id", member.id);
    if (error) {
      setActionError(error.message);
      return;
    }
    loadEverything();
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const deactivateAssignees = roster.filter(
    (m) => m.status === "active" && confirm?.type === "deactivate" && m.id !== confirm.member.id
  );

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Staff"
        description="Invite teammates and manage who can work your leads."
      />

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {myRole === "owner" && (
        <Card className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-medium text-slate-900">Invite staff</h2>
          </div>
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <Field label="Email" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@dealership.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </Field>
            <Field label="Full name" htmlFor="invite-name" hint="Optional">
              <Input
                id="invite-name"
                placeholder="Ali Khan"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </Field>
            {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
            <Button type="submit" disabled={inviting} className="self-start">
              {inviting ? "Sending invite…" : "Send invite"}
            </Button>
          </form>
        </Card>
      )}

      <div className="mb-2 flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-medium text-slate-900">Roster</h2>
      </div>
      {roster.length === 0 ? (
        <EmptyState title="No staff yet" description="Invite your first teammate to get started." />
      ) : (
        <div className="flex flex-col gap-2">
          {roster.map((member) => {
            const m = metrics.find((x) => x.staffId === member.id);
            return (
            <Card key={member.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{member.full_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone="info">{member.role}</Badge>
                  <Badge tone={statusTone(member.status)}>{member.status}</Badge>
                </div>
                {member.status === "active" && (
                  <p className="mt-2 text-xs tabular-nums text-slate-500">
                    Open {m?.open ?? 0} · Won {m?.won ?? 0} · Lost {m?.lost ?? 0}
                  </p>
                )}
              </div>
              {myRole === "owner" &&
                member.role !== "owner" &&
                (member.status === "invited" ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirm({ type: "revoke", member })}
                  >
                    Revoke invite
                  </Button>
                ) : member.status === "deactivated" ? (
                  <Button variant="secondary" size="sm" onClick={() => handleReactivate(member)}>
                    Reactivate
                  </Button>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => openDeactivate(member)}>
                    Deactivate
                  </Button>
                ))}
            </Card>
          );})}
        </div>
      )}

      {myRole === "owner" && roster.some((r) => r.status === "active") && (
        <Card className="mt-8 overflow-x-auto p-0">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium text-slate-900">Salesperson performance</h2>
            <p className="mt-0.5 text-xs text-slate-500">Lead outcomes by assignee — pipeline honesty, not vanity charts.</p>
          </div>
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Open</th>
                <th className="px-4 py-2 font-medium">Won</th>
                <th className="px-4 py-2 font-medium">Lost</th>
                <th className="px-4 py-2 font-medium">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {roster
                .filter((r) => r.status === "active")
                .map((member) => {
                  const m = metrics.find((x) => x.staffId === member.id);
                  const closed = (m?.won ?? 0) + (m?.lost ?? 0);
                  const winRate = closed === 0 ? "—" : `${Math.round(((m?.won ?? 0) / closed) * 100)}%`;
                  return (
                    <tr key={member.id} className="border-t border-border">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{member.full_name}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{m?.open ?? 0}</td>
                      <td className="px-4 py-2.5 tabular-nums text-emerald-700">{m?.won ?? 0}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{m?.lost ?? 0}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-600">{winRate}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Card>
      )}

      {confirm?.type === "deactivate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => !busy && setConfirm(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">
              Deactivate {confirm.member.full_name}?
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              They&apos;ll lose access immediately.
              {confirm.openLeadCount > 0
                ? ` They have ${confirm.openLeadCount} open lead${confirm.openLeadCount === 1 ? "" : "s"} — choose who should own them.`
                : " They have no open leads."}
            </p>
            {confirm.openLeadCount > 0 && (
              <div className="mt-4">
                <Field label="Reassign open leads to" htmlFor="reassign">
                  <Select
                    id="reassign"
                    value={reassignTo}
                    onChange={(e) => setReassignTo(e.target.value)}
                  >
                    <option value="unassign">Leave unassigned</option>
                    {deactivateAssignees.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
            {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" disabled={busy} onClick={runConfirm}>
                {busy ? "Working…" : "Deactivate"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm?.type === "revoke"}
        title={`Revoke invite for ${confirm?.member.full_name}?`}
        description="They won't be able to log in. You can invite the correct email if this was a mistake."
        confirmLabel="Revoke invite"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </div>
  );
}
