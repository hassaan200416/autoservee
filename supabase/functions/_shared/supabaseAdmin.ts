// Service-role client for use INSIDE edge functions only.
// Never import this file's pattern into any frontend code — the service role
// key bypasses RLS entirely.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Client scoped to the calling user's own JWT — respects RLS.
// Use this whenever you just need to check "is this caller allowed", rather
// than bypassing RLS outright.
export function supabaseAsCaller(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}
