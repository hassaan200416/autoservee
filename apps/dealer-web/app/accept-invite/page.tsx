"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";

export default function AcceptInvitePage() {
  const supabase = createSupabaseBrowserClient();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase's client auto-parses the access_token from the URL hash on load
    // and sets a session — we just need to wait a moment for that to happen.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setInvalid(true); }
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setSaving(false); return; }

    // Now that they have a real session + password, run the same gate as normal
    // login — this is what flips their dealer_staff.status from invited to active.
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-dealer-status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ app: "dealer" }),
    });
    const gate = await res.json();
    setSaving(false);

    if (!gate.allowed) {
      setError("Your account isn't active on this dealer yet — contact your owner.");
      return;
    }
    window.location.href = "/inventory";
  }

  if (!ready) return <p className="p-8 text-sm text-gray-500">Checking invite…</p>;
  if (invalid) return <p className="p-8 text-sm text-red-600">This invite link is invalid or has expired. Ask your owner to send a new one.</p>;

  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-4 text-lg font-medium">Set your password</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className="rounded-md border px-3 py-2" type="password" placeholder="New password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input className="rounded-md border px-3 py-2" type="password" placeholder="Confirm password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={saving} className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
          {saving ? "Setting up…" : "Set password and continue"}
        </button>
      </form>
    </main>
  );
}
