// dealer-stats: aggregation kept off the client so we're not shipping raw
// row data just to compute a count in the browser.
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: corsHeaders });

  const url = new URL(req.url);
  const dealer_id = url.searchParams.get("dealer_id");
  if (!dealer_id) return new Response(JSON.stringify({ error: "dealer_id required" }), { status: 400, headers: corsHeaders });

  // Relies entirely on RLS via the caller's own client — if they aren't staff
  // at this dealer, these queries just return empty, not an error.
  const caller = supabaseAsCaller(authHeader);

  const [{ count: leadsThisWeek }, { count: carsAvailable }, { data: leadsByStage }] = await Promise.all([
    caller.from("leads").select("id", { count: "exact", head: true })
      .eq("dealer_id", dealer_id).gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
    caller.from("cars").select("id", { count: "exact", head: true })
      .eq("dealer_id", dealer_id).eq("status", "available"),
    caller.from("leads").select("stage").eq("dealer_id", dealer_id),
  ]);

  // Zero-state safe: empty tables just produce zero counts, never an error.
  const stageCounts: Record<string, number> = {};
  for (const row of leadsByStage ?? []) {
    stageCounts[row.stage] = (stageCounts[row.stage] ?? 0) + 1;
  }

  return new Response(JSON.stringify({
    leads_this_week: leadsThisWeek ?? 0,
    cars_available: carsAvailable ?? 0,
    leads_by_stage: stageCounts,
  }), { headers: corsHeaders });
});
