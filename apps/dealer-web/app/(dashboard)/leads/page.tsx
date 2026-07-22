"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import type { Lead, LeadStage } from "@autoserve/shared-types";

const STAGES: { key: LeadStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "test_drive_scheduled", label: "Test drive" },
  { key: "negotiating", label: "Negotiating" },
  { key: "closed_won", label: "Closed — won" },
  { key: "closed_lost", label: "Closed — lost" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  async function loadLeads() {
    const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (!error) setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadLeads(); }, []);

  async function handleStageChange(lead: Lead, newStage: LeadStage) {
    let lostReason: string | null = null;
    if (newStage === "closed_lost") {
      lostReason = window.prompt("Why was this lead lost? (e.g. 'price too high', 'bought elsewhere')");
      if (lostReason === null) return; // cancelled
    }

    const { error: updateError } = await supabase
      .from("leads")
      .update({ stage: newStage, lost_reason: lostReason })
      .eq("id", lead.id);
    if (updateError) { alert(updateError.message); return; }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase.from("dealer_staff").select("id").eq("user_id", user!.id).maybeSingle();

    await supabase.from("lead_activity").insert({
      lead_id: lead.id,
      actor_id: staffRow?.id ?? null,
      action: "stage_change",
      detail: lostReason ? `moved to ${newStage}: ${lostReason}` : `moved to ${newStage}`,
    });

    loadLeads();
  }

  if (loading) return <p className="text-sm text-gray-500">Loading leads…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">Leads</h1>
        <Link href="/leads/new" className="rounded-md bg-black px-4 py-2 text-sm text-white">
          Add lead
        </Link>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-gray-500">No leads yet — add your first one.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage.key);
            return (
              <div key={stage.key} className="min-w-0">
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {stage.label} ({stageLeads.length})
                </h2>
                <div className="flex flex-col gap-2">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} className="rounded-md border p-3">
                      <Link href={`/leads/${lead.id}`} className="block text-sm font-medium hover:underline">
                        {lead.customer_name}
                      </Link>
                      {lead.customer_phone && <p className="text-xs text-gray-500">{lead.customer_phone}</p>}
                      <select
                        value={lead.stage}
                        onChange={(e) => handleStageChange(lead, e.target.value as LeadStage)}
                        className="mt-2 w-full rounded border px-1.5 py-1 text-xs"
                      >
                        {STAGES.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
