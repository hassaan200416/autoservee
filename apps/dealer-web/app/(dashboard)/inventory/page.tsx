"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Badge, EmptyState, Input, PageHeader, Select, Skeleton } from "@autoserve/shared-ui";
import type { Car, CarStatus } from "@autoserve/shared-types";

type CarWithThumbnail = Car & { thumbnailUrl: string | null };
type SortKey = "newest" | "price_low" | "price_high";

function statusTone(status: CarStatus): "success" | "warning" | "neutral" {
  if (status === "available") return "success";
  if (status === "reserved") return "warning";
  return "neutral";
}

export default function InventoryPage() {
  const [cars, setCars] = useState<CarWithThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CarStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    async function loadCars() {
      const { data, error } = await supabase
        .from("cars")
        .select("*, car_photos(storage_path, sort_order)")
        .order("created_at", { ascending: false })
        .order("sort_order", { foreignTable: "car_photos" });

      if (error || !data) {
        setLoading(false);
        return;
      }

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

  const filtered = useMemo(() => {
    let result = cars;

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.make.toLowerCase().includes(q) ||
          c.model.toLowerCase().includes(q) ||
          String(c.year).includes(q) ||
          (c.color ?? "").toLowerCase().includes(q)
      );
    }

    const sorted = [...result];
    if (sort === "price_low") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price_high") sorted.sort((a, b) => Number(b.price) - Number(a.price));

    return sorted;
  }, [cars, search, statusFilter, sort]);

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Skeleton className="h-10 min-w-[200px] flex-1 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock with photos, mileage, and status at a glance."
        action={
          <Link
            href="/inventory/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800"
          >
            <Plus className="h-4 w-4" />
            Add car
          </Link>
        }
      />

      {cars.length === 0 ? (
        <EmptyState title="No cars yet" description="Add your first car to start the lot." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              className="min-w-[200px] flex-1"
              placeholder="Search make, model, year, color…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              className="w-auto min-w-[140px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CarStatus | "all")}
            >
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="sold">Sold</option>
            </Select>
            <Select
              className="w-auto min-w-[160px]"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="newest">Newest first</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No cars match your search.</p>
          ) : (
            <p className="mb-2 text-xs text-slate-400">
              {filtered.length} of {cars.length} cars
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((car) => (
              <Link
                key={car.id}
                href={`/inventory/${car.id}`}
                className="block overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-colors hover:border-accent/40 hover:shadow-md"
              >
                <div className="aspect-video bg-slate-100">
                  {car.thumbnailUrl ? (
                    <img
                      src={car.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      No photo
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-900">
                      {car.year} {car.make} {car.model}
                    </p>
                    <Badge tone={statusTone(car.status)}>{car.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    PKR {Number(car.price).toLocaleString()}
                  </p>
                  {(car.mileage != null || car.color) && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      {[
                        car.mileage != null
                          ? `${Number(car.mileage).toLocaleString()} km`
                          : null,
                        car.color,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
