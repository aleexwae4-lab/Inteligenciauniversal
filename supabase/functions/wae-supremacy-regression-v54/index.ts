import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Json = Record<string, unknown>;
type Actor = { trusted: boolean; userId: string | null; authMode: "worker" | "user" };

const VERSION = "continuous-improvement/v54";
const BENCHMARK_VERSION = "universal-supremacy-benchmark/v53";
const DEFAULT_CERTIFIER = "https://wae-inteligencia-universal.onrender.com";
const MAX_ENTRIES = 32;
const MAX_ANSWER = 30000;

const objectOf = (value: unknown): Json => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Json : {};
const stringOf = (value: unknown, max = 1000) => typeof value === "string" ? value.slice(0, max) : "";
const arrayOf = (value: unknown) => Array.isArray(value) ? value : [];
const numberOf = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function cors(origin: string | null) {
  const allowed = !origin || origin === "https://wae-inteligencia-universal.onrender.com" || origin === "http://localhost:5173" || origin === "http://localhost:3000";
  return {
    "access-control-allow-origin": allowed && origin ? origin : "https://wae-inteligencia-universal.onrender.com",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "authorization,apikey,content-type,x-wae-worker-token",
    "vary": "Origin"
  };
}

function respond(status: number, body: Json, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(origin) }
  });
}

function serviceKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return String(parsed.default);
    } catch {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

async function authorize(admin: any, req: Request): Promise<Actor | null> {
  const workerToken = req.headers.get("x-wae-worker-token") || "";
  if (workerToken) {
    const { data, error } = await admin.rpc("wae_validate_worker_token", { p_token: workerToken });
    if (!error && data === true) return { trusted: true, userId: null, authMode: "worker" };
  }

  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { trusted: false, userId: String(data.user.id), authMode: "user" };
}

function sanitizeEntries(value: unknown, targetId: string, referenceId: string) {
  return arrayOf(value).slice(0, MAX_ENTRIES).map(raw => {
    const entry = objectOf(raw);
    const candidates = arrayOf(entry.candidates)
      .map(objectOf)
      .filter(candidate => [targetId, referenceId].includes(stringOf(candidate.id, 120)))
      .slice(0, 2)
      .map(candidate => ({
        id: stringOf(candidate.id, 120),
        answer: stringOf(candidate.answer ?? candidate.text, MAX_ANSWER),
        sources: arrayOf(candidate.sources).slice(0, 20),
        latencyMs: candidate.latencyMs ?? null,
        costUsd: candidate.costUsd ?? null
      }));
    return {
      caseId: stringOf(entry.caseId, 120),
      promptHash: stringOf(entry.promptHash, 128),
      candidates
    };
  });
}

async function certify(entries: unknown[], targetId: string, referenceId: string) {
  const origin = (Deno.env.get("WAE_RENDER_ORIGIN") || DEFAULT_CERTIFIER).replace(/\/$/, "");
  const response = await fetch(`${origin}/api/evals`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "UniversalCore-v54-RegressionGate" },
    body: JSON.stringify({ action: "certify", targetId, referenceId, entries }),
    signal: AbortSignal.timeout(20000)
  });
  const payload = objectOf(await response.json().catch(() => ({})));
  if (!response.ok || payload.success !== true) throw new Error(`certifier_failed:${response.status}`);
  const certification = objectOf(payload.certification);
  if (stringOf(certification.version, 160) !== BENCHMARK_VERSION) throw new Error("benchmark_version_mismatch");
  return certification;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function categoryFor(caseId: string) {
  const prefix = caseId.split("-")[0] || "unknown";
  return ({
    instruction: "instruction_contract",
    structured: "structured_exact",
    reasoning: "reasoning_math",
    research: "research_evidence",
    engineering: "engineering",
    noisy: "noisy_multilingual_intent",
    adversarial: "document_adversarial",
    efficiency: "operational_efficiency"
  } as Record<string, string>)[prefix] || "unknown";
}

