"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import type { Lead, LeadActivity, DealerStaff } from "@autoserve/shared-types";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createSupabaseBrowserClient();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activity, setActivity] = useState<LeadActivity[]>([]);
  const [staff, setStaff] = useState<DealerStaff[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<"summarize_notes" | "draft_followup" | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function loadEverything() {
    const { data: leadRow } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
    if (!leadRow) { setLoading(false); return; }
    setLead(leadRow as Lead);

    const { data: activityRows } = await supabase
      .from("lead_activity").select("*").eq("lead_id", id).order("created_at", { ascending: false });
    setActivity((activityRows as LeadActivity[]) ?? []);

    const { data: staffRows } = await supabase
      .from("dealer_staff").select("*").eq("dealer_id", leadRow.dealer_id).eq("status", "active");
    setStaff((staffRows as DealerStaff[]) ?? []);

    setLoading(false);
  }

  useEffect(() => { loadEverything(); }, [id]);

  async function handleAssign(assignedTo: string) {
    setError(null);
    const staffName = assignedTo
      ? staff.find((s) => s.id === assignedTo)?.full_name ?? "someone"
      : "unassigned";

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assign-lead`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: id,
        assigned_to: assignedTo,
        note: assignedTo ? `reassigned to ${staffName}` : "unassigned",
      }),
    });
    const result = await res.json();
    if (!res.ok) { setError(result.error ?? "Failed to assign."); return; }
    loadEverything();
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase.from("dealer_staff").select("id").eq("user_id", user!.id).maybeSingle();

    await supabase.from("lead_activity").insert({
      lead_id: id, actor_id: staffRow?.id ?? null, action: "note", detail: note,
    });
    setNote("");
    loadEverything();
  }

  async function handleAiAssist(action: "summarize_notes" | "draft_followup") {
    setAiLoading(action);
    setAiError(null);
    setAiResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-assist`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: id, action }),
    });
    const result = await res.json();

    setAiLoading(null);
    if (!res.ok) {
      const messages: Record<string, string> = {
        not_enough_history: "Not enough activity on this lead yet to summarize.",
        daily_limit_reached: "Daily AI limit reached for your dealership — try again tomorrow.",
        ai_unavailable: "AI assistant is temporarily unavailable.",
      };
      setAiError(messages[result.error] ?? result.error ?? "Something went wrong.");
      return;
    }
    setAiResult(result.text);
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!lead) return <p className="text-sm text-gray-500">Lead not found.</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-lg font-medium">{lead.customer_name}</h1>
      <p className="mb-4 text-sm text-gray-500">
        {lead.customer_phone ?? "No phone"} · via {lead.source.replace("_", " ")} · stage: {lead.stage.replace("_", " ")}
      </p>

      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-gray-500">Assigned to</label>
        <select
          value={lead.assigned_to ?? ""}
          onChange={(e) => handleAssign(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      <form onSubmit={handleAddNote} className="mb-6 flex gap-2">
        <input className="flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Add a note…"
          value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="rounded-md bg-black px-4 py-2 text-sm text-white">Add</button>
      </form>

      <div className="mb-6 rounded-md border p-4">
        <h2 className="mb-2 text-sm font-medium">AI assistant</h2>
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => handleAiAssist("summarize_notes")}
            disabled={aiLoading !== null}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {aiLoading === "summarize_notes" ? "Summarizing…" : "Summarize this lead"}
          </button>
          <button
            onClick={() => handleAiAssist("draft_followup")}
            disabled={aiLoading !== null}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {aiLoading === "draft_followup" ? "Drafting…" : "Draft a follow-up"}
          </button>
        </div>
        {aiError && <p className="text-sm text-red-600">{aiError}</p>}
        {aiResult && (
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <p className="whitespace-pre-wrap">{aiResult}</p>
            <p className="mt-2 text-xs text-gray-400">Review before sending — nothing is sent automatically.</p>
          </div>
        )}
      </div>

      <h2 className="mb-2 text-sm font-medium">Activity</h2>
      <div className="flex flex-col gap-2">
        {activity.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet.</p>
        ) : (
          activity.map((a) => (
            <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
              <p>{a.detail}</p>
              <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
