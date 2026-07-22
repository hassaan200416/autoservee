"use client";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";

export default function AdminNav() {
  const supabase = createSupabaseBrowserClient();
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }
  return (
    <nav className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-6 text-sm">
        <span className="font-medium">AutoServe Admin</span>
        <Link href="/overview" className="text-gray-600 hover:text-black">Overview</Link>
        <Link href="/dealers" className="text-gray-600 hover:text-black">Dealers</Link>
      </div>
      <button onClick={signOut} className="text-sm text-gray-500 hover:text-black">Sign out</button>
    </nav>
  );
}
