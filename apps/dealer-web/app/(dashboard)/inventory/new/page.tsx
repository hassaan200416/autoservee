"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Button, Field, Input, PageHeader, Select } from "@autoserve/shared-ui";
import type { CarCondition, CarFuelType, CarTransmission } from "@autoserve/shared-types";

export default function NewCarPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [form, setForm] = useState({
    make: "",
    model: "",
    year: "",
    price: "",
    mileage: "",
    color: "",
    transmission: "" as "" | CarTransmission,
    fuel_type: "" as "" | CarFuelType,
    condition: "" as "" | CarCondition,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.make || !form.model || !form.year || !form.price) {
      setError("Make, model, year, and price are required.");
      return;
    }

    setSaving(true);
    setProgress("Saving car details…");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase
      .from("dealer_staff")
      .select("id, dealer_id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!staffRow) {
      setError("Could not determine your dealer account.");
      setSaving(false);
      setProgress(null);
      return;
    }

    const { data: car, error: insertError } = await supabase
      .from("cars")
      .insert({
        dealer_id: staffRow.dealer_id,
        make: form.make,
        model: form.model,
        year: Number(form.year),
        price: Number(form.price),
        mileage: form.mileage ? Number(form.mileage) : null,
        color: form.color.trim() || null,
        transmission: form.transmission || null,
        fuel_type: form.fuel_type || null,
        condition: form.condition || null,
        created_by: staffRow.id,
      })
      .select("id")
      .single();

    if (insertError || !car) {
      setError(insertError?.message ?? "Failed to save car.");
      setSaving(false);
      setProgress(null);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      setProgress(`Uploading photo ${i + 1} of ${files.length}…`);
      const file = files[i];
      const path = `${staffRow.dealer_id}/${car.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("car-photos").upload(path, file);
      if (uploadError) continue;
      await supabase.from("car_photos").insert({ car_id: car.id, storage_path: path, sort_order: i });
    }

    setSaving(false);
    setProgress(null);
    router.push("/inventory");
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Add a car" description="Core details first — photos optional." />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Make" htmlFor="make">
          <Input
            id="make"
            placeholder="e.g. Toyota"
            value={form.make}
            onChange={(e) => setForm({ ...form, make: e.target.value })}
          />
        </Field>
        <Field label="Model" htmlFor="model">
          <Input
            id="model"
            placeholder="e.g. Corolla"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Year" htmlFor="year">
            <Input
              id="year"
              type="number"
              placeholder="2020"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </Field>
          <Field label="Price (PKR)" htmlFor="price">
            <Input
              id="price"
              type="number"
              placeholder="4500000"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mileage (km)" htmlFor="mileage">
            <Input
              id="mileage"
              type="number"
              placeholder="45000"
              value={form.mileage}
              onChange={(e) => setForm({ ...form, mileage: e.target.value })}
            />
          </Field>
          <Field label="Color" htmlFor="color">
            <Input
              id="color"
              placeholder="White"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Transmission" htmlFor="transmission">
          <Select
            id="transmission"
            value={form.transmission}
            onChange={(e) =>
              setForm({ ...form, transmission: e.target.value as "" | CarTransmission })
            }
          >
            <option value="">Not set</option>
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
          </Select>
        </Field>
        <Field label="Fuel type" htmlFor="fuel-type">
          <Select
            id="fuel-type"
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
        </Field>
        <Field label="Condition" htmlFor="condition">
          <Select
            id="condition"
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
        </Field>

        <Field label="Photos (optional)" htmlFor="photos">
          <input id="photos" type="file" accept="image/*" multiple onChange={handleFilesSelected} />
          {files.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {files.map((file, i) => (
                <div key={i} className="group relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="aspect-square rounded-md border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-white opacity-0 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={saving}>
          {progress ?? "Add car"}
        </Button>
      </form>
    </div>
  );
}
