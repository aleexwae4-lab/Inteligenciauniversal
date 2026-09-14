export const EVALS_VERSION = 'universal-evals/v1';

const INTERNAL_MARKERS = /\b(?:wae-adaptive-router-v\d+|universal_continuity_core|fallbackFailures|routing_variant|system prompt|developer message|chain of thought)\b/i;

function ratio(done, total) {
  if (!total) return 1;
  return Math.max(0, Math.min(1, done / total));
}

export function evaluateMissionOutput({ reply = '', specialists = [], toolResults = [], elapsedMs = null } = {}) {
  const text = String(reply || '').trim();
  const successfulSpecialists = specialists.filter((item) => item && (item.reply || item.ok === true)).length;
  const toolEvidence = toolResults.filter((item) => item && item.ok === true);
  const receiptedEvidence = toolEvidence.filter((item) => item.receipt?.evidenceSha256 && item.receipt?.status === 'completed').length;

  const dimensions = {
    answerPresent: text.length >= 20,
    substantive: text.length >= 120,
    specialistCoverage: ratio(successfulSpecialists, specialists.length),
    evidenceReceipts: ratio(receiptedEvidence, toolEvidence.length),
    internalBoundary: !INTERNAL_MARKERS.test(text),
  };

  let score = 0;
  if (dimensions.answerPresent) score += 30;
  if (dimensions.substantive) score += 10;
  score += Math.round(dimensions.specialistCoverage * 20);
  score += Math.round(dimensions.evidenceReceipts * 20);
  if (dimensions.internalBoundary) score += 20;

  return {
    schema: EVALS_VERSION,
    score,
    pass: score >= 80,
    dimensions,
    telemetry: { elapsedMs: Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : null },
    note: 'Deterministic product-quality gate; not a benchmark against external models.',
  };
}
