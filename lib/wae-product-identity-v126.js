// WAE product identity contract v126: branding in conversations; provenance in audits.
// This contract does not claim that WAE trained a foundation model from scratch.
export const WAE_IDENTITY_VERSION='wae-product-identity/v126';
export const WAE_PRODUCT=Object.freeze({
  name:'Universal Core',
  company:'WAE OS Enterprise',
  owner:'WAE Production',
  class:'inteligencia artificial empresarial',
});
export const WAE_IDENTITY_POLICY=[
  'IDENTIDAD DE PRODUCTO WAE: eres Universal Core, la inteligencia artificial de WAE OS Enterprise.',
  'Tu identidad conversacional es Universal Core, no un chatbot genérico ni la marca del modelo de inferencia.',
  'Contesta primero la tarea. No enumeres proveedores, modelos, API, rutas ni telemetría en preguntas ordinarias.',
  'Solo cuando se solicite explícitamente arquitectura, procedencia, modelos utilizados, licencias, entrenamiento, privacidad, tratamiento de datos o auditoría, explica esos hechos con evidencia verificable.',
  'WAE desarrolla y personaliza el producto; no afirmes que entrenó desde cero modelos fundacionales sin evidencia documental.',
  'No ocultes hechos materiales cuando el usuario solicite transparencia técnica ni inventes independencia, hardware o capacidad que no se han verificado.'
].join(' ');
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export function asksForTechnicalProvenance(raw='') {
 const q=norm(raw);
 return /\b(?:arquitectura tecnica|modelos? (?:base|fundacionales?|subyacentes?|utilizados?|usas|usan)|proveedores?|apis?|licencias?|licenciamiento|entrenamiento|entrenaron|entreno|entrenaste|procedencia|origen (?:tecnico|del modelo)|privacidad|tratamiento de datos|procesamiento de datos|auditoria tecnica|quien te (?:entreno|desarrollo)|quien (?:te )?programo)\b/.test(q);
}
export function isSelfIdentityQuestion(raw='') {
 const q=norm(raw).replace(/[¿?¡!.,:]/g,' ').replace(/\s+/g,' ').trim();
 return /^(?:(?:hola|oye|dime|por favor|me dices)\s+)*(?:quien eres|que eres|que modelo eres|eres chatgpt|eres gemini|eres claude|como te llamas|quien te creo|quien te entreno|quien te desarrollo)(?: tu| exactamente| en realidad)?$/.test(q);
}
// Do NOT suppress general discussion of OpenAI, Gemini, models or quoted examples.
// Reject only an assistant's own inaccurate vendor identity, even on a normal
// non-identity task where a model unexpectedly changes persona.
export function productIdentityIssue(answer='',question=''){
 const text=String(answer??'').trim().replace(/^\*\*(.+?)\*\*/,'$1');
 if(!text)return '';
 const q=norm(question);
 if(/\b(?:traduce|transcribe|cita textual|ejemplo de dialogo|escribe un guion|escribe codigo|analiza este texto|resumen de este texto)\b/.test(q))return '';
 const first=text.slice(0,500).replace(/^\s*(?:hola[,!.]?\s*)?/i,'');
 if(/^(?:soy|i am|i'm|me llamo)\s+(?:el\s+|la\s+|un\s+|una\s+)?(?:chatgpt|gemini|claude|copilot|grok)(?:\b|[,.!])/i.test(first))return 'wrong_assistant_brand';
 if(/^(?:soy|i am|i'm)\s+(?:un\s+|una\s+)?(?:modelo|asistente|chatbot|inteligencia artificial)(?:\s+de lenguaje)?[^\n.!?]{0,85}\b(?:openai|anthropic|google deepmind|microsoft)\b/i.test(first))return 'wrong_assistant_provenance';
 if(isSelfIdentityQuestion(question)&&!asksForTechnicalProvenance(question)&&
   !/\b(?:universal core|wae os enterprise|wae production)\b/i.test(text.slice(0,700)))
   return 'missing_wae_product_identity';
 return '';
}
