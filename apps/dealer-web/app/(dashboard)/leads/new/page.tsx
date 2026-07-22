"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import type { Car, LeadSource } from "@autoserve/shared-types";

const SOURCES: LeadSource[] = ["pakwheels", "walk_in", "referral", "phone", "website", "other"];

export default function NewLeadPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [cars, setCars] = useState<Car[]>([]);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", source: "other" as LeadSource, car_id: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("cars").select("*").eq("status", "available").then(({ data }) => setCars((data as Car[]) ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name) { setError("Customer name is required."); return; }
    setError(null);
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase.from("dealer_staff").select("dealer_id").eq("user_id", user!.id).maybeSingle();
    if (!staffRow) { setError("Could not determine your dealer account."); setSaving(false); return; }

    const { error: insertError } = await supabase.from("leads").insert({
      dealer_id: staffRow.dealer_id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      source: form.source,
      car_id: form.car_id || null,
    });

    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    router.push("/leads");
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-lg font-medium">Add a lead</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className="rounded-md border px-3 py-2" placeholder="Customer name"
          value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
        <input className="rounded-md border px-3 py-2" placeholder="Phone (optional)"
          value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
        <select className="rounded-md border px-3 py-2" value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <select className="rounded-md border px-3 py-2" value={form.car_id}
          onChange={(e) => setForm({ ...form, car_id: e.target.value })}>
          <option value="">No car linked yet</option>
          {cars.map((c) => (
            <option key={c.id} value={c.id}>{c.year} {c.make} {c.model} — PKR {Number(c.price).toLocaleString()}</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {saving ? "Saving…" : "Add lead"}
        </button>
      </form>
    </div>
  );
}
