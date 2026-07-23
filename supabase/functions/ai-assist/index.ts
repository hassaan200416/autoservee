// ai-assist: dealer-facing AI feature (Groq). Summarizes a lead's history
// or drafts a follow-up message. Never sends anything itself, never runs from
// the browser — the GROQ_API_KEY must only ever live in this function's env.
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseAsCaller } from "../_shared/supabaseAdmin.ts";

const DAILY_LIMIT_PER_DEALER = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: corsHeaders });

  const { lead_id, action } = await req.json(); // action: "summarize_notes" | "draft_followup" | "suggest_next_step"
  if (!lead_id || !["summarize_notes", "draft_followup", "suggest_next_step"].includes(action)) {
    return new Response(JSON.stringify({ error: "invalid input" }), { status: 400, headers: corsHeaders });
  }

  const caller = supabaseAsCaller(authHeader);
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

  // Caller's own client enforces "only staff of this lead's dealer can read it".
  const { data: lead, error: leadErr } = await caller.from("leads")
    .select("id, dealer_id, customer_name, stage, lead_activity(action, detail, created_at)")
    .eq("id", lead_id).maybeSingle();
  if (leadErr || !lead) return new Response(JSON.stringify({ error: "lead not found or not permitted" }), { status: 404, headers: corsHeaders });

  // @ts-ignore - joined shape
  const activity = lead.lead_activity ?? [];
  if (activity.length === 0) {
    return new Response(JSON.stringify({ error: "not_enough_history" }), { status: 422, headers: corsHeaders });
  }

  const admin = supabaseAdmin();
  const { data: staffRow } = await admin.from("dealer_staff").select("id").eq("user_id", user.id).eq("dealer_id", lead.dealer_id).maybeSingle();

  // Daily cap check, per dealer.
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { count: usedToday } = await admin.from("ai_usage_log").select("id", { count: "exact", head: true })
    .eq("dealer_id", lead.dealer_id).gte("created_at", since.toISOString());
  if ((usedToday ?? 0) >= DAILY_LIMIT_PER_DEALER) {
    return new Response(JSON.stringify({ error: "daily_limit_reached" }), { status: 429, headers: corsHeaders });
  }

  const historyText = activity
    // @ts-ignore
    .map((a) => `- [${a.action}] ${a.detail ?? ""}`.trim())
    .join("\n");

  const prompts: Record<string, string> = {
    summarize_notes: `Summarize this car-buyer lead's activity in 2-3 plain sentences for a busy salesperson.\nCustomer: ${lead.customer_name}\nStage: ${lead.stage}\nActivity log:\n${historyText}`,
    draft_followup: `Draft a short, friendly follow-up message (for the salesperson to review and send manually) to this customer, based on their activity below. Do not invent details not present in the log.\nCustomer: ${lead.customer_name}\nStage: ${lead.stage}\nActivity log:\n${historyText}`,
    suggest_next_step: `Based on this car-buyer lead's stage and activity, suggest ONE concrete next action the salesperson should take today. Be specific and brief (1-2 sentences). Do not invent details not present in the log.\nCustomer: ${lead.customer_name}\nStage: ${lead.stage}\nActivity log:\n${historyText}`,
  };
  const prompt = prompts[action];

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("GROQ_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    }),
  });

  if (!groqRes.ok) {
    return new Response(JSON.stringify({ error: "ai_unavailable" }), { status: 502, headers: corsHeaders });
  }
  const groqData = await groqRes.json();
  const text = groqData.choices?.[0]?.message?.content ?? "";

  await admin.from("ai_usage_log").insert({
    dealer_id: lead.dealer_id, staff_id: staffRow?.id ?? null, lead_id, action,
  });

  return new Response(JSON.stringify({ text }), { headers: corsHeaders });
});
