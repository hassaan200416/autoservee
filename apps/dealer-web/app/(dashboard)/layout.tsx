"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Car,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@autoserve/supabase-client/browser";
import { ToastProvider } from "@autoserve/shared-ui/toast";
import type { Notification } from "@autoserve/shared-types";
import { cn, relativeTime } from "@autoserve/shared-ui";

const NAV = [
  { href: "/home", label: "Today", icon: Home },
  { href: "/inventory", label: "Inventory", icon: Car },
  { href: "/leads", label: "Leads", icon: LayoutDashboard },
  { href: "/staff", label: "Staff", icon: Users, ownerOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<"owner" | "staff" | null>(null);
  const [dealerName, setDealerName] = useState("");
  const [fullName, setFullName] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (pathname.startsWith("/staff") && role === "staff") {
      router.replace("/home");
    }
  }, [pathname, role, router]);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadShell() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: staffRow } = await supabase
        .from("dealer_staff")
        .select("id, role, full_name, dealers(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!staffRow || cancelled) return;

      setRole(staffRow.role as "owner" | "staff");
      setFullName(staffRow.full_name);
      const dealers = staffRow.dealers as { name?: string } | { name?: string }[] | null;
      const name = Array.isArray(dealers) ? dealers[0]?.name : dealers?.name;
      setDealerName(name ?? "Dealership");

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_staff_id", staffRow.id)
        .is("read_at", null)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setNotifications((data as Notification[]) ?? []);

      // Unique name avoids React Strict Mode remount colliding with an
      // already-subscribed channel of the same topic (which throws on .on()).
      channel = supabase
        .channel(`notif-${staffRow.id}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_staff_id=eq.${staffRow.id}`,
          },
          (payload) => {
            setNotifications((prev) => [payload.new as Notification, ...prev]);
          }
        )
        .subscribe();

      if (cancelled) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    }

    void loadShell();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function markRead(notif: Notification) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notif.id);
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const navItems = NAV.filter((item) => !item.ownerOnly || role === "owner");

  function NavLinks({ dark }: { dark?: boolean }) {
    return (
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                dark
                  ? active
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                  : active
                    ? "bg-sky-50 text-accent"
                    : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <aside className="hidden w-60 flex-col bg-primary text-white md:flex">
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-sm font-semibold tracking-wide">AutoServe</p>
            <p className="mt-1 truncate text-xs text-slate-400">{dealerName}</p>
          </div>
          <NavLinks dark />
          <div className="border-t border-white/10 p-3">
            <div className="mb-2 rounded-lg px-3 py-2">
              <p className="truncate text-sm font-medium text-white">{fullName || "—"}</p>
              <p className="text-xs capitalize text-slate-400">{role ?? "…"}</p>
            </div>
            <button
              onClick={signOut}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
            <aside className="relative z-10 flex h-full w-64 flex-col bg-primary text-white shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <div>
                  <p className="font-semibold">AutoServe</p>
                  <p className="text-xs text-slate-400">{dealerName}</p>
                </div>
                <button onClick={() => setMobileOpen(false)} className="cursor-pointer rounded p-1 hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks dark />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur md:px-6">
            <button
              className="cursor-pointer rounded-lg p-2 text-slate-600 hover:bg-slate-50 md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 md:hidden">{dealerName}</p>
              <p className="hidden text-sm text-slate-500 md:block">
                After the listing — pipeline, inventory, and team in one place.
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowNotifs((s) => !s)}
                className="relative cursor-pointer rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
                  <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Notifications
                  </div>
                  {notifications.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No new notifications.</p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.lead_id ? `/leads/${n.lead_id}` : "/leads"}
                        onClick={() => markRead(n)}
                        className="block border-b border-border px-3 py-3 text-sm transition-colors hover:bg-slate-50 last:border-b-0"
                      >
                        <p className="text-slate-800">{n.message}</p>
                        <p className="mt-1 text-xs text-slate-400">{relativeTime(n.created_at)}</p>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