function severityFor(caseId: string, tags: string[]) {
  const normalized = tags.map(tag => tag.toLowerCase());
  if (caseId.startsWith("adversarial-") || normalized.some(tag => tag.startsWith("safety:") || tag.includes("internal_leak") || tag.includes("forbidden"))) return "critical";
  if (normalized.some(tag => tag.startsWith("assertion:") || tag.startsWith("requirement:"))) return "high";
  if (normalized.some(tag => tag.includes("latency") || tag.includes("cost"))) return "medium";
  return "medium";
}

async function storeRegression(admin: any, args: {
  actor: Actor;
  runId: string;
  commitSha: string;
  benchmarkVersion: string;
  regression: Json;
  promptHash: string;
}) {
  const caseId = stringOf(args.regression.caseId, 120);
  if (!caseId) return;
  const tags = arrayOf(args.regression.failureTags ?? args.regression.requiredRegression).map(value => stringOf(value, 240)).filter(Boolean).sort();
  const scope = args.actor.trusted ? "trusted" : `user:${args.actor.userId}`;
  const regressionKey = await sha256(`${scope}|${args.benchmarkVersion}|${caseId}|${tags.join("|")}`);
  const severity = severityFor(caseId, tags);
  const now = new Date().toISOString();
  const { data: existing } = await admin.from("wae_supremacy_regression_backlog_v54")
    .select("id,occurrence_count")
    .eq("regression_key", regressionKey)
    .maybeSingle();

  const values = {
    actor_user_id: args.actor.userId,
    case_id: caseId,
    prompt_hash: args.promptHash,
    category: categoryFor(caseId),
    failure_tags: tags,
    severity,
    status: "open",
    trusted: args.actor.trusted,
    last_seen_run_id: args.runId,
    last_target_score: args.regression.targetScore ?? null,
    last_reference_score: args.regression.referenceScore ?? null,
    source_benchmark_version: args.benchmarkVersion,
    resolved_by_commit_sha: null,
    resolved_at: null,
    last_seen_at: now,
    metadata: { source: VERSION, attestation: args.actor.authMode }
  };

  if (existing?.id) {
    const { error } = await admin.from("wae_supremacy_regression_backlog_v54")
      .update({ ...values, occurrence_count: Number(existing.occurrence_count || 0) + 1 })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("wae_supremacy_regression_backlog_v54").insert({
    regression_key: regressionKey,
    first_seen_run_id: args.runId,
    occurrence_count: 1,
    first_seen_at: now,
    ...values
  });
  if (error) throw error;
}

async function resolveRecoveredCases(admin: any, actor: Actor, entries: any[], regressions: Json[], commitSha: string) {
  const failed = new Set(regressions.map(row => stringOf(row.caseId, 120)).filter(Boolean));
  const recovered = entries.map(row => stringOf(row.caseId, 120)).filter(caseId => caseId && !failed.has(caseId));
  if (!recovered.length) return;
  let query = admin.from("wae_supremacy_regression_backlog_v54")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by_commit_sha: commitSha || null })
    .eq("status", "open")
    .in("case_id", recovered)
    .eq("trusted", actor.trusted);
  query = actor.trusted ? query.is("actor_user_id", null) : query.eq("actor_user_id", actor.userId);
  const { error } = await query;
  if (error) throw error;
}

