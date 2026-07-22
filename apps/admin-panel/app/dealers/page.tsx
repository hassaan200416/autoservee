"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import type { Dealer } from "@autoserve/shared-types";

export default function DealersPage() {
  const supabase = createSupabaseBrowserClient();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ name: "", city: "", contact_phone: "", owner_email: "", owner_full_name: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function loadDealers() {
    const { data } = await supabase.from("dealers").select("*").order("created_at", { ascending: false });
    setDealers((data as Dealer[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadDealers(); }, []);

  async function callApproveDealer(dealer_id: string, action: "approve" | "suspend") {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/approve-dealer`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dealer_id, action }),
    });
    const result = await res.json();
    if (!res.ok) { alert(result.error ?? "Failed."); return; }
    loadDealers();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.city || !form.owner_email) {
      setFormError("Name, city, and owner email are required.");
      return;
    }
    setFormError(null);
    setCreating(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-dealer`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    setCreating(false);
    if (!res.ok) { setFormError(result.error ?? "Failed to create dealer."); return; }

    setForm({ name: "", city: "", contact_phone: "", owner_email: "", owner_full_name: "" });
    loadDealers();
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-lg font-medium">Dealers</h1>

      <form onSubmit={handleCreate} className="mb-8 flex flex-col gap-3 rounded-md border p-4">
        <h2 className="text-sm font-medium">Add a dealer</h2>
        <input className="rounded-md border px-3 py-2 text-sm" placeholder="Dealer name"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded-md border px-3 py-2 text-sm" placeholder="City"
          value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input className="rounded-md border px-3 py-2 text-sm" placeholder="Contact phone (optional)"
          value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        <input className="rounded-md border px-3 py-2 text-sm" placeholder="Owner email"
          value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
        <input className="rounded-md border px-3 py-2 text-sm" placeholder="Owner full name (optional)"
          value={form.owner_full_name} onChange={(e) => setForm({ ...form, owner_full_name: e.target.value })} />
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <button disabled={creating} className="self-start rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {creating ? "Creating…" : "Create dealer and invite owner"}
        </button>
      </form>

      <h2 className="mb-2 text-sm font-medium">All dealers</h2>
      <div className="flex flex-col gap-2">
        {dealers.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-gray-500">{d.city} · {d.status}</p>
            </div>
            {d.status !== "suspended" ? (
              <button onClick={() => callApproveDealer(d.id, "suspend")}
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                Suspend
              </button>
            ) : (
              <button onClick={() => callApproveDealer(d.id, "approve")}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                Reactivate
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
