export const MODERN_RESPONSE_VERSION='premium-response/v106';

const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const replyText=payload=>String(payload?.reply||payload?.response?.content||'').trim();

function explicitDepth(message=''){
  const q=norm(message);
  return /\b(detallad[oa]|profund[oa]|exhaustiv[oa]|paso a paso|informe|reporte|tabla|comparacion completa|analisis completo|explica a fondo|codigo|implementa|arquitectura|investiga|fuentes|evidencia)\b/.test(q);
}

function simpleGeneral(body={}){
  const mode=norm(body.mode||body.agent||'general');
  if(!['general','auto',''].includes(mode))return false;
  if(body.web_enabled===true)return false;
  if(Array.isArray(body.attachments)&&body.attachments.length)return false;
  const q=String(body.message||body.task||'').trim();
  return q.length>0&&q.length<=420&&!explicitDepth(q);
}

function explicitCompact(body={}){
  const style=norm(body?.preferences?.responseStyle||body?.response_style||'');
  return style==='compact'||style==='concise'||body?.compact_response===true||body?.voice_compact===true;
}

function safetyBoundary(text=''){
  return /\b(no puedo ayudar|no puedo proporcionar|no puedo dar instrucciones|no puedo colaborar)\b/i.test(text)
    && /\b(arma|explosiv|veneno|suicid|autoles|matar|dañar|malware|ransomware|robar|hackear|credencial|contraseña)\b/i.test(text);
}

function finishSentence(text,max=1150){
  if(text.length<=max)return text;
  const slice=text.slice(0,max);
  const idx=Math.max(slice.lastIndexOf('. '),slice.lastIndexOf('? '),slice.lastIndexOf('! '),slice.lastIndexOf('\n\n'));
  return (idx>Math.floor(max*0.58)?slice.slice(0,idx+1):slice).trim();
}

function compactGeneral(text=''){
  const raw=String(text||'').trim();
  if(safetyBoundary(raw))return raw;
  const paras=raw.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  const caveatRx=/^(no es posible|no puedo determinar|no puedo estimar|no existe una cifra|no hay datos oficiales|es importante aclarar|cabe señalar|sin acceso a|no tengo acceso a)/i;
  const firstIsCaveat=paras.length>1&&caveatRx.test(paras[0]);
  if(raw.length<=1400&&!firstIsCaveat)return raw;
  const useful=paras.filter(p=>!caveatRx.test(p));
  const caveats=paras.filter(p=>caveatRx.test(p));
  const selected=[];
  for(const p of useful){
    if(selected.join('\n\n').length+p.length>1080)break;
    selected.push(p);
    if(selected.length>=4)break;
  }
  if(!selected.length)selected.push(paras[0]||raw);
  if(caveats.length&&selected.join('\n\n').length<900){
    selected.push('Matiz: '+finishSentence(caveats[0].replace(/^([^:]{0,35}:\s*)?/,'').trim(),220));
  }
  return finishSentence(selected.join('\n\n'),1200);
}

function envelope(reply,{provider='universal_core',model='universal-core-modern-v51',fast=false}={}){
  const text=String(reply||'').trim();
  return {
    success:true,
    reply:text,
    speech_text:text,
    response:{content:text,speechText:text,metadata:{modernResponse:true,modernResponseVersion:MODERN_RESPONSE_VERSION,fastLane:fast}},
    provider,
    model,
    fast_lane:fast,
    fast_lane_version:fast?MODERN_RESPONSE_VERSION:undefined,
    web_sources:[]
  };
}

function engineeringEstimateIntent(q=''){
  const estimate=/\b(cuanto|cueste|cuesta|costaria|coste|costo|costos|valor|vale|valdria|estimacion|estima|estimar|aproximad[oa])\b/.test(q);
  const build=/\b(desarroll|desarrollo|constru|crear|ingenier|software|sistema|plataforma|aplicacion|app|saas|inteligencia artificial|\bia\b|universal core|wae|modelo|chatbot|gpt)\b/.test(q);
  const currentMarket=/\b(hoy|actual|precio actual|cotizacion|mercado hoy|lista de precios)\b/.test(q);
  return estimate&&build&&!currentMarket;
}

