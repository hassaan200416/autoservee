"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from "@autoserve/shared-ui";
import type { Car, Dealer, DealerStaff, DealerStatus, Lead } from "@autoserve/shared-types";

function statusTone(status: DealerStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  return "danger" as const;
}

export default function DealerDetailPage() {
  const params = useParams();
  const dealerId = params.id as string;
  const supabase = createSupabaseBrowserClient();

  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [counts, setCounts] = useState({ cars: 0, leads: 0, staff: 0 });
  const [cars, setCars] = useState<Car[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<DealerStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  async function load() {
    const [dealerRes, carsCount, leadsCount, staffCount, recentCars, recentLeads, roster] =
      await Promise.all([
        supabase.from("dealers").select("*").eq("id", dealerId).maybeSingle(),
        supabase.from("cars").select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
        supabase.from("dealer_staff").select("id", { count: "exact", head: true }).eq("dealer_id", dealerId),
        supabase
          .from("cars")
          .select("*")
          .eq("dealer_id", dealerId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("leads")
          .select("*")
          .eq("dealer_id", dealerId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("dealer_staff")
          .select("*")
          .eq("dealer_id", dealerId)
          .order("created_at", { ascending: true }),
      ]);

    if (!dealerRes.data) {
      setError("Dealer not found.");
      setLoading(false);
      return;
    }

    setDealer(dealerRes.data as Dealer);
    setCounts({
      cars: carsCount.count ?? 0,
      leads: leadsCount.count ?? 0,
      staff: staffCount.count ?? 0,
    });
    setCars((recentCars.data as Car[]) ?? []);
    setLeads((recentLeads.data as Lead[]) ?? []);
    setStaff((roster.data as DealerStaff[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [dealerId]);

  async function callApproveDealer(action: "approve" | "suspend") {
    setActionError(null);
    setActionLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/approve-dealer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dealer_id: dealerId, action }),
    });
    const result = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      setActionError(result.error ?? "Failed to update dealer status.");
      return;
    }
    load();
  }

  async function confirmSuspendDealer() {
    setConfirmSuspend(false);
    await callApproveDealer("suspend");
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-3 h-8 w-10" />
            </div>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 2 }).map((_, j) => (
              <Skeleton key={j} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error || !dealer) {
    return (
      <div className="max-w-3xl">
        <Link
          href="/dealers"
          className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dealers
        </Link>
        <EmptyState title="Dealer not found" description={error ?? undefined} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dealers"
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dealers
      </Link>

      <PageHeader
        title={dealer.name}
        description={`${dealer.city}${dealer.contact_phone ? ` · ${dealer.contact_phone}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(dealer.status)}>{dealer.status}</Badge>
            {dealer.status !== "suspended" ? (
              <Button
                variant="danger"
                disabled={actionLoading}
                onClick={() => setConfirmSuspend(true)}
              >
                Suspend
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={actionLoading}
                onClick={() => callApproveDealer("approve")}
              >
                Reactivate
              </Button>
            )}
          </div>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Cars" value={counts.cars} />
        <StatCard label="Leads" value={counts.leads} />
        <StatCard label="Staff" value={counts.staff} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-900">Recent cars</h2>
        {cars.length === 0 ? (
          <EmptyState title="No cars yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {cars.map((c) => (
              <Card key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {c.year} {c.make} {c.model}
                  </p>
                  <p className="text-xs text-slate-500">PKR {Number(c.price).toLocaleString()}</p>
                </div>
                <Badge tone={c.status === "available" ? "success" : c.status === "sold" ? "neutral" : "warning"}>
                  {c.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-900">Recent leads</h2>
        {leads.length === 0 ? (
          <EmptyState title="No leads yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {leads.map((l) => (
              <Card key={l.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{l.customer_name}</p>
                  <p className="text-xs text-slate-500">{l.source}</p>
                </div>
                <Badge tone="info">{l.stage.replace(/_/g, " ")}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-900">Staff roster</h2>
        {staff.length === 0 ? (
          <EmptyState title="No staff yet" />
        ) : (
          <div className="flex flex-col gap-2">
            {staff.map((s) => (
              <Card key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                  <p className="text-xs text-slate-500">{s.role}</p>
                </div>
                <Badge
                  tone={
                    s.status === "active" ? "success" : s.status === "invited" ? "warning" : "danger"
                  }
                >
                  {s.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmSuspend}
        title="Suspend this dealer?"
        description="The dealer and their staff will lose access to the platform until reactivated."
        confirmLabel="Suspend dealer"
        danger
        onConfirm={confirmSuspendDealer}
        onCancel={() => setConfirmSuspend(false)}
      />
    </div>
  );
}
