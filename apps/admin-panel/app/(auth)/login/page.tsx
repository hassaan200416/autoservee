"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Button, Field, Input } from "@autoserve/shared-ui";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("reason") === "not_admin" ? "Admin access only." : null
  );
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
      body: JSON.stringify({ app: "admin" }),
    });
    const gate = await res.json();
    if (!gate.allowed || gate.role !== "admin") {
      await supabase.auth.signOut();
      setError("Admin access only.");
      setLoading(false);
      return;
    }
    window.location.href = "/overview";
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-primary p-10 text-white lg:flex">
        <div>
          <p className="text-sm font-semibold tracking-wide text-sky-300">AutoServe Admin</p>
          <h1 className="mt-10 max-w-md text-3xl font-semibold leading-tight">
            Platform control for onboarding and oversight.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-slate-300">
            Approve dealers, monitor usage, and keep the network clean — away from the public product.
          </p>
        </div>
        <p className="text-xs text-slate-500">Founders only · not customer-facing</p>
      </section>
      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px]">
          <h2 className="text-2xl font-semibold text-slate-900">Admin sign in</h2>
          <p className="mt-1.5 text-sm text-slate-500">Restricted to platform administrators.</p>
          <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1.5 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
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
