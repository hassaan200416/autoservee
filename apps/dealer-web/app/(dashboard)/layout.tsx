"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<"owner" | "staff" | null>(null);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    async function loadRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("dealer_staff")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      setRole((data?.role as "owner" | "staff") ?? null);
    }
    loadRole();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6 text-sm">
          <span className="font-medium">AutoServe</span>
          <Link href="/inventory" className="text-gray-600 hover:text-black">Inventory</Link>
          <Link href="/leads" className="text-gray-600 hover:text-black">Leads</Link>
          {role === "owner" && (
            <Link href="/staff" className="text-gray-600 hover:text-black">Staff</Link>
          )}
        </div>
        <button onClick={signOut} className="text-sm text-gray-500 hover:text-black">Sign out</button>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
