export const ANSWER_CONTINUITY_V101='answer-continuity/v101-no-empty-terminal-state';

const clean=(value,max=40000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const normalize=value=>clean(value,40000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

const GENERIC_FAILURE_RX=/(no pude completar(?: la respuesta)?|no pude responder|proveedores disponibles|todos los proveedores.*fallaron|all providers failed|capacity[_ ]busy|runtime.*unavailable|intenta nuevamente|reintenta(?: en breve)?|temporarily unavailable|service unavailable)/i;

export function replyOfV101(payload={}){
  return clean(payload?.reply??payload?.response?.content??payload?.answer??payload?.output_text??'',100000);
}

export function answerIsUsableV101(status=200,payload={}){
  const reply=replyOfV101(payload);
  if(Number(status)>=500||!reply)return false;
  if(GENERIC_FAILURE_RX.test(reply)&&reply.length<700)return false;
  return true;
}

export function shouldRecoverAnswerV101(status=200,payload={}){
  if(answerIsUsableV101(status,payload))return false;
  const numericStatus=Number(status)||0;
  const code=clean(payload?.error||payload?.code||'',120).toUpperCase();
  if([401,403,405,429].includes(numericStatus))return false;
  if(['METHOD_NOT_ALLOWED','ORIGIN_NOT_ALLOWED','RATE_LIMITED','SPECIALIST_RATE_LIMITED','UNAUTHORIZED','FORBIDDEN'].includes(code))return false;
  return numericStatus>=500||payload?.recoverable===true||!replyOfV101(payload)||GENERIC_FAILURE_RX.test(replyOfV101(payload));
}

function arithmeticReply(message=''){
  const q=clean(message,200).replace(/,/g,'').trim();
  const match=q.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/x×])\s*(-?\d+(?:\.\d+)?)$/i);
  if(!match)return null;
  const a=Number(match[1]),b=Number(match[3]),op=match[2].toLowerCase();
  let result=null;
  if(op==='+')result=a+b;
  else if(op==='-')result=a-b;
  else if(op==='*'||op==='x'||op==='×')result=a*b;
  else if(op==='/')result=b===0?null:a/b;
  if(!Number.isFinite(result))return b===0?'No es posible dividir entre cero.':null;
  return `${a} ${match[2]} ${b} = **${Number(result.toPrecision(15))}**`;
}

export function classifyContinuityIntentV101(body={}){
  const q=normalize(body?.message||body?.task||body?.prompt||'');
  if(!q)return'empty';
  if(/^[-+]?\d+(?:\.\d+)?\s*[+\-*/x×]\s*[-+]?\d+(?:\.\d+)?$/.test(q))return'arithmetic';
  if(/\b(quien eres|que eres|universal core|capacidades|que puedes hacer|de que eres capaz|astra|chatgpt|claude|gemini|grok)\b/.test(q))return'self_awareness';
  if(/\b(hoy|actual|actualmente|reciente|latest|noticias|precio|cotizacion|ley vigente|jurisprudencia|fuentes|evidencia|investiga)\b/.test(q))return'current_factual';
  if(/\b(codigo|typescript|javascript|python|sql|backend|frontend|debug|arquitectura|deploy|github|supabase|render)\b/.test(q))return'engineering';
  if(/\b(escribe|redacta|reescribe|corrige|traduce|resume|poema|cuento|guion|copy|correo|mensaje|post)\b/.test(q))return'transformation';
  return'general';
}

export function localContinuityReplyV101(body={}){
  const message=clean(body?.message||body?.task||body?.prompt||'',24000);
  const arithmetic=arithmeticReply(message);
  if(arithmetic)return arithmetic;
  const intent=classifyContinuityIntentV101(body);
  if(intent==='current_factual'){
    return 'La ruta generativa avanzada no produjo una salida verificable. Para no inventar un dato actual, Universal Core conserva el turno en **modo factual seguro**: la respuesta debe reconstruirse desde fuentes verificadas antes de afirmar fechas, precios, leyes, noticias o cifras recientes.';
  }
  if(intent==='engineering'){
    return 'La ruta generativa avanzada no produjo una salida verificable, pero el turno no queda vacío. **Modo de continuidad de ingeniería:** conserva el cambio actual, evita modificar producción sin pruebas y continúa desde un diagnóstico reproducible con implementación mínima, test de regresión y rollback. No marcaré una corrección como terminada sin evidencia de ejecución.';
  }
  if(intent==='transformation'){
    return 'La ruta generativa avanzada no produjo una salida verificable. Para no degradar tu texto con una transformación incompleta, Universal Core conserva el contenido original y bloquea una salida inventada o truncada. El turno queda identificado como recuperable y debe ser reejecutado por una ruta generativa sana.';
  }
  if(intent==='self_awareness')return null;
  return 'Universal Core no entregará una respuesta vacía ni fingirá haber completado una tarea. La ruta generativa avanzada no produjo una salida verificable; el sistema conserva la solicitud y entra en continuidad segura, manteniendo contexto, restricciones y trazabilidad para que la siguiente ruta sana continúe exactamente desde este punto.';
}

export function continuityEnvelopeV101({body={},reply='',reason='terminal_recovery',failure=null}={}){
  const text=clean(reply||localContinuityReplyV101(body),80000);
  if(!text)return null;
  const requestId=crypto.randomUUID();
  return{
    success:true,
    reply:text,
    speech_text:text,
    response:{
      content:text,
      speechText:text,
      components:[],
      metadata:{
        requestId,
        degraded:true,
        answerContinuity:{version:ANSWER_CONTINUITY_V101,reason:clean(reason,100),terminalEmptyStatePrevented:true,originalError:clean(failure?.error||failure?.message||failure||'',160)}
      }
    },
    provider:'universal_core',
    model:'answer-continuity-v101',
    degraded:true,
    recoverable:true,
    request_id:requestId,
    answer_continuity:{version:ANSWER_CONTINUITY_V101,reason:clean(reason,100),terminal_empty_state_prevented:true},
    web_sources:[]
  };
}

export function answerContinuityCapabilitiesV101(){
  return{
    version:ANSWER_CONTINUITY_V101,
    emptyTerminalAnswersBlocked:true,
    genericProviderFailureTerminalAnswersBlocked:true,
    specialistSaturationMustDegradeToCorePath:true,
    advancedRoutingSaturationMustDegradeToBasePath:true,
    securityAndAuthorizationFailuresRemainFailClosed:true,
    rateLimitsRemainFailClosed:true,
    currentFactsNeverFabricatedDuringDegradation:true,
    deterministicArithmeticFallback:true,
  };
}
