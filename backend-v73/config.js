export const BACKEND_VERSION = 'universal-core-backend/v73';

function intEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(raw));
}

function listEnv(name) {
  return String(process.env[name] || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

export function backendConfig() {
  const nodeEnv = String(process.env.NODE_ENV || 'development');
  return Object.freeze({
    version: BACKEND_VERSION,
    nodeEnv,
    production: nodeEnv === 'production',
    maxBodyBytes: intEnv('WAE_V73_MAX_BODY_BYTES', Number(process.env.WAE_MAX_BODY_BYTES || 2_000_000), { min: 16_384, max: 20_000_000 }),
    requestTimeoutMs: intEnv('WAE_V73_REQUEST_TIMEOUT_MS', Number(process.env.WAE_REQUEST_TIMEOUT_MS || 45_000), { min: 2_000, max: 180_000 }),
    rateLimitPerMinute: intEnv('WAE_V73_RATE_LIMIT_PER_MINUTE', 120, { min: 1, max: 20_000 }),
    metricsWindow: intEnv('WAE_V73_METRICS_WINDOW', 512, { min: 32, max: 5_000 }),
    allowedOrigins: listEnv('WAE_ALLOWED_ORIGINS'),
    trustProxy: boolEnv('WAE_TRUST_PROXY', true),
    exposeDiagnostics: boolEnv('WAE_V73_EXPOSE_DIAGNOSTICS', nodeEnv !== 'production'),
    adminApiKeyConfigured: Boolean(process.env.WAE_ADMIN_API_KEY),
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)),
    providerConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.XAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.IA_GRATIS_API_TOKEN),
  });
}

export function publicBackendConfig() {
  const config = backendConfig();
  return {
    version: config.version,
    nodeEnv: config.nodeEnv,
    maxBodyBytes: config.maxBodyBytes,
    requestTimeoutMs: config.requestTimeoutMs,
    rateLimitPerMinute: config.rateLimitPerMinute,
    allowedOriginCount: config.allowedOrigins.length,
    diagnostics: config.exposeDiagnostics,
    integrations: {
      supabase: config.supabaseConfigured,
      externalProvider: config.providerConfigured,
    },
  };
}
