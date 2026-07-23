"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MessageCircle, Phone, Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Badge, Button, EmptyState, Field, Input, PageHeader, Select, Skeleton, cn } from "@autoserve/shared-ui";
import { LEAD_STAGES, type Lead, type LeadStage, type DealerStaff } from "@autoserve/shared-types";

type LeadWithCar = Lead & {
  cars: { make: string; model: string; year: number } | null;
};

function whatsappHref(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  else if (!digits.startsWith("92") && digits.length === 10) digits = `92${digits}`;
  return `https://wa.me/${digits}`;
}

function LeadCard({
  lead,
  assigneeName,
  dragging,
}: {
  lead: LeadWithCar;
  assigneeName: string | null | undefined;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });
  const wa = lead.customer_phone ? whatsappHref(lead.customer_phone) : null;
  const carLabel = lead.cars ? `${lead.cars.year} ${lead.cars.make} ${lead.cars.model}` : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "rounded-xl border border-border bg-white p-3 shadow-sm transition-shadow duration-150",
        (isDragging || dragging) && "opacity-40 shadow-md",
        dragging && "opacity-100 ring-2 ring-accent/30"
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          aria-label="Drag lead"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <Link
            href={`/leads/${lead.id}`}
            className="block text-sm font-medium text-slate-900 hover:text-accent"
          >
            {lead.customer_name}
          </Link>
          {lead.customer_phone && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <a
                href={`tel:${lead.customer_phone}`}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <Phone className="h-3 w-3" />
                {lead.customer_phone}
              </a>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </a>
              )}
            </div>
          )}
          {carLabel && <p className="mt-1.5 truncate text-xs text-slate-500">{carLabel}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {assigneeName ? <Badge tone="info">{assigneeName}</Badge> : <Badge tone="neutral">Unassigned</Badge>}
            {lead.next_follow_up_at && (
              <Badge tone={new Date(lead.next_follow_up_at) < new Date() ? "danger" : "warning"}>Follow-up</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageColumn({
  stageKey,
  label,
  leads,
  staffMap,
}: {
  stageKey: LeadStage;
  label: string;
  leads: LeadWithCar[];
  staffMap: Map<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey });
  return (
    <div className="min-w-0">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label} <span className="text-slate-400">({leads.length})</span>
      </h2>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-col gap-2 rounded-xl border border-transparent p-1 transition-colors duration-150",
          isOver && "border-accent/40 bg-sky-50/60"
        )}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            assigneeName={lead.assigned_to ? staffMap.get(lead.assigned_to) : null}
          />
        ))}
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadWithCar[]>([]);
  const [staff, setStaff] = useState<DealerStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [stageError, setStageError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<{ lead: LeadWithCar; previousStage: LeadStage } | null>(null);
  const [lostReason, setLostReason] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staff) map.set(s.id, s.full_name);
    return map;
  }, [staff]);

  async function loadLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select("*, cars(make, model, year)")
      .order("created_at", { ascending: false });
    if (!error) setLeads((data as LeadWithCar[]) ?? []);

    const { data: staffRows } = await supabase.from("dealer_staff").select("*").eq("status", "active");
    setStaff((staffRows as DealerStaff[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const filtered = useMemo(() => {
    let result = leads;
    if (assigneeFilter === "unassigned") result = result.filter((l) => !l.assigned_to);
    else if (assigneeFilter !== "all") result = result.filter((l) => l.assigned_to === assigneeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.customer_name.toLowerCase().includes(q) || (l.customer_phone ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, search, assigneeFilter]);

  async function persistStage(lead: LeadWithCar, newStage: LeadStage, reason: string | null) {
    const previous = lead.stage;
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, stage: newStage, lost_reason: reason } : l))
    );

    const { error: updateError } = await supabase
      .from("leads")
      .update({ stage: newStage, lost_reason: reason })
      .eq("id", lead.id);

    if (updateError) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, stage: previous } : l)));
      setStageError(updateError.message);
      return;
    }
    setStageError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase
      .from("dealer_staff")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    await supabase.from("lead_activity").insert({
      lead_id: lead.id,
      actor_id: staffRow?.id ?? null,
      action: "stage_change",
      detail: reason ? `moved to ${newStage}: ${reason}` : `moved to ${newStage}`,
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const lead = event.active.data.current?.lead as LeadWithCar | undefined;
    const overId = event.over?.id as LeadStage | undefined;
    if (!lead || !overId || !LEAD_STAGES.some((s) => s.key === overId)) return;
    if (lead.stage === overId) return;

    if (overId === "closed_lost") {
      setPendingLost({ lead, previousStage: lead.stage });
      setLostReason("");
      return;
    }
    void persistStage(lead, overId, overId === "closed_won" ? null : lead.lost_reason);
  }

  async function confirmLost() {
    if (!pendingLost) return;
    const reason = lostReason.trim() || "No reason given";
    const { lead } = pendingLost;
    setPendingLost(null);
    await persistStage(lead, "closed_lost", reason);
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  if (loading) {
    return (
      <div className="page-enter">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="min-w-0 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="Leads"
        description="Drag cards between stages — or open a lead for full detail."
        action={
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800"
          >
            <Plus className="h-4 w-4" />
            Add lead
          </Link>
        }
      />

      {leads.length === 0 ? (
        <EmptyState title="No leads yet" description="Add your first lead to start the pipeline." />
      ) : (
        <>
          {stageError && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {stageError}
            </p>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              className="min-w-[200px] flex-1"
              placeholder="Search name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-auto min-w-[160px]"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <option value="all">Everyone</option>
              <option value="unassigned">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {LEAD_STAGES.map((stage) => (
                <StageColumn
                  key={stage.key}
                  stageKey={stage.key}
                  label={stage.label}
                  leads={filtered.filter((l) => l.stage === stage.key)}
                  staffMap={staffMap}
                />
              ))}
            </div>
            <DragOverlay>
              {activeLead ? (
                <LeadCard
                  lead={activeLead}
                  assigneeName={activeLead.assigned_to ? staffMap.get(activeLead.assigned_to) : null}
                  dragging
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {pendingLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setPendingLost(null)} />
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Mark as lost</h2>
            <p className="mt-2 text-sm text-slate-500">
              Why did {pendingLost.lead.customer_name} drop? This helps the team learn.
            </p>
            <div className="mt-4">
              <Field label="Reason" htmlFor="lost-reason">
                <Input
                  id="lost-reason"
                  autoFocus
                  placeholder="e.g. price too high, bought elsewhere"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void confirmLost();
                  }}
                />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setPendingLost(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={() => void confirmLost()}>
                Mark lost
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
