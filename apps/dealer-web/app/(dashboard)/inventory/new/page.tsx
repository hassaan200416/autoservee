"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";

export default function NewCarPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [form, setForm] = useState({ make: "", model: "", year: "", price: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.make || !form.model || !form.year || !form.price) {
      setError("All fields are required.");
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase
      .from("dealer_staff").select("id, dealer_id").eq("user_id", user!.id).maybeSingle();

    if (!staffRow) {
      setError("Could not determine your dealer account.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("cars").insert({
      dealer_id: staffRow.dealer_id,
      make: form.make,
      model: form.model,
      year: Number(form.year),
      price: Number(form.price),
      created_by: staffRow.id,
    });

    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    router.push("/inventory");
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-lg font-medium">Add a car</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className="rounded-md border px-3 py-2" placeholder="Make (e.g. Toyota)"
          value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
        <input className="rounded-md border px-3 py-2" placeholder="Model (e.g. Corolla)"
          value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        <input className="rounded-md border px-3 py-2" placeholder="Year" type="number"
          value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
        <input className="rounded-md border px-3 py-2" placeholder="Price (PKR)" type="number"
          value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {saving ? "Saving…" : "Add car"}
        </button>
      </form>
    </div>
  );
}
