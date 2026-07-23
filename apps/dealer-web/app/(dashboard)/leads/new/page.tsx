"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Button, Field, Input, PageHeader, Select } from "@autoserve/shared-ui";
import { LEAD_SOURCES, type Car, type LeadSource } from "@autoserve/shared-types";

export default function NewLeadPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [cars, setCars] = useState<Car[]>([]);
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    source: "other" as LeadSource,
    car_id: "",
    next_follow_up_at: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("cars")
      .select("*")
      .eq("status", "available")
      .then(({ data }) => setCars((data as Car[]) ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name) {
      setError("Customer name is required.");
      return;
    }
    setError(null);
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase
      .from("dealer_staff")
      .select("dealer_id")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (!staffRow) {
      setError("Could not determine your dealer account.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("leads").insert({
      dealer_id: staffRow.dealer_id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      source: form.source,
      car_id: form.car_id || null,
      next_follow_up_at: form.next_follow_up_at
        ? new Date(form.next_follow_up_at).toISOString()
        : null,
      notes: form.notes.trim() || null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push("/leads");
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Add a lead" description="Capture the contact and when to follow up." />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Customer name" htmlFor="customer-name">
          <Input
            id="customer-name"
            placeholder="Full name"
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            required
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input
            id="phone"
            placeholder="03XX XXXXXXX"
            value={form.customer_phone}
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
          />
        </Field>
        <Field label="Source" htmlFor="source">
          <Select
            id="source"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
          >
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Linked car" htmlFor="car-id">
          <Select
            id="car-id"
            value={form.car_id}
            onChange={(e) => setForm({ ...form, car_id: e.target.value })}
          >
            <option value="">No car linked yet</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.year} {c.make} {c.model} — PKR {Number(c.price).toLocaleString()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next follow-up" htmlFor="follow-up">
          <Input
            id="follow-up"
            type="datetime-local"
            value={form.next_follow_up_at}
            onChange={(e) => setForm({ ...form, next_follow_up_at: e.target.value })}
          />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-sky-100"
            rows={3}
            placeholder="Context, budget, preferences…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Add lead"}
        </Button>
      </form>
    </div>
  );
}
