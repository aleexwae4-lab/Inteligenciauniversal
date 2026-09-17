import modernChat from './chat.js';
import legacyCapacityChat from './capacity-chat-v91.js';

export const CAPACITY_CHAT_V105='capacity-chat/v105-conversation-routing-firewall';

const GENERAL_MODES=new Set(['','general','auto']);

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

  if(!q&&/[?¿]+/.test(raw))return'conversation';

  if(/\b(quien eres(?: tu)?|que eres(?: tu)?|que es universal core|quien eres tu como (?:ia|inteligencia artificial)|que eres como (?:ia|inteligencia artificial))\b/.test(q))return'identity';

  if(/^(?:hola|hey|buenas|buenos dias|buenas tardes|buenas noches)(?:\s+(?:quien eres(?: tu)?|que eres(?: tu)?|como estas|como te sientes|que tal))?$/.test(q))return'conversation';

  if(/^(?:como estas|como te sientes|como andas|que tal|te sientes bien|estas bien|todo bien)$/.test(q))return'conversation';

  if(/^(?:que puedes hacer|que sabes hacer|cuales son tus capacidades|que capacidades tienes|como puedes ayudarme|como funcionas|que tan inteligente eres)$/.test(q))return'capabilities';

  if(/^(?:gracias|muchas gracias|ok|okay|vale|perfecto|listo)$/.test(q))return'conversation';

  return'legacy';
}

function canonicalConversationMessage(body={}){
  const raw=String(body.message||body.task||body.prompt||body.query||'').trim();
  const q=normalize(raw);
  if(/^(?:te sientes bien|estas bien|todo bien)$/.test(q))return'¿Cómo estás?';
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
