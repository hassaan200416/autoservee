"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import type { Car } from "@autoserve/shared-types";

type CarWithThumbnail = Car & { thumbnailUrl: string | null };

export default function InventoryPage() {
  const [cars, setCars] = useState<CarWithThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function loadCars() {
      const { data, error } = await supabase
        .from("cars")
        .select("*, car_photos(storage_path, sort_order)")
        .order("created_at", { ascending: false })
        .order("sort_order", { foreignTable: "car_photos" });

      if (error || !data) { setLoading(false); return; }

      const withThumbnails = await Promise.all(
        data.map(async (car: any) => {
          const firstPhoto = car.car_photos?.[0];
          let thumbnailUrl: string | null = null;
          if (firstPhoto) {
            const { data: signed } = await supabase.storage
              .from("car-photos")
              .createSignedUrl(firstPhoto.storage_path, 3600);
            thumbnailUrl = signed?.signedUrl ?? null;
          }
          const { car_photos, ...rest } = car;
          return { ...rest, thumbnailUrl } as CarWithThumbnail;
        })
      );

      setCars(withThumbnails);
      setLoading(false);
    }
    loadCars();
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading inventory…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">Inventory</h1>
        <Link href="/inventory/new" className="rounded-md bg-black px-4 py-2 text-sm text-white">
          Add car
        </Link>
      </div>

      {cars.length === 0 ? (
        <p className="text-sm text-gray-500">No cars yet — add your first one.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((car) => (
            <Link key={car.id} href={`/inventory/${car.id}`} className="block overflow-hidden rounded-lg border hover:border-gray-400">
              <div className="aspect-video bg-gray-100">
                {car.thumbnailUrl ? (
                  <img src={car.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">No photo</div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{car.year} {car.make} {car.model}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    car.status === "available" ? "bg-green-100 text-green-800" :
                    car.status === "reserved" ? "bg-amber-100 text-amber-800" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {car.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">PKR {Number(car.price).toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
