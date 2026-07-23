"use client";

import { usePathname } from "next/navigation";
import AdminNav from "@/components/AdminNav";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname.startsWith("/login");

  if (isLogin) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="ml-60 flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-border bg-white/90 px-6 backdrop-blur">
          <p className="text-sm text-slate-500">Platform administration</p>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
