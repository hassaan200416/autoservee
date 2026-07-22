"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";

export default function OverviewPage() {
  const supabase = createSupabaseBrowserClient();
  const [stats, setStats] = useState<{
    dealersApproved: number; dealersPending: number; dealersSuspended: number;
    totalCars: number; totalLeads: number; totalStaff: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const [dealers, cars, leads, staff] = await Promise.all([
        supabase.from("dealers").select("status"),
        supabase.from("cars").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("dealer_staff").select("id", { count: "exact", head: true }),
      ]);

      const byStatus = (dealers.data ?? []).reduce(
        (acc: Record<string, number>, d) => ({ ...acc, [d.status]: (acc[d.status] ?? 0) + 1 }),
        {}
      );

      setStats({
        dealersApproved: byStatus.approved ?? 0,
        dealersPending: byStatus.pending ?? 0,
        dealersSuspended: byStatus.suspended ?? 0,
        totalCars: cars.count ?? 0,
        totalLeads: leads.count ?? 0,
        totalStaff: staff.count ?? 0,
      });
    }
    load();
  }, []);

  if (!stats) return <p className="text-sm text-gray-500">Loading…</p>;

  const cards = [
    { label: "Approved dealers", value: stats.dealersApproved },
    { label: "Pending dealers", value: stats.dealersPending },
    { label: "Suspended dealers", value: stats.dealersSuspended },
    { label: "Total cars", value: stats.totalCars },
    { label: "Total leads", value: stats.totalLeads },
    { label: "Total staff", value: stats.totalStaff },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-medium">Overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border p-4">
            <p className="text-2xl font-medium">{c.value}</p>
            <p className="text-sm text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
