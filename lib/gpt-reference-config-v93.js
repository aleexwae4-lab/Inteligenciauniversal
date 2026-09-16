export const VERIFIED_GPT_REFERENCE_CONFIG_VERSION = 'verified-gpt-reference-config/v93';
export const DEFAULT_VERIFIED_GPT_REFERENCE_MODEL = 'gpt-6-astra';
export const DEFAULT_VERIFIED_GPT_REASONING_EFFORT = 'high';
export const VERIFIED_GPT_REASONING_EFFORTS = Object.freeze(['low','medium','high','xhigh','max']);

const clean = (value, max = 160) => String(value ?? '').trim().slice(0, max);

export function verifiedGptReferenceModel(env = process.env) {
  return clean(env?.WAE_GPT_REFERENCE_MODEL || DEFAULT_VERIFIED_GPT_REFERENCE_MODEL, 160) || DEFAULT_VERIFIED_GPT_REFERENCE_MODEL;
}

export function verifiedGptReasoningEffort(env = process.env) {
  const requested = clean(env?.WAE_GPT_REFERENCE_REASONING_EFFORT || DEFAULT_VERIFIED_GPT_REASONING_EFFORT, 20).toLowerCase();
  return VERIFIED_GPT_REASONING_EFFORTS.includes(requested) ? requested : DEFAULT_VERIFIED_GPT_REASONING_EFFORT;
}

export function verifiedGptReferencePolicy(env = process.env) {
  return {
    version: VERIFIED_GPT_REFERENCE_CONFIG_VERSION,
    model: verifiedGptReferenceModel(env),
    reasoningEffort: verifiedGptReasoningEffort(env),
    researchWebSearch: true,
    sourceProvenanceRequired: true,
    normalProviderRoutingUnaffected: true,
  };
}
