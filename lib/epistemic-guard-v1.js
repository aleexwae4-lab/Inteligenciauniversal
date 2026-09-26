export const EPISTEMIC_GUARD_VERSION='epistemic-guard/v1';

const CURRENT=/\b(actual|actualmente|hoy|ahora|reciente|últim[oa]s?|latest|current|this week|este mes|2026|precio|cotización|stock|clima|horario|disponib|reserv|quién es el presidente|gobierno|elección|elecciones|ley|regulación)\b/i;
const NUMERIC=/\b(?:[$€£]\s?)?\d+(?:[.,]\d+)?\s?(?:%|pesos|mxn|usd|dólares|millones|mil|años|km|kg|gb|mb|m2|m²|toneladas|litros|unidades|usuarios|personas|meses|días)\b/i;
const CERTAINTY=/\b(es|son|tiene|tienen|ocurrió|ocurre|ganó|gana|cuesta|vale|mide|produce|factura|reporta|confirma|demuestra)\b/i;

export function epistemicAssessment({question='',answer='',sources=[],toolResults=[]}={}) {
  const q=String(question), a=String(answer);
  const sourceCount=Array.isArray(sources)?sources.filter(Boolean).length:0;
  const toolEvidence=(toolResults||[]).filter(x=>x?.ok===true).length;
  const evidence=sourceCount>0||toolEvidence>0;
  const currentRequest=CURRENT.test(q);
  const numericClaim=NUMERIC.test(a);
  const certaintyClaim=CERTAINTY.test(a);
  const evidenceRequired=currentRequest||numericClaim;
  const unsupported=evidenceRequired&&!evidence&&certaintyClaim;
  return {
    version:EPISTEMIC_GUARD_VERSION,
    evidenceRequired,
    evidencePresent:evidence,
    unsupportedRisk:unsupported?'high':evidenceRequired&&!evidence?'medium':'low',
    action:unsupported?'qualify_or_research':evidenceRequired&&!evidence?'qualify':'normal',
  };
}

export function epistemicInstruction(report) {
  if(report?.action==='qualify_or_research') return '\n\nGUARDIA EPISTÉMICA: La respuesta contiene afirmaciones que requieren evidencia verificable. No presentes como hechos datos actuales, cifras, fechas, precios o eventos específicos sin evidencia. Si no puedes verificarlos en este turno, dilo claramente y formula la respuesta como conocimiento general, posibilidad o incertidumbre. Nunca rellenes huecos con una cifra o fuente inventada.';
  if(report?.action==='qualify') return '\n\nGUARDIA EPISTÉMICA: No hay evidencia verificable suficiente para esta petición. No inventes datos. Distingue explícitamente conocimiento general de información no verificada y, si corresponde, indica qué dato falta.';
  return '\n\nGUARDIA EPISTÉMICA: No inventes hechos, cifras, citas, fuentes, acciones ni estados. Si no sabes algo o no puedes verificarlo, dilo. Nunca conviertas una inferencia en un hecho.';
}
