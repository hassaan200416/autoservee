"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import type { Car, CarPhoto } from "@autoserve/shared-types";

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [car, setCar] = useState<Car | null>(null);
  const [photos, setPhotos] = useState<(CarPhoto & { url: string })[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ make: "", model: "", year: "", price: "" });

  async function loadEverything() {
    const { data: carRow } = await supabase.from("cars").select("*").eq("id", id).maybeSingle();
    if (!carRow) { setLoading(false); return; }
    setCar(carRow as Car);
    setForm({
      make: carRow.make, model: carRow.model,
      year: String(carRow.year), price: String(carRow.price),
    });

    const { data: photoRows } = await supabase
      .from("car_photos").select("*").eq("car_id", id).order("sort_order");

    const withUrls = await Promise.all(
      (photoRows ?? []).map(async (p) => {
        const { data } = await supabase.storage.from("car-photos").createSignedUrl(p.storage_path, 3600);
        return { ...p, url: data?.signedUrl ?? "" };
      })
    );
    setPhotos(withUrls as (CarPhoto & { url: string })[]);

    const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("car_id", id);
    setLeadCount(count ?? 0);

    setLoading(false);
  }

  useEffect(() => { loadEverything(); }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from("cars").update({
      make: form.make, model: form.model, year: Number(form.year), price: Number(form.price),
    }).eq("id", id);
    setSaving(false);
    if (updateError) setError(updateError.message);
  }

  async function handleStatusChange(status: "available" | "reserved" | "sold") {
    const { error: statusError } = await supabase.from("cars").update({ status }).eq("id", id);
    if (statusError) { setError(statusError.message); return; }
    setCar((prev) => (prev ? { ...prev, status } : prev));
  }

  async function handleDelete() {
    if (leadCount > 0) {
      const confirmed = window.confirm(
        `${leadCount} lead${leadCount > 1 ? "s" : ""} reference this car. Deleting it will unlink them (they'll stay in the pipeline, just without a car attached). Continue?`
      );
      if (!confirmed) return;
    } else if (!window.confirm("Delete this car? This can't be undone.")) {
      return;
    }
    const { error: deleteError } = await supabase.from("cars").delete().eq("id", id);
    if (deleteError) { setError(deleteError.message); return; }
    router.push("/inventory");
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !car) return;
    setUploading(true);
    setError(null);

    const path = `${car.dealer_id}/${car.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("car-photos").upload(path, file);
    if (uploadError) { setError(uploadError.message); setUploading(false); return; }

    const { error: rowError } = await supabase.from("car_photos").insert({
      car_id: car.id, storage_path: path, sort_order: photos.length,
    });
    setUploading(false);
    if (rowError) { setError(rowError.message); return; }
    await loadEverything();
  }

  async function handlePhotoDelete(photo: CarPhoto) {
    await supabase.storage.from("car-photos").remove([photo.storage_path]);
    await supabase.from("car_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!car) return <p className="text-sm text-gray-500">Car not found.</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-lg font-medium">{car.year} {car.make} {car.model}</h1>

      <div className="mb-6 flex gap-2">
        {(["available", "reserved", "sold"] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              car.status === s ? "bg-black text-white" : "border text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="mb-8 flex flex-col gap-3">
        <input className="rounded-md border px-3 py-2" value={form.make}
          onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Make" />
        <input className="rounded-md border px-3 py-2" value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model" />
        <input className="rounded-md border px-3 py-2" type="number" value={form.year}
          onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Year" />
        <input className="rounded-md border px-3 py-2" type="number" value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={handleDelete}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
            Delete car
          </button>
        </div>
      </form>

      <h2 className="mb-2 text-sm font-medium">Photos</h2>
      <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="group relative">
            <img src={p.url} alt="" className="aspect-square rounded-md border object-cover" />
            <button onClick={() => handlePhotoDelete(p)}
              className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white opacity-0 group-hover:opacity-100">
              ×
            </button>
          </div>
        ))}
      </div>
      <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
      {uploading && <p className="text-sm text-gray-500">Uploading…</p>}
    </div>
  );
}
