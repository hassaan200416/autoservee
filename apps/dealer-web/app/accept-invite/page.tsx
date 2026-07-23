"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { Button, Field, Input } from "@autoserve/shared-ui";

export default function AcceptInvitePage() {
  const supabase = createSupabaseBrowserClient();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function takeOverSession() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");

      if (!access_token || !refresh_token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) setInvalid(true);
        setReady(true);
        return;
      }

      await supabase.auth.signOut();
      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionError) { setInvalid(true); setReady(true); return; }
      setReady(true);
    }
    takeOverSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Session expired — ask your owner to resend the invite."); setSaving(false); return; }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) { setError(updateError.message); setSaving(false); return; }

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/check-dealer-status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ app: "dealer" }),
    });
    const gate = await res.json();
    setSaving(false);

    if (!gate.allowed) {
      setError(
        gate.reason === "admins_use_admin_panel_only"
          ? "This account is an admin — use the admin panel."
          : "Your account isn't active on this dealer yet — contact your owner."
      );
      return;
    }
    window.location.href = "/home";
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <p className="text-sm text-slate-500">Setting up your account…</p>
      </main>
    );
  }

  if (invalid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-[400px] rounded-2xl border border-border bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-accent">AutoServe</p>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Link expired</h1>
          <p className="mt-3 text-sm text-red-600">
            This invite or reset link is invalid or has expired. Ask your owner to send a new one, or request another password reset.
          </p>
          <p className="mt-6 text-center text-sm">
            <Link href="/forgot-password" className="font-medium text-accent hover:underline">
              Request password reset
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-[400px] rounded-2xl border border-border bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-accent">AutoServe</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Set your password</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a password to finish setting up your account.</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Field label="New password" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting up…
              </>
            ) : (
              "Set password and continue"
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
