"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { cn } from "@autoserve/shared-ui";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dealers", label: "Dealers", icon: Building2 },
];

export default function AdminNav() {
  const pathname = usePathname();
  const supabase = createSupabaseBrowserClient();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-primary text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-sm font-semibold tracking-wide">AutoServe Admin</p>
        <p className="mt-1 text-xs text-slate-400">Platform</p>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <button
          onClick={signOut}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
