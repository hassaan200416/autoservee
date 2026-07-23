"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Badge, EmptyState, PageHeader, Skeleton, StatCard } from "@autoserve/shared-ui";
import type { Car, Lead } from "@autoserve/shared-types";
import { AlertCircle, Car as CarIcon, Clock, UserPlus } from "lucide-react";

type Stats = {
  leadsThisWeek: number;
  carsAvailable: number;
  leadsByStage: Record<string, number>;
};

export default function HomePage() {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [unassigned, setUnassigned] = useState<Lead[]>([]);
  const [overdue, setOverdue] = useState<Lead[]>([]);
  const [reserved, setReserved] = useState<Car[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: staffRow } = await supabase
        .from("dealer_staff")
        .select("dealer_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user!.id)
        .maybeSingle();

      const nowIso = new Date().toISOString();

      const [statsRes, unassignedRes, overdueRes, reservedRes] = await Promise.all([
        session
          ? fetch(
              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dealer-stats?dealer_id=${staffRow?.dealer_id}`,
              { headers: { Authorization: `Bearer ${session.access_token}` } }
            ).then((r) => r.json()).catch(() => null)
          : null,
        supabase
          .from("leads")
          .select("*")
          .is("assigned_to", null)
          .not("stage", "in", '("closed_won","closed_lost")')
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("leads")
          .select("*")
          .lt("next_follow_up_at", nowIso)
          .not("stage", "in", '("closed_won","closed_lost")')
          .order("next_follow_up_at", { ascending: true })
          .limit(8),
        supabase
          .from("cars")
          .select("*")
          .eq("status", "reserved")
          .order("updated_at", { ascending: false })
          .limit(6),
      ]);

      if (statsRes && !statsRes.error) setStats(statsRes as Stats);
      setUnassigned((unassignedRes.data as Lead[]) ?? []);
      setOverdue((overdueRes.data as Lead[]) ?? []);
      setReserved((reservedRes.data as Car[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="mb-6 border-b border-border pb-4">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today"
        description="What needs attention right now — not buried in WhatsApp."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Leads this week" value={stats?.leadsThisWeek ?? "—"} />
        <StatCard label="Cars available" value={stats?.carsAvailable ?? "—"} />
        <StatCard label="Unassigned open leads" value={unassigned.length} />
        <StatCard label="Overdue follow-ups" value={overdue.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-800">Overdue follow-ups</h2>
          </div>
          {overdue.length === 0 ? (
            <EmptyState title="Nothing overdue" description="Set follow-up dates on leads to track them here." />
          ) : (
            <div className="space-y-2">
              {overdue.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="block rounded-xl border border-border bg-white p-3 transition-colors hover:border-accent">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{lead.customer_name}</p>
                    <Badge tone="warning">Due</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : ""} · {lead.stage.replaceAll("_", " ")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-sky-700" />
            <h2 className="text-sm font-semibold text-slate-800">Unassigned leads</h2>
          </div>
          {unassigned.length === 0 ? (
            <EmptyState title="All leads assigned" description="New leads without an owner show up here." />
          ) : (
            <div className="space-y-2">
              {unassigned.map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="block rounded-xl border border-border bg-white p-3 transition-colors hover:border-accent">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{lead.customer_name}</p>
                    <Badge tone="info">{lead.source.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{lead.customer_phone ?? "No phone"}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CarIcon className="h-4 w-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-800">Reserved cars</h2>
        </div>
        {reserved.length === 0 ? (
          <EmptyState title="No reservations" description="Cars marked reserved appear here so they don’t get forgotten." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reserved.map((car) => (
              <Link key={car.id} href={`/inventory/${car.id}`} className="rounded-xl border border-border bg-white p-3 transition-colors hover:border-accent">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{car.year} {car.make} {car.model}</p>
                  <Badge tone="warning">reserved</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">PKR {Number(car.price).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!stats && (
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <AlertCircle className="h-3.5 w-3.5" />
          Live stats unavailable — lists above still reflect your dealer data.
        </p>
      )}
    </div>
  );
}
