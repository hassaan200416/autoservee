"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Badge, Card, PageHeader, Skeleton, StatCard } from "@autoserve/shared-ui";

export default function OverviewPage() {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    dealersApproved: number;
    dealersPending: number;
    dealersSuspended: number;
    totalCars: number;
    totalLeads: number;
    totalStaff: number;
    leadsThisWeek: number;
    leadsLastWeek: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400_000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400_000);

      const [dealers, cars, leads, staff, leadsThisWeek, leadsLastWeek] = await Promise.all([
        supabase.from("dealers").select("status"),
        supabase.from("cars").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("dealer_staff").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .gte("created_at", twoWeeksAgo.toISOString())
          .lt("created_at", weekAgo.toISOString()),
      ]);

      const byStatus: Record<string, number> = {};
      for (const d of dealers.data ?? []) {
        byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      }

      setStats({
        dealersApproved: byStatus["approved"] ?? 0,
        dealersPending: byStatus["pending"] ?? 0,
        dealersSuspended: byStatus["suspended"] ?? 0,
        totalCars: cars.count ?? 0,
        totalLeads: leads.count ?? 0,
        totalStaff: staff.count ?? 0,
        leadsThisWeek: leadsThisWeek.count ?? 0,
        leadsLastWeek: leadsLastWeek.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="mb-6 border-b border-border pb-4">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-8 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-8 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const trend =
    stats.leadsLastWeek === 0
      ? null
      : Math.round(((stats.leadsThisWeek - stats.leadsLastWeek) / stats.leadsLastWeek) * 100);

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Platform-wide activity across all dealers." />

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Leads this week vs last week
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{stats.leadsThisWeek}</p>
          <p className="text-sm text-slate-400">vs {stats.leadsLastWeek} last week</p>
          {trend !== null && (
            <Badge tone={trend >= 0 ? "success" : "danger"}>
              {trend >= 0 ? "+" : ""}
              {trend}%
            </Badge>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Approved dealers" value={stats.dealersApproved} />
        <StatCard label="Pending dealers" value={stats.dealersPending} />
        <StatCard label="Suspended dealers" value={stats.dealersSuspended} />
        <StatCard label="Total cars" value={stats.totalCars} />
        <StatCard label="Total leads" value={stats.totalLeads} />
        <StatCard label="Total staff" value={stats.totalStaff} />
      </div>
    </div>
  );
}
