"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Step 1: real login goes straight through Supabase Auth, never a custom function.
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError(signInError.message); return; }

    // Step 2: post-login gate — checks dealer/staff status, not a replacement for login.
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-dealer-status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ app: "dealer" }),
    });
    const gate = await res.json();
    if (!gate.allowed) {
      await supabase.auth.signOut();
      setError(gate.reason === "dealer_suspended" ? "Your dealership account is suspended." : "Access not allowed.");
      return;
    }

    window.location.href = "/inventory";
  }

  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-4 text-lg font-medium">Dealer sign in</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <input className="border rounded-md px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="border rounded-md px-3 py-2" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white" type="submit">Sign in</button>
      </form>
    </main>
  );
}
