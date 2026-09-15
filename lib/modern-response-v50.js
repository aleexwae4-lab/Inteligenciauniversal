export const MODERN_RESPONSE_VERSION='modern-response/v50';

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
  if(raw.length<=1400||safetyBoundary(raw))return raw;
  const paras=raw.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  const caveatRx=/^(no es posible|no puedo determinar|no puedo estimar|no existe una cifra|es importante aclarar|cabe señalar|sin acceso a|no tengo acceso a)/i;
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

function envelope(reply,{provider='universal_core',model='universal-core-modern-v50',fast=false}={}){
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

export function directModernAnswer(body={}){
  if(!simpleGeneral(body))return null;
  const q=norm(body.message||body.task||'');

  if(/\b(te puedes comparar|puedes compararte|como te comparas|compararte)\b.*\b(openai|chatgpt|gpt)\b|\b(openai|chatgpt|gpt)\b.*\b(te puedes comparar|como te comparas)\b/.test(q)){
    return envelope(
      'Sí. La comparación útil es por capacidades, no por marketing. **Universal Core** ya puede conversar, mantener contexto, usar voz, enrutar entre modelos, trabajar con herramientas y recuperarse de fallos. **OpenAI/ChatGPT** todavía tiene ventaja en madurez de modelos base, infraestructura global y consistencia a gran escala. La meta correcta es medir ambos con el mismo benchmark de razonamiento, código, investigación, latencia, costo y resiliencia; ahí sabremos exactamente dónde Universal Core gana y dónde todavía debe mejorar.',
      {model:'universal-core-comparison-v50',fast:true}
    );
  }

  if(/\b(cuanto|que tanto)\b.*\b(cuesta|costaria|costo|desarrollo|desarrollar)\b.*\b(universal core|tu desarrollo|sistema|plataforma)\b|\b(universal core|tu desarrollo)\b.*\b(cuesta|costaria|costo)\b/.test(q)){
    return envelope(
      'Sí, se puede hacer una **estimación de ingeniería**. Reconstruir desde cero una plataforma como Universal Core con un equipo senior podría representar aproximadamente **$2–8 M MXN** para una versión robusta funcional y **$8–20+ M MXN** si incluyes infraestructura de producción, seguridad, observabilidad, voz, orquestación multimodelo, QA y continuidad. No es una valuación de la empresa ni de la propiedad intelectual: es una referencia de costo de reconstrucción y depende del alcance, tiempo y equipo.',
      {model:'universal-core-estimate-v50',fast:true}
    );
  }

  return null;
}

export function modernizePayload(payload,body={}){
  if(!payload||typeof payload!=='object')return payload;
  const text=replyText(payload);
  if(!text||!simpleGeneral(body))return payload;
  const compact=compactGeneral(text);
  if(!compact||compact===text)return payload;
  const response=payload.response&&typeof payload.response==='object'?{...payload.response}:{content:compact};
  response.content=compact;
  response.speechText=compact;
  response.metadata={...(response.metadata||{}),modernResponse:true,modernResponseVersion:MODERN_RESPONSE_VERSION,compacted:true};
  return {...payload,reply:compact,speech_text:compact,response};
}