async function recordCertification(admin: any, actor: Actor, body: Json) {
  const targetId = stringOf(body.targetId || "universal_core", 120) || "universal_core";
  const referenceId = stringOf(body.referenceId, 120);
  if (!referenceId || referenceId === targetId || ["baseline", "reference"].includes(referenceId.toLowerCase())) throw new Error("named_external_reference_required");
  const commitSha = stringOf(body.commitSha, 80);
  const entries = sanitizeEntries(body.entries, targetId, referenceId);
  if (!entries.length || entries.length > MAX_ENTRIES) throw new Error("benchmark_entries_required");

  const certification = await certify(entries, targetId, referenceId);
  const aggregate = objectOf(certification.aggregate);
  const regressions = arrayOf(certification.regressions).map(objectOf);
  const runValues = {
    actor_user_id: actor.userId,
    benchmark_version: stringOf(certification.version, 160) || BENCHMARK_VERSION,
    target_id: targetId,
    reference_id: referenceId,
    commit_sha: commitSha || null,
    attestation_level: actor.trusted ? "trusted_worker" : "user_submitted",
    trusted_for_promotion: actor.trusted,
    evaluated_cases: numberOf(certification.evaluatedCases),
    wins: numberOf(aggregate.wins),
    ties: numberOf(aggregate.ties),
    losses: numberOf(aggregate.losses),
    adjusted_win_rate: numberOf(aggregate.adjustedWinRate),
    critical_failure_rate: numberOf(aggregate.criticalFailureRate),
    claim_allowed: certification.claimAllowed === true,
    verdict: stringOf(certification.verdict, 80) || "NOT_PROVEN",
    certification
  };

  const { data: run, error: runError } = await admin.from("wae_supremacy_runs_v54").insert(runValues).select("id").single();
  if (runError || !run?.id) throw runError || new Error("run_insert_failed");

  const hashByCase = new Map(entries.map((entry: any) => [entry.caseId, entry.promptHash]));
  for (const regression of regressions) {
    await storeRegression(admin, {
      actor,
      runId: run.id,
      commitSha,
      benchmarkVersion: runValues.benchmark_version,
      regression,
      promptHash: String(hashByCase.get(stringOf(regression.caseId, 120)) || "")
    });
  }
  await resolveRecoveredCases(admin, actor, entries, regressions, commitSha);

  let publicStatus: unknown = null;
  if (actor.trusted) {
    const { data, error } = await admin.rpc("wae_refresh_supremacy_public_status_v54");
    if (error) throw error;
    publicStatus = data;
  }

  return {
    run_id: run.id,
    trusted_for_promotion: actor.trusted,
    certification,
    regressions_recorded: regressions.length,
    public_status: publicStatus
  };
}

async function statusFor(admin: any, actor: Actor) {
  const { data: publicRows } = await admin.from("wae_supremacy_public_status_v54").select("*").eq("context_key", "global").limit(1);
  let runs = admin.from("wae_supremacy_runs_v54")
    .select("id,benchmark_version,target_id,reference_id,commit_sha,attestation_level,trusted_for_promotion,evaluated_cases,wins,ties,losses,adjusted_win_rate,critical_failure_rate,claim_allowed,verdict,created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  let backlog = admin.from("wae_supremacy_regression_backlog_v54")
    .select("case_id,prompt_hash,category,failure_tags,severity,status,trusted,occurrence_count,last_target_score,last_reference_score,last_seen_at,resolved_at")
    .order("last_seen_at", { ascending: false })
    .limit(50);
  if (actor.trusted) {
    runs = runs.eq("trusted_for_promotion", true);
    backlog = backlog.eq("trusted", true);
  } else {
    runs = runs.eq("actor_user_id", actor.userId).eq("trusted_for_promotion", false);
    backlog = backlog.eq("actor_user_id", actor.userId).eq("trusted", false);
  }
  const [{ data: runRows }, { data: backlogRows }] = await Promise.all([runs, backlog]);
  return { public_status: publicRows?.[0] || null, runs: runRows || [], backlog: backlogRows || [] };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return respond(405, { success: false, error: "method_not_allowed" }, origin);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = serviceKey();
  if (!url || !key) return respond(500, { success: false, error: "configuration_missing" }, origin);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const actor = await authorize(admin, req);
  if (!actor) return respond(401, { success: false, error: "authorization_required" }, origin);

  const body = objectOf(await req.json().catch(() => ({})));
  const action = stringOf(body.action, 60).toLowerCase();
  try {
    if (action === "certify_and_record") {
      const result = await recordCertification(admin, actor, body);
      return respond(200, { success: true, version: VERSION, ...result }, origin);
    }
    if (action === "status") {
      const result = await statusFor(admin, actor);
      return respond(200, { success: true, version: VERSION, trusted_context: actor.trusted, ...result }, origin);
    }
    return respond(400, { success: false, error: "unsupported_action" }, origin);
  } catch (error) {
    console.error("wae-supremacy-regression-v54", error);
    const message = String(error);
    const status = /required|mismatch|entries|reference/i.test(message) ? 422 : 500;
    return respond(status, { success: false, error: status === 422 ? message.slice(0, 240) : "internal_error" }, origin);
  }
});
