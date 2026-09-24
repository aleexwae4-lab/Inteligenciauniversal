import modernChat from './chat.js';
import legacyCapacityChat from './capacity-chat-v91.js';

export const CAPACITY_CHAT_V105='capacity-chat/v105-conversation-routing-firewall';

const GENERAL_MODES=new Set(['','general','auto']);
const GENERATIVE_RX=/\b(crea|crear|genera|generar|redacta|redactar|escribe|escribir|elabora|elaborar|desarrolla|desarrollar|hazme|haz)\b/;
const VERIFIED_DOMAIN_RX=/\b(hoy|actual|actualmente|reciente|latest|noticias|fuentes?|evidencia|investiga|investigacion|verifica|medic|salud|diagnostic|tratamiento|dosis|farmacol|legal|juridic|penal|delito|jurisprudencia|ley vigente|fiscal|tributar|inversion|credito|fraude)\b/;

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
    || (Array.isArray(body.attachments)&&body.attachments.length>0)
    || (provider&&provider!=='auto');
}

export function conversationRoutingClassV105(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const raw=String(body.message||body.task||body.prompt||body.query||'').trim();
  const q=normalize(raw);
  if(!GENERAL_MODES.has(mode)||hasExternalIntent(body)||!raw)return'legacy';

  // Current, research and high-impact factual requests retain the governed evidence stack.
  if(VERIFIED_DOMAIN_RX.test(q))return'legacy';

  if(!q&&/[?¿]+/.test(raw))return'conversation';

  if(/^(?:hola|hey|buenas|buenos dias|buenas tardes|buenas noches)(?:\s+(?:quien eres(?: tu)?|que eres(?: tu)?|como estas|como te sientes|que tal))?$/.test(q))return'conversation';

  if(/\b(quien eres(?: tu)?|que eres(?: tu)?|que es universal core|quien eres tu como (?:ia|inteligencia artificial)|que eres como (?:ia|inteligencia artificial))\b/.test(q))return'identity';

  if(/^(?:como estas|como te sientes|como andas|que tal|te sientes bien|estas bien|todo bien)$/.test(q))return'conversation';

  if(/^(?:(?:hola|hey|buenas)\s+)?(?:que sabes|que sabes hacer|que puedes hacer|cuales son tus capacidades|que capacidades tienes|como puedes ayudarme|como funcionas|que tan inteligente eres)$/.test(q))return'capabilities';

  if(GENERATIVE_RX.test(q))return'creative';

  if(/^(?:gracias|muchas gracias|ok|okay|vale|perfecto|listo)$/.test(q))return'conversation';

  // Stable factual questions, explanations and ordinary conversation use the premium
  // generative brain by default. Retrieval is an augmentation, not the primary answerer.
  return'premium';
}

function canonicalConversationMessage(body={}){
  const raw=String(body.message||body.task||body.prompt||body.query||'').trim();
  const q=normalize(raw);
  if(/^(?:te sientes bien|estas bien|todo bien)$/.test(q))return'¿Cómo estás?';
  if(/^(?:(?:hola|hey|buenas)\s+)?(?:que sabes|que sabes hacer)$/.test(q))return'¿Qué puedes hacer?';
  return raw;
}

export default async function capacityChatV105(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const route=conversationRoutingClassV105(body);
  res.setHeader('X-WAE-Conversation-Router',CAPACITY_CHAT_V105);
  res.setHeader('X-WAE-Conversation-Route',route);

  if(route==='legacy')return legacyCapacityChat(req,res);

  const original=req.body;
  req.body={...body,message:canonicalConversationMessage(body),conversation_router:CAPACITY_CHAT_V105};
  try{
    return await modernChat(req,res);
  }finally{
    req.body=original;
  }
}
