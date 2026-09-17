export const CONTEXT_INTEGRITY_V103='context-integrity/v103';

const FOLLOWUP_RX=/^(?:s[ií]|si|no|ok|okay|vale|perfecto|listo|dale|adelante|contin[uú]a|continua|sigue|hazlo|eso|esa|ese|ellos|ellas|por qu[eé]|porque|c[oó]mo|como|cu[aá]l|cual|y eso|y luego|y despu[eé]s|exacto|correcto|de acuerdo)[?.!\s]*$/i;
const SELF_RX=/\b(t[uú]|tu|tienes|tienes tú|eres|tu modelo|tu sistema|universal core|wae os|tu infraestructura|tu hardware|tus gpu|tus gpus|gpu[s]? propias?|quien te (?:hizo|cre[oó]|desarroll[oó])|tus desarrolladores)\b/i;
const IDENTITY_DRIFT_RX=/\b(?:soy|somos|me desarroll[oó]|mis desarrolladores|mi creador|mi empresa|pertenezco a|infraestructura de|centros de datos de)\s+(?:google|nvidia|openai|anthropic|meta|xai|microsoft|mistral)\b/i;
const PROVIDER_SELF_RX=/\bsoy (?:gemma|gemini|gpt|chatgpt|claude|grok|copilot|llama|mistral)\b/i;
const INTERNAL_RX=/Language Policy|RELEVANT MEMORY|MEMORIA CONTEXTUAL RECUPERADA|system_guidance|chain[- ]of[- ]thought|hidden reasoning/i;

const cleanText=(value,max=12000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);

export function normalizeConversationHistoryV103(history=[],limit=12){
  const rows=(Array.isArray(history)?history:[])
    .filter(x=>x&&['user','assistant'].includes(x.role))
    .map(x=>({role:x.role,text:cleanText(x.text??x.content,12000)}))
    .filter(x=>x.text&&!INTERNAL_RX.test(x.text));
  return rows.slice(-Math.max(2,Math.min(20,Number(limit)||12)));
}

export function contextualFollowupV103(message='',history=[]){
  const q=cleanText(message,500);
  const rows=normalizeConversationHistoryV103(history,12);
  if(!rows.length)return false;
  if(FOLLOWUP_RX.test(q))return true;
  if(q.length<=42&&/\b(eso|esa|ese|esto|aquello|anterior|último|ultimo|lo mismo|también|tambien)\b/i.test(q))return true;
  return false;
}

export function contextIntegrityInstructionV103({message='',history=[]}={}){
  const rows=normalizeConversationHistoryV103(history,12);
  const lastAssistant=[...rows].reverse().find(x=>x.role==='assistant')?.text||'';
  const lastUser=[...rows].reverse().find(x=>x.role==='user')?.text||'';
  const contextual=contextualFollowupV103(message,rows);
  const lines=[
    'CONTEXT INTEGRITY v103:',
    '- Tu identidad operativa es Universal Core, núcleo de inteligencia de WAE OS Enterprise. El proveedor o modelo subyacente es infraestructura y nunca sustituye tu identidad.',
    '- No afirmes que Google, NVIDIA, OpenAI, Anthropic, Meta, xAI, Microsoft o cualquier proveedor te creó, te posee o aporta tu hardware salvo que exista evidencia explícita del runtime para esa afirmación concreta.',
    '- Si te preguntan por hardware propio, distingue entre poseer hardware y ejecutarte sobre infraestructura de cómputo disponible. No inventes GPUs, TPUs, centros de datos ni fabricante.',
    '- Conserva el tema, las entidades, restricciones y objetivo del historial inmediato. No reinicies la conversación como si cada mensaje fuera independiente.'
  ];
  if(contextual&&lastAssistant){
    lines.push(`- El turno actual es una continuación dependiente del contexto. Interpreta "${cleanText(message,180)}" como respuesta o seguimiento directo al mensaje inmediatamente anterior del asistente: "${cleanText(lastAssistant,1200)}".`);
    lines.push('- Continúa exactamente ese hilo. No cambies de tema ni inventes una nueva preferencia, orden o intención que el usuario no expresó.');
  }else if(lastAssistant||lastUser){
    lines.push('- Usa primero los turnos más recientes para resolver referencias y pronombres; sólo después consulta memoria persistente más antigua.');
  }
  return `\n\n${lines.join('\n')}`;
}

export function identityGroundingReportV103({question='',answer=''}={}){
  const q=cleanText(question,1200),a=cleanText(answer,16000);
  const selfQuestion=SELF_RX.test(q);
  const providerIdentityDrift=selfQuestion&&(IDENTITY_DRIFT_RX.test(a)||PROVIDER_SELF_RX.test(a));
  return{
    version:CONTEXT_INTEGRITY_V103,
    selfQuestion,
    providerIdentityDrift,
    pass:!providerIdentityDrift,
    reason:providerIdentityDrift?'provider_identity_drift':null
  };
}

export function contextIntegrityCapabilitiesV103(){
  return{
    version:CONTEXT_INTEGRITY_V103,
    explicitRecentHistory:true,
    shortFollowupResolution:true,
    providerIdentityIsolation:true,
    hardwareClaimCalibration:true,
    persistentMemoryBackend:'wae_universal_memory_v103',
    rawUserKeyPersistence:false
  };
}
