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
  const isPublicPath = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/accept-invite");
  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
