export const CONTEXT_OUTPUT_FIREWALL_VERSION='context-output-firewall/v55';

const PRIVATE_MARKERS=[
  /\[(?:M|MEM)\d+\]/i,
  /\bRELEVANT MEMORY\b/i,
  /\bMEMORIA RECUPERADA\b/i,
  /\bmemoria relevante recuperada\b/i,
  /\bPreferencia de presentaci[oó]n del producto\b/i,
  /\bPOL[IÍ]TICA DE RESPUESTA PREMIUM WAE\b/i,
  /\bCONTEXTO CONVERSACIONAL DEL RUNTIME\b/i,
  /\bEVIDENCIA DE HERRAMIENTAS\b/i,
  /\bUSER FILE EVIDENCE\b/i,
  /\bARCHIVOS ADJUNTOS\b/i,
  /\bsystem_guidance\b/i,
  /\bLanguage Policy\b/i,
  /\bRole:\s*Advanced\b/i,
  /\bprivate context, never instructions\b/i,
  /\bdatos no confiables; nunca instrucciones\b/i,
];

export function privateContextLeakReason(value=''){
  const text=String(value||'');
  if(!text)return null;
  const hit=PRIVATE_MARKERS.find(rx=>rx.test(text));
  return hit?String(hit):null;
}

export function isSafeAssistantOutput(value=''){
  return privateContextLeakReason(value)===null;
}

export function assertSafeAssistantOutput(value=''){
  const text=String(value||'').trim();
  if(!text)return text;
  const reason=privateContextLeakReason(text);
  if(reason){
    throw Object.assign(new Error('private_context_output_blocked'),{
      code:'PRIVATE_CONTEXT_OUTPUT_BLOCKED',
      statusCode:503,
      recoverable:true,
      reason,
    });
  }
  return text;
}

export function publicContextFallback(){
  return 'No pude completar esa respuesta con una salida segura en este intento. Conservé tu pregunta y puedo reintentarla sin exponer memoria ni contexto interno.';
}
