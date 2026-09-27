export const FRONTIER_ARENA_VERSION = 'frontier-arena/v1';

const REFERENCES = Object.freeze({
  'frontiermath-tier4': { value: 0.98, unit: 'score', source: 'OpenAI GPT-6 Astra announcement' },
  'arc-agi-3': { value: 0.999, unit: 'score', source: 'OpenAI GPT-6 Astra announcement' },
  'gpqa-diamond': { value: 0.96, unit: 'score', source: 'OpenAI GPT-6 Astra announcement' },
  'exploitbench': { value: 1.0, unit: 'score', source: 'OpenAI GPT-6 Astra announcement' },
  'terminal-bench-4': { value: 0.579, unit: 'score', source: 'OpenAI GPT-6 Astra announcement' },
  'osworld-2': { value: 0.726, unit: 'score', source: 'OpenAI GPT-6 Astra announcement' },
  'benchcad': { value: 0.959, unit: 'score', source: 'OpenAI GPT-6 Astra announcement' }
});

const clamp = (v) => Math.max(0, Math.min(1, Number(v)));
const finite = (v) => Number.isFinite(Number(v)) ? Number(v) : null;

export function frontierArenaReferences() {
  return {
    version: FRONTIER_ARENA_VERSION,
    references: Object.fromEntries(Object.entries(REFERENCES).map(([id, x]) => [id, { ...x }])),
    policy: {
      sourceAttributionRequired: true,
      measuredOnly: true,
      missingIsNotZero: true,
      noSyntheticScores: true,
      noGlobalSuperiorityClaim: true
    }
  };
}

export function evaluateFrontierArena(measured = {}) {
  const rows = Object.entries(REFERENCES).map(([id, ref]) => {
    const raw = finite(measured?.[id]);
    const hasMeasurement = raw !== null;
    const actual = hasMeasurement ? clamp(raw) : null;
    const gap = actual === null ? null : Number((actual - ref.value).toFixed(4));
    return {
      id,
      reference: ref.value,
      actual,
      gap,
      status: actual === null ? 'UNMEASURED' : gap >= 0 ? 'AT_OR_ABOVE_REFERENCE' : 'BELOW_REFERENCE',
      source: ref.source
    };
  });
  const measuredRows = rows.filter(x => x.actual !== null);
  const atOrAbove = measuredRows.filter(x => x.gap >= 0).length;
  const averageGap = measuredRows.length
    ? Number((measuredRows.reduce((sum, x) => sum + x.gap, 0) / measuredRows.length).toFixed(4))
    : null;
  return {
    version: FRONTIER_ARENA_VERSION,
    cases: rows,
    coverage: Number((measuredRows.length / rows.length).toFixed(4)),
    measured: measuredRows.length,
    atOrAboveReference: atOrAbove,
    averageGap,
    verdict: measuredRows.length === 0 ? 'NO_EVIDENCE' : 'BENCHMARK_SCOPED_ONLY',
    policy: frontierArenaReferences().policy
  };
}
