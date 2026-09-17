import { buildAssistantResponse } from './response.js';
import { evaluateAnswer } from './quality.js';

export const ANSWER_ASSURANCE_V101='answer-assurance/v101';

const clean=(value,max=30000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const normalize=value=>clean(value,30000)
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();

const CURRENT_OR_HIGH_STAKES_RX=/\b(hoy|actual|actualmente|reciente|latest|today|current|noticias|news|precio|cotizaci[oó]n|jurisprudencia|reforma|ley vigente|m[eé]dic|salud|diagn[oó]stic|tratamiento|dosis|legal|jur[ií]dic|penal|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude)\b/i;
const EXACT_OK_RX=/^(?:responde )?(?:exactamente |solamente |solo )?(?:con )?(?:la )?palabra ok[.!]?$/i;

export function answerAssuranceEligibleV101(error={}){
  const code=clean(error?.code,120).toUpperCase();
  const message=clean(error?.message,500);
  if(['RUNTIME_DEADLINE','RESCUE_DEADLINE','NO_PROVIDER','ALL_PROVIDERS_FAILED','LOW_QUALITY'].includes(code))return true;
  if(Number(error?.statusCode)===503||Number(error?.status)===503)return true;
  return /all_models_unavailable|all.*providers.*failed|continuity_pass_through|quality_gate_rejected|runtime_deadline/i.test(message);
}

export function assuranceRecoveryPlanV101(error={}){
  const deadline=clean(error?.code,120).toUpperCase()==='RUNTIME_DEADLINE';
  return{
    version:ANSWER_ASSURANCE_V101,
    eligible:answerAssuranceEligibleV101(error),
    deadline,
    stages:deadline
      ?['local_rescue','emergency_generation','bounded_continuity']
      :['specialized_rescue','emergency_generation','bounded_continuity'],
    rescueBudgetMs:deadline?1_500:2_500,
    emergencyBudgetMs:6_000,
  };
}

function objectiveLine(message=''){
  const compact=clean(message,800).replace(/\s+/g,' ');
  if(!compact)return 'resolver la solicitud original';
  return compact.length<=240?compact:`${compact.slice(0,237)}...`;
}

export function boundedContinuityTextV101(body={},error={}){
  const message=clean(body?.message||body?.task||body?.prompt,30000);
  const normalized=normalize(message);
  if(EXACT_OK_RX.test(normalized))return 'OK';

  const objective=objectiveLine(message);
  if(CURRENT_OR_HIGH_STAKES_RX.test(message)){
    return `Tu consulta sigue activa, pero para responderla con rigor necesito una ruta de generación o evidencia verificable disponible. No voy a completar datos actuales o de alto impacto por inferencia. Objetivo preservado: **${objective}**. Puedes reintentar la misma solicitud; Universal Core conservará el criterio de no inventar hechos mientras recupera una ruta válida.`;
  }

  return `Tu solicitud quedó preservada, pero ninguna ruta produjo una respuesta que alcanzara el umbral mínimo de calidad dentro de este intento. No voy a sustituirla con contenido inventado. Objetivo preservado: **${objective}**. Puedes enviar la misma instrucción otra vez; el sistema volverá a enrutarla por las rutas disponibles sin necesitar que reconstruyas el contexto.`;
}

export function buildBoundedContinuityV101({body={},userKey='',error=null}={}){
  const message=clean(body?.message||body?.task||body?.prompt,30000);
  if(!message)return null;
  const text=boundedContinuityTextV101(body,error||{});
  const requestId=crypto.randomUUID();
  const quality=evaluateAnswer({question:message,answer:text,mode:String(body?.mode||'general'),sources:[]});
  const response=buildAssistantResponse({
    content:text,
    sources:[],
    provider:'universal_core',
    model:'universal-core-assurance-v101',
    latencyMs:0,
    memoryCount:0,
    requestId,
    webUsed:false,
    degraded:true,
  });
  const assurance={
    version:ANSWER_ASSURANCE_V101,
    stage:'bounded_continuity',
    recovered:false,
    finalSafeFallback:true,
    originalError:clean(error?.code||error?.message||'runtime_failure',120),
    qualityClaimed:false,
  };
  response.metadata={...response.metadata,answerAssurance:assurance,quality};
  return{
    success:true,
    reply:text,
    speech_text:response.speechText,
    response,
    components:response.components,
    actions:response.actions,
    web_sources:[],
    request_id:requestId,
    response_schema:response.schema,
    provider:'universal_core',
    model:'universal-core-assurance-v101',
    degraded:true,
    tools:[],
    memory:{recalled:0,persistent:false},
    usage:null,
    latencyMs:0,
    fallbackFailures:[],
    quality,
    cognitive_policy:{path:'answer_assurance_v101'},
    resilience:{active:true,path:ANSWER_ASSURANCE_V101,stage:'bounded_continuity'},
    answer_assurance:assurance,
    user_key:userKey,
  };
}

export function markAssuredPayloadV101(payload={},stage='recovered',error=null){
  if(!payload||typeof payload!=='object')return payload;
  const assurance={
    version:ANSWER_ASSURANCE_V101,
    stage:clean(stage,80)||'recovered',
    recovered:true,
    finalSafeFallback:false,
    originalError:clean(error?.code||error?.message||'runtime_failure',120),
    qualityClaimed:true,
  };
  if(payload.response&&typeof payload.response==='object'){
    payload.response={...payload.response,metadata:{...(payload.response.metadata||{}),answerAssurance:assurance}};
  }
  return{...payload,answer_assurance:assurance};
}
