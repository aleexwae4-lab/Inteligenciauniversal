import { allowRequest, applyHeaders } from '../lib/security.js';
import { openAIContinuityResponse } from '../lib/continuity.js';

const MAX_MESSAGES = 40;
const UNSUPPORTED = /No pude completar la generación avanzada en este intento/i;

function lastUser(messages = []) {
  return [...messages].reverse().find((item) => item?.role === 'user')?.content?.toString().trim() || '';
}

function casualReply(message = '') {
  const q = String(message).trim().toLowerCase().replace(/[¿?¡!.,]+/g, '').replace(/\s+/g, ' ');
  if (/^(cómo|como) (estás|estas|andas)$/.test(q)) {
    return 'Muy bien, gracias. Estoy listo para seguir contigo. ¿Qué quieres resolver, construir o investigar?';
  }
  if (/^(qué|que) haces$/.test(q)) {
    return 'Puedo conversar, investigar, analizar, programar, trabajar con contexto y archivos, y convertir una solicitud en una respuesta estructurada o un entregable.';
  }
  if (/^(quién|quien) eres$/.test(q)) {
    return 'Soy Universal Core, el núcleo de inteligencia de WAE OS Enterprise. Estoy diseñado para conversar, razonar sobre el contexto disponible y ayudarte a ejecutar trabajo con respuestas claras y verificables.';
  }
  if (/^(todo bien|cómo va|como va|qué tal|que tal)$/.test(q)) {
    return 'Todo operativo por aquí. Dime qué necesitas y continúo desde el contexto de esta conversación.';
  }
  return null;
}

export default async function continuityHandler(req, res) {
  applyHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'method_not_allowed' } });
  if (!allowRequest(req, Number(process.env.WAE_CONTINUITY_RATE_LIMIT_PER_MINUTE || 120))) {
    return res.status(429).json({ error: { message: 'rate_limited' } });
  }

  const body = req.body || {};
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
    return res.status(422).json({ error: { message: 'messages_required' } });
  }

  const quick = casualReply(lastUser(body.messages));
  if (quick) {
    const response = openAIContinuityResponse({ messages:[{role:'user',content:'hola'}] });
    response.choices[0].message.content = quick;
    response.model = 'universal-core-continuity-v1';
    response.usage.completion_tokens = Math.max(1, Math.ceil(quick.length / 4));
    response.usage.total_tokens = response.usage.prompt_tokens + response.usage.completion_tokens;
    response.continuity = { ...(response.continuity || {}), conversational_fast_path:true };
    res.setHeader('X-WAE-Core', 'continuity-v1');
    return res.status(200).json(response);
  }

  const response = openAIContinuityResponse(body);
  const content = response?.choices?.[0]?.message?.content || '';

  // Continuity is a deterministic safety net, not a substitute for a generative model.
  // If it cannot truly answer, signal the router so it can continue to the next available model.
  if (UNSUPPORTED.test(content)) {
    res.setHeader('X-WAE-Core', 'continuity-v1');
    res.setHeader('X-WAE-Continuity', 'pass-through');
    return res.status(422).json({ error: { message: 'continuity_pass_through' } });
  }

  res.setHeader('X-WAE-Core', 'continuity-v1');
  return res.status(200).json(response);
}