function engineeringEstimateReply(q=''){
  const self=/\b(tu desarrollo|universal core|wae|este sistema|esta plataforma)\b/.test(q);
  const enterprise=/\b(enterprise|multi.?tenant|multimodel|voz|seguridad|observabilidad|alta disponibilidad|miles de usuarios|agentes|herramientas|memoria|rag)\b/.test(q)||self;
  const simple=/\b(mvp|prototipo|simple|basica|pequena|pequeña)\b/.test(q)&&!enterprise;

  if(self){
    return 'Sí. **Yo estimaría el costo de reconstrucción de Universal Core en aproximadamente $6–18 M MXN** para una versión robusta de producción, y **$15–30+ M MXN** si se lleva a nivel enterprise con alta disponibilidad, seguridad endurecida, observabilidad, voz, memoria, herramientas, orquestación multimodelo y capacidad para alta concurrencia.\n\nLa base del cálculo es de ingeniería: **5–8 perfiles senior × 8–12 meses × ~$100k–$180k MXN por persona/mes fully-loaded = ~$4–17 M MXN**, más aproximadamente **20–35%** para QA, DevOps/SRE, seguridad, producto, pruebas e infraestructura.\n\nEso es **costo de reconstrucción**, no valuación de la empresa ni de la propiedad intelectual. Como estimación de ingeniería, el rango me parece defendible; la cifra exacta dependería del SLA, escala y nivel de certificación exigido.';
  }

  if(simple){
    return 'Sí, se puede estimar. Para un **MVP de software/IA bien hecho**, usaría como referencia **$500k–$2 M MXN**. Un producto ya listo para producción suele moverse más cerca de **$2–8 M MXN**, dependiendo de backend, frontend, IA, seguridad, QA e infraestructura. La forma correcta de afinarlo es calcular **equipo × meses × costo fully-loaded** y sumar entre **20–35%** para QA, DevOps, producto y contingencia.';
  }

  return 'Sí, puedo sacar un estimado útil aunque no exista una cifra oficial. Para una **plataforma de software/IA de producción**, usaría tres escenarios: **MVP: $0.5–2 M MXN**, **producción robusta: $2–8 M MXN**, y **enterprise: $8–25+ M MXN**.\n\nLa estimación se construye con **número de perfiles senior × meses de desarrollo × costo mensual fully-loaded**, y después se agrega normalmente **20–35%** para QA, DevOps/SRE, seguridad, producto, infraestructura y contingencia. Si me das alcance, usuarios esperados, integraciones y SLA, puedo estrechar el rango mucho más.';
}

export function directModernAnswer(body={}){
  if(!simpleGeneral(body))return null;
  const q=norm(body.message||body.task||'');

  if(/\b(te puedes comparar|puedes compararte|como te comparas|compararte)\b.*\b(openai|chatgpt|gpt)\b|\b(openai|chatgpt|gpt)\b.*\b(te puedes comparar|como te comparas)\b/.test(q)){
    return envelope(
      'Sí. La comparación útil es por capacidades, no por marketing. **Universal Core** ya puede conversar, mantener contexto, usar voz, enrutar entre modelos, trabajar con herramientas y recuperarse de fallos. **OpenAI/ChatGPT** todavía tiene ventaja en madurez de modelos base, infraestructura global y consistencia a gran escala. La forma seria de compararlos es con el mismo benchmark de razonamiento, código, investigación, latencia, costo y resiliencia; ahí veremos exactamente dónde Universal Core gana y dónde todavía debe mejorar.',
      {model:'universal-core-comparison-v51',fast:true}
    );
  }

  if(engineeringEstimateIntent(q)){
    return envelope(engineeringEstimateReply(q),{model:'universal-core-engineering-estimator-v51',fast:true});
  }

  return null;
}

export function modernizePayload(payload,body={}){
  if(!payload||typeof payload!=='object')return payload;
  const text=replyText(payload);
  if(!text||!simpleGeneral(body))return payload;
  const q=norm(body.message||body.task||'');
  if(engineeringEstimateIntent(q)&&/no es posible|no puedo determinar|no puedo estimar|no hay datos oficiales|no existe una cifra/i.test(text)){
    return envelope(engineeringEstimateReply(q),{provider:payload.provider||'universal_core',model:'universal-core-engineering-estimator-v51',fast:true});
  }

  // Premium-rich is the default product experience. Do not truncate a good model answer
  // just because the client is mobile. Compact only when the caller explicitly requests it.
  if(!explicitCompact(body))return payload;

  const compact=compactGeneral(text);
  if(!compact||compact===text)return payload;
  const response=payload.response&&typeof payload.response==='object'?{...payload.response}:{content:compact};
  response.content=compact;
  response.speechText=compact;
  response.metadata={...(response.metadata||{}),modernResponse:true,modernResponseVersion:MODERN_RESPONSE_VERSION,compacted:true};
  return {...payload,reply:compact,speech_text:compact,response};
}