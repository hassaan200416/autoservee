import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) =>
          res.cookies.set({ name, value, ...options }),
        remove: (name: string, options: CookieOptions) =>
          res.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/accept-invite") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/preview");

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (session && !isPublic) {
    const { data: staffRow } = await supabase
      .from("dealer_staff")
      .select("status, role, dealers(status)")
      .eq("user_id", session.user.id)
      .maybeSingle();

    const dealerStatus = (staffRow as { dealers?: { status?: string } } | null)?.dealers?.status;
    if (!staffRow || staffRow.status === "deactivated" || dealerStatus === "suspended") {
      await supabase.auth.signOut();
      const login = new URL("/login", req.url);
      login.searchParams.set("reason", dealerStatus === "suspended" ? "suspended" : "deactivated");
      return NextResponse.redirect(login);
    }

    if (path.startsWith("/staff") && staffRow.role !== "owner") {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  if (session && (path === "/login" || path === "/forgot-password")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
