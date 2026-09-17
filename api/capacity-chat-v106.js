import modernChat from './chat.js';
import legacyCapacityChat from './capacity-chat-v91.js';

export const CAPACITY_CHAT_V106='capacity-chat/v106-universal-runtime-first';

const GENERAL_MODES=new Set(['','general','auto']);

const CURRENT_OR_RESEARCH_RX=/\b(hoy|ahora|actual(?:es|idad|izado|izada)?|reciente|recientes|ultim[oa]s?|latest|today|current|noticias|news|precio|cotizacion|jurisprudencia|reforma|ley vigente|verifica|verificar|fuentes?|evidencia|investiga|investigacion|research|paper|papers|estado del arte|benchmark actual|tendencia actual)\b/i;
const HIGH_IMPACT_RX=/\b(medic\w*|diagnost\w*|tratamiento\w*|dosis|farmac\w*|legal\w*|juridic\w*|penal\w*|delito\w*|fiscal\w*|tributar\w*|inversion\w*|credito\w*|fraude\w*|seguridad critica|high[- ]risk)\b/i;

function normalize(value=''){
  return String(value||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[¿?¡!.,;:]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function hasExternalIntent(body={}){
  const provider=String(body.provider||'auto').trim().toLowerCase();
  return body.web_enabled===true
    || body.knowledge===true
    || body.universal_knowledge===true
    || body.fusion===true
    || (Array.isArray(body.attachments)&&body.attachments.length>0)
    || (provider&&provider!=='auto');
}

function explicitSpecialistIntent(body={}){
  return body.multiagent===true
    || body.deep===true
    || body.orchestrate===true
    || (Array.isArray(body.specialists)&&body.specialists.length>0);
}

function highImpactIntent(raw='',q=''){
  // High-impact domains remain on the verified evidence stack. A plain mention
  // is not enough for harmless meta/product discussions, so require either a
  // concrete advisory/action verb or an explicit high-risk phrase.
  if(/\b(seguridad critica|high[- ]risk)\b/i.test(q))return true;
  if(!HIGH_IMPACT_RX.test(q))return false;
  return /\b(analiza|evalua|diagnostica|recomienda|tratamiento|dosis|prescribe|asesora|estrategia legal|demanda|denuncia|defensa|inversion|credito|tributar|fiscal|riesgo|fraude)\b/i.test(raw);
}

export function universalRoutingClassV106(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const raw=String(body.message||body.task||body.prompt||body.query||'').trim();
  const q=normalize(raw);

  if(!raw)return'legacy';
  if(!GENERAL_MODES.has(mode)||hasExternalIntent(body)||explicitSpecialistIntent(body))return'legacy';

  if(!q&&/[?¿]+/.test(raw))return'conversation';
  if(/\b(quien eres(?: tu)?|que eres(?: tu)?|que es universal core|quien eres tu como (?:ia|inteligencia artificial)|que eres como (?:ia|inteligencia artificial))\b/.test(q))return'identity';
  if(/^(?:hola|hey|buenas|buenos dias|buenas tardes|buenas noches)(?:\s+(?:quien eres(?: tu)?|que eres(?: tu)?|como estas|como te sientes|que tal))?$/.test(q))return'conversation';
  if(/^(?:como estas|como te sientes|como andas|que tal|te sientes bien|estas bien|todo bien)$/.test(q))return'conversation';
  if(/^(?:que puedes hacer|que sabes hacer|cuales son tus capacidades|que capacidades tienes|como puedes ayudarme|como funcionas|que tan inteligente eres)$/.test(q))return'capabilities';
  if(/^(?:gracias|muchas gracias|ok|okay|vale|perfecto|listo)$/.test(q))return'conversation';

  // Current facts, explicit research/evidence and high-impact advice keep the
  // evidence-first legacy stack. Stable knowledge, reasoning, writing, coding,
  // planning and normal conversation use the modern Universal Core runtime.
  if(CURRENT_OR_RESEARCH_RX.test(q)||highImpactIntent(raw,q))return'legacy';
  return'universal';
}

function canonicalConversationMessage(body={}){
  const raw=String(body.message||body.task||body.prompt||body.query||'').trim();
  const q=normalize(raw);
  if(/^(?:te sientes bien|estas bien|todo bien)$/.test(q))return'¿Cómo estás?';
  return raw;
}

export default async function capacityChatV106(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const route=universalRoutingClassV106(body);
  res.setHeader('X-WAE-Universal-Router',CAPACITY_CHAT_V106);
  res.setHeader('X-WAE-Universal-Route',route);

  if(route==='legacy')return legacyCapacityChat(req,res);

  const original=req.body;
  req.body={
    ...body,
    message:canonicalConversationMessage(body),
    universal_router:CAPACITY_CHAT_V106,
    universal_runtime_first:true
  };
  try{
    return await modernChat(req,res);
  }finally{
    req.body=original;
  }
}
