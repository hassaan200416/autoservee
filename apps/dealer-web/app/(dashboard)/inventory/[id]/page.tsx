"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Button, ConfirmDialog, Input, PageHeader, Select, Skeleton } from "@autoserve/shared-ui";
import { useToast } from "@autoserve/shared-ui/toast";
import type {
  Car,
  CarCondition,
  CarFuelType,
  CarPhoto,
  CarStatus,
  CarTransmission,
} from "@autoserve/shared-types";

type CarForm = {
  make: string;
  model: string;
  year: string;
  price: string;
  mileage: string;
  color: string;
  transmission: "" | CarTransmission;
  fuel_type: "" | CarFuelType;
  condition: "" | CarCondition;
};

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();

  const [car, setCar] = useState<Car | null>(null);
  const [photos, setPhotos] = useState<(CarPhoto & { url: string })[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<CarForm>({
    make: "",
    model: "",
    year: "",
    price: "",
    mileage: "",
    color: "",
    transmission: "",
    fuel_type: "",
    condition: "",
  });

  async function loadEverything() {
    const { data: carRow } = await supabase.from("cars").select("*").eq("id", id).maybeSingle();
    if (!carRow) {
      setLoading(false);
      return;
    }
    setCar(carRow as Car);
    setForm({
      make: carRow.make,
      model: carRow.model,
      year: String(carRow.year),
      price: String(carRow.price),
      mileage: carRow.mileage != null ? String(carRow.mileage) : "",
      color: carRow.color ?? "",
      transmission: (carRow.transmission as CarTransmission | null) ?? "",
      fuel_type: (carRow.fuel_type as CarFuelType | null) ?? "",
      condition: (carRow.condition as CarCondition | null) ?? "",
    });

    const { data: photoRows } = await supabase
      .from("car_photos")
      .select("*")
      .eq("car_id", id)
      .order("sort_order");

    const withUrls = await Promise.all(
      (photoRows ?? []).map(async (p) => {
        const { data } = await supabase.storage
          .from("car-photos")
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, url: data?.signedUrl ?? "" };
      })
    );
    setPhotos(withUrls as (CarPhoto & { url: string })[]);

    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("car_id", id);
    setLeadCount(count ?? 0);

    setLoading(false);
  }

  useEffect(() => {
    loadEverything();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("cars")
      .update({
        make: form.make,
        model: form.model,
        year: Number(form.year),
        price: Number(form.price),
        mileage: form.mileage ? Number(form.mileage) : null,
        color: form.color.trim() || null,
        transmission: form.transmission || null,
        fuel_type: form.fuel_type || null,
        condition: form.condition || null,
      })
      .eq("id", id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      toast(updateError.message, "error");
      return;
    }
    toast("Car saved", "success");
    loadEverything();
  }

  async function handleStatusChange(status: CarStatus) {
    const { error: statusError } = await supabase
      .from("cars")
      .update({ status })
      .eq("id", id);
    if (statusError) {
      setError(statusError.message);
      toast(statusError.message, "error");
      return;
    }
    setCar((prev) => (prev ? { ...prev, status } : prev));
    toast(`Marked ${status}`, "success");
  }

  async function handleDelete() {
    setConfirmDelete(true);
  }

  async function confirmDeleteCar() {
    setConfirmDelete(false);
    const { error: deleteError } = await supabase.from("cars").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      toast(deleteError.message, "error");
      return;
    }
    router.push("/inventory");
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !car) return;
    setUploading(true);
    setError(null);

    const path = `${car.dealer_id}/${car.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("car-photos").upload(path, file);
    if (uploadError) {
      setError(uploadError.message);
      toast(uploadError.message, "error");
      setUploading(false);
      return;
    }

    const { error: rowError } = await supabase.from("car_photos").insert({
      car_id: car.id,
      storage_path: path,
      sort_order: photos.length,
    });
    setUploading(false);
    if (rowError) {
      setError(rowError.message);
      toast(rowError.message, "error");
      return;
    }
    toast("Photo uploaded", "success");
    await loadEverything();
  }

  async function handlePhotoDelete(photo: CarPhoto) {
    await supabase.storage.from("car-photos").remove([photo.storage_path]);
    await supabase.from("car_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= photos.length) return;

    const reordered = [...photos];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];

    setPhotos(reordered);

    await Promise.all(
      reordered.map((p, i) =>
        supabase.from("car_photos").update({ sort_order: i }).eq("id", p.id)
      )
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="mb-6 border-b border-border pb-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-1.5 h-3 w-16" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
        <div>
          <Skeleton className="mb-2 h-4 w-16" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (!car) return <p className="text-sm text-slate-500">Car not found.</p>;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`${car.year} ${car.make} ${car.model}`}
        description="Update specs, status, and photos."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {(["available", "reserved", "sold"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleStatusChange(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              car.status === s
                ? "bg-accent text-white"
                : "border border-border text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="mb-8 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Make</label>
            <Input
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
              placeholder="Make"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Model</label>
            <Input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="Model"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Year</label>
            <Input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              placeholder="Year"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Price (PKR)</label>
            <Input
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="Price"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Mileage (km)</label>
            <Input
              type="number"
              value={form.mileage}
              onChange={(e) => setForm({ ...form, mileage: e.target.value })}
              placeholder="Mileage"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Color</label>
            <Input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="Color"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Transmission</label>
          <Select
            value={form.transmission}
            onChange={(e) =>
              setForm({ ...form, transmission: e.target.value as "" | CarTransmission })
            }
          >
            <option value="">Not set</option>
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Fuel type</label>
          <Select
            value={form.fuel_type}
            onChange={(e) =>
              setForm({ ...form, fuel_type: e.target.value as "" | CarFuelType })
            }
          >
            <option value="">Not set</option>
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="electric">Electric</option>
            <option value="cng">CNG</option>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Condition</label>
          <Select
            value={form.condition}
            onChange={(e) =>
              setForm({ ...form, condition: e.target.value as "" | CarCondition })
            }
          >
            <option value="">Not set</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
          </Select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete}>
            Delete car
          </Button>
        </div>
      </form>

      <h2 className="mb-2 text-sm font-medium text-slate-900">Photos</h2>
      <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((p, i) => (
          <div key={p.id} className="group relative">
            <img
              src={p.url}
              alt=""
              className="aspect-square rounded-md border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => handlePhotoDelete(p)}
              className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white opacity-0 group-hover:opacity-100"
            >
              ×
            </button>
            <div className="absolute bottom-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => movePhoto(i, -1)}
                disabled={i === 0}
                className="rounded bg-black/70 px-1.5 text-xs text-white disabled:opacity-30"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => movePhoto(i, 1)}
                disabled={i === photos.length - 1}
                className="rounded bg-black/70 px-1.5 text-xs text-white disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
        ))}
      </div>
      <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
      {uploading && <p className="mt-1 text-sm text-slate-500">Uploading…</p>}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this car?"
        description={
          leadCount > 0
            ? `${leadCount} lead${leadCount > 1 ? "s" : ""} reference this car. Deleting it will unlink them (they'll stay in the pipeline, just without a car attached). This can't be undone.`
            : "This will permanently remove the car and its photos. This can't be undone."
        }
        confirmLabel="Delete car"
        danger
        onConfirm={confirmDeleteCar}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
