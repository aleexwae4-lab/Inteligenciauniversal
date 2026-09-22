import { getAgent } from './agents.js';
import { planIndustrialMission, industrialSystemInstruction, publicIndustrialPlan, industrialCatalog, UNIVERSAL_INDUSTRIAL_VERSION } from './universal-industrial-v115.js';
import { planProfessionalMission, professionalSystemInstruction, publicProfessionalPlan, professionalCatalog, projectEconomics, PROFESSIONAL_ECONOMICS_VERSION } from './universal-professional-v116.js';
import { planWorldMission, worldSystemInstruction, publicWorldPlan, worldCatalog, WORLD_INTELLIGENCE_VERSION } from './universal-world-intelligence-v117.js';
import { QUALITY_GUIDANCE, needsWebResearch, appendSourceLinks } from './response-quality.js';
import { formatPreferences, formatProject } from './preferences.js';
import { isCoreSelfQuery, coreSelfResponse } from './core-self-description.js';
import { isCoreComparison, CORE_COMPARISON_GROUNDING, coreComparisonIssue, coreComparisonFastAnswer } from './core-comparison-v9.js';
import { generateWithFallback, providerRegistry } from './providers.js';
import { runTools, formatToolContext, toolRegistry } from './tools.js';
import {researchCapabilities} from './live-research-v119.js';
import {collaborationCapabilities} from './live-collaboration-v119.js';
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
    industrialEngineering:{version:UNIVERSAL_INDUSTRIAL_VERSION,sectorCount:industrialCatalog().domains.length,specialistProfiles:industrialCatalog().specialistProfileCount,assistance:'design-build-diagnose-repair-maintain-operate-direct',physicalExecution:false},
    professionalEconomics:{version:PROFESSIONAL_ECONOMICS_VERSION,domainCount:professionalCatalog().domainCount,specialistProfiles:professionalCatalog().specialistProfileCount,calculator:'explicit-input-unit-economics',automatedInvestments:false,guaranteedReturns:false},
    worldIntelligence:{version:WORLD_INTELLIGENCE_VERSION,domainCount:worldCatalog().domainCount,specialistProfiles:worldCatalog().specialistProfileCount,method:'evidence-to-pilot-to-scale',realWorldIntervention:false,unverifiedOutcomes:false},
    research:researchCapabilities(),collaboration:collaborationCapabilities(), 
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
  if (payload.canvas_blueprint === true) {
    const blueprintSystem = 'Devuelve solo JSON válido con brand, eyebrow, headline, subheadline, cta, story, contact, palette, features y slides. No HTML ni Markdown. Especificidad editorial y fidelidad a la marca solicitada. No inventes cifras, dirección, contacto o resultados; cierra siempre el JSON.';
    const generated = await generateWithFallback({ provider:String(payload.provider||'auto'), system:blueprintSystem, message:message+formatPreferences(payload.preferences)+formatProject(payload.project), history:[] });
    return { reply:generated.text,provider:generated.provider,model:generated.model,agent:{id:'code',name:'Canvas Blueprint'},tools:[],usage:generated.usage||null,latencyMs:Date.now()-started,canvas_blueprint:true };
  }
  if (payload.canvas === true) {
    const canvasSystem = 'Eres un ingeniero frontend especializado en Canvas HTML de WAE OS Enterprise. Devuelve exclusivamente un archivo HTML COMPLETO y autocontenido: <!doctype html> ... </html>, sin Markdown, sin comentarios antes ni después. Prioriza mobile-first, meta viewport, CSS integrado y JavaScript mínimo funcional; diseño limpio y texto legible. Crea una sola pantalla si el límite de salida es corto y cierra siempre body y html. No inventes conexión de backend, métricas reales, imágenes externas ni resultados ejecutados.';
    const canvasMessage = message+formatPreferences(payload.preferences)+formatProject(payload.project);
    const generated = await generateWithFallback({provider:String(payload.provider||'auto'),system:canvasSystem,message:canvasMessage,history:[]});
    return {reply:generated.text,provider:generated.provider,model:generated.model,agent:{id:'code',name:'Canvas HTML'},tools:[],usage:generated.usage||null,latencyMs:Date.now()-started,canvas:true};
  }
  if (isCoreSelfQuery(message)) return { reply:coreSelfResponse(), provider:'wae_core', model:'runtime_capabilities', agent:{id:'general',name:'Universal Core'}, tools:[], usage:null, latencyMs:Date.now()-started, grounded:true };
  const shortComparison=coreComparisonFastAnswer(message);
  if(shortComparison)return {reply:shortComparison,provider:'wae_core',model:'verified_product_comparison/v1',agent:{id:'general',name:'Universal Core'},tools:[],usage:null,latencyMs:Date.now()-started,grounded:true};

  const mode = String(payload.mode || payload.agent || 'general');
  const agent = getAgent(mode);
  const userKey = String(payload.userKey || payload.sessionId || '').slice(0,160);
  const sessionId = String(payload.sessionId || '').slice(0,160);
  const history = Array.isArray(payload.history) ? payload.history : [];
  const attachments = sanitizeAttachments(payload.attachments);
  const industrialMission = planIndustrialMission(message,{attachments});
  const professionalMission = planProfessionalMission(message,{attachments});
  const worldMission = planWorldMission(message,{attachments});
  const economics=payload.economics===undefined?null:projectEconomics(payload.economics);
  if(payload.economics!==undefined&&!economics)throw Object.assign(new Error('economics requiere unitPrice, unitVariableCost, fixedCost, volume y valores válidos; sin cifras inventadas'),{statusCode:400});
  const memory = await recallMemory(userKey, message, 6);
  const requestedTools = Array.isArray(payload.tools) ? payload.tools : [];
  const publicResearch=payload.web_enabled!==false && /\b(cientific|científic|ciencia|research|estudio|paper|acad[eé]mic|investigaci[oó]n|laboratorio|epidem|salud p[uú]blica)\b/i.test(message);
  const researchEnabled=payload.web_enabled!==false && needsWebResearch(message, mode);
  const toolAgent=payload.web_enabled===false?{...agent,tools:agent.tools.filter(x=>x!=='web_search'&&x!=='public_research')}:agent;
  const allowedRequested=payload.web_enabled===false?requestedTools.filter(x=>x!=='web_search'&&x!=='public_research'):requestedTools;
  const toolResults = await runTools({ agent:toolAgent, message, requestedTools:[...allowedRequested,...(researchEnabled?['web_search']:[]),...(publicResearch?['public_research']:[])] });

  const system = `${agent.system}${worldSystemInstruction(worldMission)}${industrialSystemInstruction(industrialMission)}${professionalSystemInstruction(professionalMission)}\n\n${QUALITY_GUIDANCE}\n\nCalidad de respuesta WAE Premium: responde en el idioma y tono de la persona, natural y claro, como un tutor competente; entra directamente a resolver la consulta. Cuando aporte valor, utiliza Markdown con títulos cortos, negritas, listas, tablas legibles y bloques de código verificables. Para programación, proporciona implementación, pruebas y riesgos específicos cuando proceda. Distingue hechos, inferencias e incertidumbres. Si hay evidencias de herramientas, enlaza sus fuentes reales y explica qué respaldan; no inventes URLs, citas, bibliografía, mediciones, proveedores, acciones ejecutadas ni resultados. Evita respuestas de relleno, bloques de texto interno y afirmaciones sobre capacidades que no estén disponibles. Identifica límites reales; si una integración no está disponible dilo; prioriza seguridad, consentimiento y reversibilidad; no afirmes que ejecutaste acciones externas salvo que aparezcan en EVIDENCIA DE HERRAMIENTAS. No fuerces una tabla ni un formato fijo si una respuesta breve resulta más útil. En preguntas comparativas (por ejemplo «¿eres equivalente a Google?»), responde primero la comparación concreta y distingue buscador, asistente y modelos de IA según corresponda. No sustituyas la respuesta por una ficha sobre tu identidad, registro de proveedores o estado del servidor; menciona una limitación solo cuando cambie la conclusión.`;
  const comparison=isCoreComparison(message);
  const economicsEvidence=economics?'\n\nCÁLCULO MATEMÁTICO DETERMINISTA CON DATOS EXPRESAMENTE RECIBIDOS (no inventes cifras adicionales):\n'+JSON.stringify(economics):'';
  const enrichedMessage = `${message}${formatPreferences(payload.preferences)}${formatProject(payload.project)}${attachmentContext(attachments)}${formatMemoryContext(memory)}${formatToolContext(toolResults)}${economicsEvidence}`;
  const generated = await generateWithFallback({ provider:String(payload.provider || 'auto'), system:comparison?system+'\n\n'+CORE_COMPARISON_GROUNDING:system, message:enrichedMessage, history, mode:agent.id, webEnabled:researchEnabled, qualityGate:comparison?answer=>coreComparisonIssue(answer,message):null });
  const gatheredSources=toolResults.filter(x=>x.ok&&Array.isArray(x.data)).flatMap(x=>x.data).filter(x=>x?.url&&x?.title).map(x=>({title:x.title,url:x.url,publishedAt:x.publishedAt||null,retrievedAt:x.retrievedAt||null}));
  const realSources=[...(generated.sources||[]),...gatheredSources];
  const reply = appendSourceLinks(generated.text, realSources, message);

  await saveTurn(userKey, sessionId, message, reply, { provider:generated.provider, model:generated.model, agent:agent.id, tools:toolResults.map(x=>x.tool), industrialDomain:industrialMission?.domains?.map(x=>x.id)||[], professionalDomain:professionalMission?.domains?.map(x=>x.id)||[],worldDomain:worldMission?.domains?.map(x=>x.id)||[] });

  return {
    reply,
    sources:realSources,
    provider:generated.provider,
    model:generated.model,
    agent:{ id:agent.id, name:agent.name },
    tools:toolResults,
    memory:{ recalled:memory.length, persistent:memoryStatus().configured },
    usage:generated.usage || null,
    latencyMs:Date.now()-started,
    fallbackFailures:generated.failures || [],
    industrial_engineering:publicIndustrialPlan(industrialMission),
    professional_economics:publicProfessionalPlan(professionalMission),
    world_intelligence:publicWorldPlan(worldMission),
    economic_projection:economics
  };
}
