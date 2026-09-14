import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type J = Record<string, unknown>;

const VERSION = "71.0.0-production-runtime-adapter";
const TARGET = "wae-local-voice-demo-v61";
const MODEL_TARGET = "wae-production-runtime-v1";

const obj = (v: unknown): J => typeof v === "object" && v !== null && !Array.isArray(v) ? v as J : {};
const str = (v: unknown) => typeof v === "string" ? v : "";
const json = (status: number, body: J) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-wae-system-benchmark": VERSION,
    "x-wae-benchmark-target": TARGET,
  },
});

function serviceKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const p = JSON.parse(modern);
      if (p.default) return p.default;
    } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function extractText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((x) => typeof x === "string" ? x : str(obj(x).text)).join("");
  return "";
}

function messages(v: unknown) {
  return Array.isArray(v)
    ? v.map(obj).map((m) => ({ role: str(m.role), content: extractText(m.content) })).filter((m) => m.content.trim())
    : [];
}

async function workerAuthorized(admin: any, req: Request) {
  const token = req.headers.get("x-wae-worker-token") || "";
  if (!token) return false;
  const { data, error } = await admin.rpc("wae_validate_worker_token", { p_token: token });
  return !error && data === true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json(200, {
      ok: true,
      version: VERSION,
      target: TARGET,
      model: MODEL_TARGET,
      mode: "exact_current_production_transport",
      routing_variant: "control",
      superiority_claim: "evaluation_required",
    });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const service = serviceKey();
  if (!url || !service) return json(500, { error: "configuration_missing" });

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  if (!(await workerAuthorized(admin, req))) return json(403, { error: "worker_auth_required" });

  const body = obj(await req.json().catch(() => ({})));
  const ms = messages(body.messages);
  if (!ms.length) return json(422, { error: "messages_required" });

  const system = ms.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const lastUser = [...ms].reverse().find((m) => m.role === "user")?.content || ms.at(-1)?.content || "";
  if (!lastUser.trim()) return json(422, { error: "user_message_required" });

  const benchmarkTask = `${lastUser.trim()}\n\n[WAE BENCHMARK RESPONSE CONTRACT]\n${system.trim()}\nReturn exactly one valid JSON object and no markdown or commentary.`;

  const bootstrap = await fetch(`${url}/functions/v1/${TARGET}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "bootstrap" }),
    signal: AbortSignal.timeout(10000),
  });
  const boot = obj(await bootstrap.json().catch(() => ({})));
  const sid = str(boot.session_id);
  const secret = str(boot.session_secret);
  if (!bootstrap.ok || !sid || !secret) {
    return json(502, { error: "production_session_failed", http_status: bootstrap.status });
  }

  const started = Date.now();
  const response = await fetch(`${url}/functions/v1/${TARGET}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "chat",
      session_id: sid,
      session_secret: secret,
      message: benchmarkTask,
      mode: "analysis",
      web_enabled: false,
      stream: false,
      routing_variant: "control",
    }),
    signal: AbortSignal.timeout(90000),
  });
  const latency = Date.now() - started;
  const payload = obj(await response.json().catch(() => ({})));
  if (!response.ok || payload.success === false) {
    return json(502, {
      error: "production_runtime_failed",
      http_status: response.status,
      detail: str(payload.error) || str(payload.message) || "unknown",
      latency_ms: latency,
      failures: Array.isArray(payload.failures) ? payload.failures : [],
    });
  }

  const content = str(payload.reply) || str(obj(payload.response).content);
  if (!content) return json(502, { error: "production_empty_output", latency_ms: latency });

  return json(200, {
    id: `wae-production-benchmark-${crypto.randomUUID()}`,
    object: "chat.completion",
    model: MODEL_TARGET,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: {
      prompt_tokens: Number(payload.input_tokens || 0),
      completion_tokens: Number(payload.output_tokens || 0),
      total_tokens: Number(payload.input_tokens || 0) + Number(payload.output_tokens || 0),
    },
    wae_production: {
      proxy_version: VERSION,
      target_runtime: TARGET,
      target_runtime_version: str(payload.runtime),
      response_schema: str(payload.response_schema),
      routing_variant: str(payload.router_variant),
      routing_path: str(payload.routing_path),
      task_category: str(payload.task_category),
      actual_provider: str(payload.provider),
      actual_model: str(payload.model),
      edge_latency_ms: Number(payload.latency_ms || latency),
      end_to_end_latency_ms: latency,
      request_id: str(payload.request_id),
      conversation_id: str(payload.conversation_id),
      exact_current_production_transport: true,
      superiority_claim: "evaluation_required",
    },
  });
});
