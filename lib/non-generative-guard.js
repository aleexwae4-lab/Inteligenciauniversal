/* Render-specific boundary: a provider's outage notice is never a successful AI answer. */
const NON_GENERATIVE_PROVIDERS=new Set(['wae_deterministic_rescue','web_recovery']);
const NON_GENERATIVE_MODELS=new Set(['wae-deterministic-rescue-v1','evidence-rescue-v2']);
const NON_ANSWER_TEXT=[
  /^\s*(?:#{1,3}\s*)?la ruta generativa avanzada no est[aá] disponible en este intento\b/i,
  /^\s*(?:#{1,3}\s*)?las rutas generativas est[aá]n temporalmente saturadas\b/i,
  /^\s*(?:#{1,3}\s*)?respuesta con evidencia recuperada\b/i,
  /^\s*(?:#{1,3}\s*)?no hubo una ruta generativa ni una ruta de evidencia disponible\b/i,
];
export function nonGenerativeReason(value={}){
  const provider=String(value?.provider||'').toLowerCase();
  const model=String(value?.model||value?.model_name||'').toLowerCase();
  const text=String(value?.text??value?.reply??'').trim();
  if(NON_GENERATIVE_PROVIDERS.has(provider)||NON_GENERATIVE_MODELS.has(model))return 'provider_not_generative';
  if(!text)return 'empty_reply';
  if(NON_ANSWER_TEXT.some(pattern=>pattern.test(text)))return 'outage_text_not_answer';
  return null;
}
