import Link from "next/link";
import { Button, Badge } from "@autoserve/shared-ui";

const SAMPLE_CARS = [
  {
    id: "1",
    year: 2021,
    make: "Toyota",
    model: "Corolla",
    price: 4_850_000,
    city: "Lahore",
    mileage: 42000,
    transmission: "Automatic",
    fuel: "Petrol",
  },
  {
    id: "2",
    year: 2020,
    make: "Honda",
    model: "Civic",
    price: 6_200_000,
    city: "Karachi",
    mileage: 38000,
    transmission: "Automatic",
    fuel: "Petrol",
  },
  {
    id: "3",
    year: 2019,
    make: "Suzuki",
    model: "Swift",
    price: 3_150_000,
    city: "Islamabad",
    mileage: 51000,
    transmission: "Manual",
    fuel: "Petrol",
  },
  {
    id: "4",
    year: 2022,
    make: "Kia",
    model: "Sportage",
    price: 8_900_000,
    city: "Lahore",
    mileage: 22000,
    transmission: "Automatic",
    fuel: "Petrol",
  },
  {
    id: "5",
    year: 2018,
    make: "Toyota",
    model: "Fortuner",
    price: 11_500_000,
    city: "Faisalabad",
    mileage: 67000,
    transmission: "Automatic",
    fuel: "Diesel",
  },
  {
    id: "6",
    year: 2023,
    make: "Hyundai",
    model: "Tucson",
    price: 9_750_000,
    city: "Karachi",
    mileage: 12000,
    transmission: "Automatic",
    fuel: "Petrol",
  },
];

function formatPrice(n: number) {
  return `PKR ${n.toLocaleString("en-PK")}`;
}

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
        Preview for dealers — not a live marketplace yet
      </div>

      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <p className="text-lg font-semibold tracking-tight text-primary">AutoServe</p>
          <p className="text-xs text-slate-500 sm:text-sm">Buyer browse mock</p>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #38bdf8 0%, transparent 45%), radial-gradient(circle at 80% 70%, #0369A1 0%, transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="mb-3 text-sm font-medium text-sky-300">AutoServe</p>
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Find your next car
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
            Browse inventory from trusted dealers — then talk directly with the dealership that listed it.
          </p>
          <div className="mt-6">
            <a href="#listings">
              <Button className="bg-accent hover:bg-sky-700">Browse cars</Button>
            </a>
          </div>
        </div>
      </section>

      <section id="listings" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight text-primary">Featured listings</h2>
          <p className="mt-1 text-sm text-slate-500">Sample data for the dealer pitch — not connected to live inventory.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_CARS.map((car) => (
            <article
              key={car.id}
              className="flex flex-col border border-border bg-white transition-colors hover:border-accent/50"
            >
              <div className="flex h-36 items-end bg-gradient-to-br from-slate-100 to-slate-200 px-4 py-3">
                <Badge tone="info">{car.city}</Badge>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  {car.year} {car.make} {car.model}
                </h3>
                <p className="mt-1 text-base font-semibold text-accent">{formatPrice(car.price)}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {car.mileage.toLocaleString()} km · {car.transmission} · {car.fuel}
                </p>
                <div className="mt-4">
                  <Button variant="secondary" className="w-full text-xs" type="button" disabled>
                    Talk to dealer
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Dealers run inventory and leads in AutoServe.{" "}
          <Link href="/login" className="cursor-pointer font-medium text-accent hover:underline">
            Sign in to the dealer app
          </Link>
        </p>
      </section>
    </div>
  );
}
