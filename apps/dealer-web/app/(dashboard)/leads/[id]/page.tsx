"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Car as CarIcon, MessageCircle, Phone } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Skeleton, relativeTime } from "@autoserve/shared-ui";
import { useToast } from "@autoserve/shared-ui/toast";
import type {
  Car,
  DealerStaff,
  Lead,
  LeadActivity,
  LeadActivityAction,
} from "@autoserve/shared-types";

type LeadWithCar = Lead & {
  cars: Pick<Car, "id" | "make" | "model" | "year" | "price" | "status"> | null;
};

function whatsappHref(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  else if (!digits.startsWith("92") && digits.length === 10) digits = `92${digits}`;
  return `https://wa.me/${digits}`;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ACTIVITY_TYPES: { key: LeadActivityAction; label: string }[] = [
  { key: "call", label: "Call" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "visit", label: "Visit" },
  { key: "note", label: "Note" },
];

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();

  const [lead, setLead] = useState<LeadWithCar | null>(null);
  const [activity, setActivity] = useState<LeadActivity[]>([]);
  const [staff, setStaff] = useState<DealerStaff[]>([]);
  const [note, setNote] = useState("");
  const [activityType, setActivityType] = useState<LeadActivityAction>("note");
  const [followUp, setFollowUp] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<
    "summarize_notes" | "draft_followup" | "suggest_next_step" | null
  >(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function loadEverything() {
    const { data: leadRow } = await supabase
      .from("leads")
      .select("*, cars(id, make, model, year, price, status)")
      .eq("id", id)
      .maybeSingle();
    if (!leadRow) {
      setLoading(false);
      return;
    }
    const typed = leadRow as LeadWithCar;
    setLead(typed);
    setFollowUp(toDatetimeLocal(typed.next_follow_up_at));

    const { data: activityRows } = await supabase
      .from("lead_activity")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false });
    setActivity((activityRows as LeadActivity[]) ?? []);

    const { data: staffRows } = await supabase
      .from("dealer_staff")
      .select("*")
      .eq("dealer_id", leadRow.dealer_id)
      .eq("status", "active");
    setStaff((staffRows as DealerStaff[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadEverything();
  }, [id]);

  async function handleAssign(assignedTo: string) {
    setError(null);
    const staffName = assignedTo
      ? staff.find((s) => s.id === assignedTo)?.full_name ?? "someone"
      : "unassigned";

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assign-lead`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: id,
          assigned_to: assignedTo,
          note: assignedTo ? `reassigned to ${staffName}` : "unassigned",
        }),
      }
    );
    const result = await res.json();
    if (!res.ok) {
      const msg = result.error ?? "Failed to assign.";
      setError(msg);
      toast(msg, "error");
      return;
    }
    toast(assignedTo ? `Assigned to ${staffName}` : "Lead unassigned", "success");
    loadEverything();
  }

  async function handleSaveFollowUp(e: React.FormEvent) {
    e.preventDefault();
    setSavingFollowUp(true);
    const value = followUp ? new Date(followUp).toISOString() : null;
    const { error: updateError } = await supabase
      .from("leads")
      .update({ next_follow_up_at: value })
      .eq("id", id);
    setSavingFollowUp(false);
    if (updateError) {
      toast(updateError.message, "error");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase
      .from("dealer_staff")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    await supabase.from("lead_activity").insert({
      lead_id: id,
      actor_id: staffRow?.id ?? null,
      action: "follow_up",
      detail: value
        ? `follow-up set for ${new Date(value).toLocaleString()}`
        : "follow-up cleared",
    });

    toast("Follow-up updated", "success");
    loadEverything();
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase
      .from("dealer_staff")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    const { error: insertError } = await supabase.from("lead_activity").insert({
      lead_id: id,
      actor_id: staffRow?.id ?? null,
      action: activityType,
      detail: note.trim(),
    });
    if (insertError) {
      toast(insertError.message, "error");
      return;
    }
    setNote("");
    toast("Activity logged", "success");
    loadEverything();
  }

  async function handleAiAssist(
    action: "summarize_notes" | "draft_followup" | "suggest_next_step"
  ) {
    setAiLoading(action);
    setAiError(null);
    setAiResult(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-assist`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lead_id: id, action }),
      }
    );
    const result = await res.json();

    setAiLoading(null);
    if (!res.ok) {
      const messages: Record<string, string> = {
        not_enough_history: "Not enough activity on this lead yet to summarize.",
        daily_limit_reached: "Daily AI limit reached for your dealership — try again tomorrow.",
        ai_unavailable: "AI assistant is temporarily unavailable.",
      };
      const msg = messages[result.error] ?? result.error ?? "Something went wrong.";
      setAiError(msg);
      toast(msg, "error");
      return;
    }
    setAiResult(result.text);
  }

  if (loading) {
    return (
      <div className="max-w-xl space-y-6">
        <div className="border-b border-border pb-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div>
          <Skeleton className="mb-1.5 h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div>
          <Skeleton className="mb-1.5 h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (!lead) return <p className="text-sm text-slate-500">Lead not found.</p>;

  const wa = lead.customer_phone ? whatsappHref(lead.customer_phone) : null;

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title={lead.customer_name}
        description={`${lead.source.replace(/_/g, " ")} · ${lead.stage.replace(/_/g, " ")}`}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {lead.customer_phone ? (
          <>
            <a
              href={`tel:${lead.customer_phone}`}
              className="inline-flex items-center gap-1.5 text-accent hover:underline"
            >
              <Phone className="h-4 w-4" />
              {lead.customer_phone}
            </a>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </>
        ) : (
          <span className="text-slate-500">No phone on file</span>
        )}
      </div>

      {lead.cars && (
        <Card className="flex items-start gap-3">
          <CarIcon className="mt-0.5 h-4 w-4 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">
              {lead.cars.year} {lead.cars.make} {lead.cars.model}
            </p>
            <p className="text-xs text-slate-500">
              PKR {Number(lead.cars.price).toLocaleString()} · {lead.cars.status}
            </p>
            <Link
              href={`/inventory/${lead.cars.id}`}
              className="mt-1 inline-block text-xs text-accent hover:underline"
            >
              View inventory
            </Link>
          </div>
          <Badge tone={lead.cars.status === "available" ? "success" : "warning"}>
            {lead.cars.status}
          </Badge>
        </Card>
      )}

      {lead.notes && (
        <Card>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{lead.notes}</p>
        </Card>
      )}

      <Field label="Assigned to" htmlFor="assigned-to">
        <Select
          id="assigned-to"
          value={lead.assigned_to ?? ""}
          onChange={(e) => handleAssign(e.target.value)}
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </Select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </Field>

      <form onSubmit={handleSaveFollowUp} className="space-y-2">
        <Field label="Next follow-up" htmlFor="follow-up">
          <div className="flex flex-wrap gap-2">
            <Input
              id="follow-up"
              type="datetime-local"
              className="flex-1"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
            <Button type="submit" variant="secondary" disabled={savingFollowUp}>
              {savingFollowUp ? "Saving…" : "Save"}
            </Button>
          </div>
        </Field>
      </form>

      <form onSubmit={handleAddActivity} className="space-y-2">
        <Field label="Log activity" htmlFor="activity-note">
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActivityType(t.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activityType === t.key
                    ? "border-accent bg-sky-50 text-accent"
                    : "border-border bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              id="activity-note"
              className="flex-1"
              placeholder={`Add a ${activityType} note…`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit">Add</Button>
          </div>
        </Field>
      </form>

      <Card>
        <h2 className="mb-2 text-sm font-medium text-slate-900">AI assistant</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            onClick={() => handleAiAssist("summarize_notes")}
            disabled={aiLoading !== null}
          >
            {aiLoading === "summarize_notes" ? "Summarizing…" : "Summarize this lead"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            onClick={() => handleAiAssist("draft_followup")}
            disabled={aiLoading !== null}
          >
            {aiLoading === "draft_followup" ? "Drafting…" : "Draft a follow-up"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            onClick={() => handleAiAssist("suggest_next_step")}
            disabled={aiLoading !== null}
          >
            {aiLoading === "suggest_next_step" ? "Thinking…" : "Suggest next step"}
          </Button>
        </div>
        {aiError && <p className="text-sm text-red-600">{aiError}</p>}
        {aiResult && (
          <div className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="whitespace-pre-wrap">{aiResult}</p>
            <p className="mt-2 text-xs text-slate-400">
              Review before sending — nothing is sent automatically.
            </p>
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-900">Activity</h2>
        <div className="flex flex-col gap-2">
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            activity.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm shadow-sm"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone="neutral">{a.action.replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-slate-400" title={new Date(a.created_at).toLocaleString()}>
                    {relativeTime(a.created_at)}
                  </span>
                </div>
                <p className="text-slate-800">{a.detail}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
