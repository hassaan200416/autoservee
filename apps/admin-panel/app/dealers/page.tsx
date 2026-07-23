"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from "@autoserve/shared-ui";
import type { Dealer, DealerStatus } from "@autoserve/shared-types";

function statusTone(status: DealerStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  return "danger" as const;
}

export default function DealersPage() {
  const supabase = createSupabaseBrowserClient();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    city: "",
    contact_phone: "",
    owner_email: "",
    owner_full_name: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadDealers() {
    const { data } = await supabase.from("dealers").select("*").order("created_at", { ascending: false });
    setDealers((data as Dealer[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadDealers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q) ||
        (d.contact_phone ?? "").toLowerCase().includes(q)
    );
  }, [dealers, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.city || !form.owner_email) {
      setFormError("Name, city, and owner email are required.");
      return;
    }
    setFormError(null);
    setCreating(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-dealer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    setCreating(false);
    if (!res.ok) {
      setFormError(result.error ?? "Failed to create dealer.");
      return;
    }

    setForm({ name: "", city: "", contact_phone: "", owner_email: "", owner_full_name: "" });
    loadDealers();
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="mb-6 border-b border-border pb-4">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <Skeleton className="mb-4 h-4 w-28" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="mb-1.5 h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
            <Skeleton className="h-10 w-52 rounded-lg" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-56 rounded-lg" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Dealers" description="Create dealers and invite owners." />

      <Card>
        <h2 className="mb-4 text-sm font-medium text-slate-900">Add a dealer</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Field label="Dealer name" htmlFor="dealer-name">
            <Input
              id="dealer-name"
              placeholder="e.g. City Motors"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="City" htmlFor="dealer-city">
            <Input
              id="dealer-city"
              placeholder="e.g. Karachi"
              value={form.city}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <Field label="Contact phone" htmlFor="dealer-phone" hint="Optional">
            <Input
              id="dealer-phone"
              placeholder="+92 300 1234567"
              value={form.contact_phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, contact_phone: e.target.value })
              }
            />
          </Field>
          <Field label="Owner email" htmlFor="owner-email">
            <Input
              id="owner-email"
              type="email"
              placeholder="owner@dealership.com"
              value={form.owner_email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, owner_email: e.target.value })
              }
            />
          </Field>
          <Field label="Owner full name" htmlFor="owner-name" hint="Optional">
            <Input
              id="owner-name"
              placeholder="Full name"
              value={form.owner_full_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, owner_full_name: e.target.value })
              }
            />
          </Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button type="submit" disabled={creating} className="self-start">
            {creating ? "Creating…" : "Create dealer and invite owner"}
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-slate-900">All dealers</h2>
        <Input
          className="max-w-xs"
          placeholder="Search name, city, status…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={dealers.length === 0 ? "No dealers yet" : "No matches"}
          description={
            dealers.length === 0
              ? "Create a dealer above to invite an owner."
              : "Try a different search."
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((d) => (
            <Link
              key={d.id}
              href={`/dealers/${d.id}`}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-white p-3 shadow-sm transition-colors hover:border-accent/40"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{d.name}</p>
                <p className="text-xs text-slate-500">{d.city}</p>
              </div>
              <Badge tone={statusTone(d.status)}>{d.status}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
