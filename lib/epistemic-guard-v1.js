export const EPISTEMIC_GUARD_VERSION='epistemic-guard/v2';
const CURRENT=/\b(actual|actualmente|hoy|ahora|reciente|últim[oa]s?|latest|current|this week|este mes|2026|precio|cotización|stock|clima|horario|disponib|reserv|gobierno|elección|elecciones|ley|regulación)\b/i;
const NUMERIC=/\b(?:[$€£]\s?)?\d+(?:[.,]\d+)?\s?(?:%|pesos|mxn|usd|dólares|millones|mil|años|km|kg|gb|mb|m2|m²|toneladas|litros|unidades|usuarios|personas|meses|días)\b/i;
const CERTAINTY=/\b(es|son|tiene|tienen|ocurrió|ocurre|ganó|gana|cuesta|vale|mide|produce|factura|reporta|confirma|demuestra|fue|será)\b/i;
const ACTION=/\b(ejecuté|ejecutamos|realicé|realizamos|envié|enviamos|publiqué|publicamos|creé|creamos|desplegué|desplegamos|actualicé|actualizamos|reservé|reservamos|notifiqué|notificamos)\b/i;
const claims=a=>String(a).match(/[^.!?]+[.!?]/g)||[String(a)];
function supported(c,{sources=[],toolResults=[]}={}){const text=JSON.stringify([...sources,...toolResults].slice(0,80)).toLowerCase();const terms=String(c).toLowerCase().split(/\W+/).filter(x=>x.length>4).slice(0,5);return terms.length>0&&terms.filter(t=>text.includes(t)).length>=Math.min(2,terms.length);}
export function epistemicAssessment({question='',answer='',sources=[],toolResults=[]}={}){
 const reports=claims(answer).map(claim=>({claim,...{current:CURRENT.test(claim),numeric:NUMERIC.test(claim),certainty:CERTAINTY.test(claim),action:ACTION.test(claim)},supported:supported(claim,{sources,toolResults})}));
 const currentRequest=CURRENT.test(String(question)), risky=reports.filter(r=>(r.current||r.numeric||r.action||r.certainty)&&!r.supported);
 const actionClaims=reports.filter(r=>r.action);
 const evidencePresent=(sources||[]).length>0||(toolResults||[]).some(x=>x?.ok===true);
 return {version:EPISTEMIC_GUARD_VERSION,evidenceRequired:currentRequest||reports.some(r=>r.current||r.numeric||r.action),evidencePresent,verifiedClaimCount:reports.filter(r=>r.supported).length,unsupportedClaimCount:risky.length,unsupportedActionCount:actionClaims.filter(r=>!r.supported).length,claims:reports.slice(0,40),unsupportedRisk:risky.length?'high':currentRequest&&!evidencePresent?'medium':'low',action:risky.length?'qualify_or_research':currentRequest&&!evidencePresent?'qualify':'normal'};
}
export function epistemicInstruction(report){
 if(report?.action==='qualify_or_research')return '\n\nGUARDIA EPISTÉMICA v2: respalda afirmaciones actuales, numéricas y acciones con evidencia pertinente. Si no están respaldadas, elimínalas, califícalas como incertidumbre o investiga. Nunca inventes fuentes, cifras, citas ni estados de ejecución.';
 if(report?.action==='qualify')return '\n\nGUARDIA EPISTÉMICA v2: no hay evidencia suficiente para afirmar datos actuales. Separa conocimiento general de hechos no verificados.';
 return '\n\nGUARDIA EPISTÉMICA v2: verifica afirmaciones relevantes. Las acciones externas sólo pueden declararse ejecutadas con evidencia de herramienta o recibo.';
}