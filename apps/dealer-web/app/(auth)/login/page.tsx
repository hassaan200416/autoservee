"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Button, Field, Input } from "@autoserve/shared-ui";

function reasonMessage(reason: string | null): string | null {
  if (reason === "suspended") return "Your dealership account is suspended. Contact AutoServe support.";
  if (reason === "deactivated") return "Your staff account is deactivated. Ask your owner to reactivate you.";
  return null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const gateReason = reasonMessage(searchParams.get("reason"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(gateReason);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-dealer-status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ app: "dealer" }),
    });
    const gate = await res.json();
    if (!gate.allowed) {
      await supabase.auth.signOut();
      setError(
        gate.reason === "dealer_suspended"
          ? "Your dealership account is suspended."
          : gate.reason === "staff_deactivated"
            ? "Your staff account is deactivated."
            : "Access not allowed."
      );
      setLoading(false);
      return;
    }
    window.location.href = "/home";
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-primary p-10 text-white lg:flex">
        <div>
          <p className="text-sm font-semibold tracking-wide text-sky-300">AutoServe</p>
          <h1 className="mt-10 max-w-md text-3xl font-semibold leading-tight tracking-tight">
            The operating system for your dealership floor.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
            Keep PakWheels for reach. Run inventory, lead follow-ups, and staff accountability in one place — so nothing disappears when a salesman leaves.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
          <p className="font-medium text-white">Built for daily use</p>
          <ul className="space-y-2 text-slate-300">
            <li>· Track every lead after the first call</li>
            <li>· Know who owns which customer</li>
            <li>· Keep car status honest across the team</li>
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <p className="text-sm font-semibold text-accent">AutoServe</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1.5 text-sm text-slate-500">Dealer staff access — inventory, leads, and team.</p>

          <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@dealership.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} className="mt-1 w-full" size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/forgot-password" className="font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</main>}>
      <LoginForm />
    </Suspense>
  );
}
