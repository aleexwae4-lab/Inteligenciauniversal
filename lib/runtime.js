import { getAgent } from './agents.js';
import { generateWithFallback, providerRegistry } from './providers.js';
import { runTools, formatToolContext, toolRegistry } from './tools.js';
import { recallMemory, saveTurn, formatMemoryContext, memoryStatus } from './memory.js';

function sanitizeAttachments(attachments=[]) {
  return attachments.slice(0,5).filter(a => a && typeof a.name === 'string' && typeof a.text === 'string')
    .map(a => ({ name:a.name.slice(0,180), type:String(a.type||'text/plain').slice(0,100), text:a.text.slice(0,120000) }));
}

function attachmentContext(attachments=[]) {
  if (!attachments.length) return '';
  return `\n\nARCHIVOS ADJUNTOS:\n${attachments.map(a => `\n--- ${a.name} (${a.type}) ---\n${a.text}`).join('\n')}`;
}

export function runtimeHealth() {
  const providers = providerRegistry();
  const tools = toolRegistry();
  return {
    ok:true,
    service:'wae-universal-runtime',
    version:'1.0.0',
    providers,
    tools,
    memory:memoryStatus(),
    ready:providers.some(p=>p.configured)
  };
}

export async function executeMission(payload={}) {
  const started = Date.now();
  const message = String(payload.message || payload.task || '').trim();
  if (!message) throw Object.assign(new Error('message es obligatorio'), { statusCode:400 });
  if (message.length > 30000) throw Object.assign(new Error('message excede 30,000 caracteres'), { statusCode:413 });

  const mode = String(payload.mode || payload.agent || 'general');
  const agent = getAgent(mode);
  const userKey = String(payload.userKey || payload.sessionId || 'anonymous').slice(0,160);
  const sessionId = String(payload.sessionId || '').slice(0,160);
  const history = Array.isArray(payload.history) ? payload.history : [];
  const attachments = sanitizeAttachments(payload.attachments);
  const memory = await recallMemory(userKey, message, 6);
  const toolResults = await runTools({ agent, message, requestedTools:Array.isArray(payload.tools)?payload.tools:[] });

  const system = `${agent.system}\n\nReglas del runtime: identifica límites reales; si una integración no está disponible dilo; prioriza seguridad y reversibilidad; no afirmes que ejecutaste acciones externas salvo que aparezcan en EVIDENCIA DE HERRAMIENTAS.`;
  const enrichedMessage = `${message}${attachmentContext(attachments)}${formatMemoryContext(memory)}${formatToolContext(toolResults)}`;
  const generated = await generateWithFallback({ provider:String(payload.provider || 'auto'), system, message:enrichedMessage, history });

  await saveTurn(userKey, sessionId, message, generated.text, { provider:generated.provider, model:generated.model, agent:agent.id, tools:toolResults.map(x=>x.tool) });

  return {
    reply:generated.text,
    provider:generated.provider,
    model:generated.model,
    agent:{ id:agent.id, name:agent.name },
    tools:toolResults,
    memory:{ recalled:memory.length, persistent:memoryStatus().configured },
    usage:generated.usage || null,
    latencyMs:Date.now()-started,
    fallbackFailures:generated.failures || []
  };
}
