import { getAgent } from './agents.js';
import { planIndustrialMission, industrialSystemInstruction, publicIndustrialPlan, industrialCatalog, UNIVERSAL_INDUSTRIAL_VERSION } from './universal-industrial-v115.js';
import { planProfessionalMission, professionalSystemInstruction, publicProfessionalPlan, professionalCatalog, projectEconomics, PROFESSIONAL_ECONOMICS_VERSION } from './universal-professional-v116.js';
import { planWorldMission, worldSystemInstruction, publicWorldPlan, worldCatalog, WORLD_INTELLIGENCE_VERSION } from './universal-world-intelligence-v117.js';
import { QUALITY_GUIDANCE, needsWebResearch, appendSourceLinks } from './response-quality.js';
import { formatPreferences, formatProject } from './preferences.js';
import { isCoreSelfQuery, coreSelfResponse, capabilitySnapshot } from './core-self-description.js';
import { WAE_IDENTITY_POLICY, productIdentityIssue } from './wae-product-identity-v126.js';
import { isCoreComparison, CORE_COMPARISON_GROUNDING, coreComparisonIssue, coreComparisonFastAnswer } from './core-comparison-v9.js';
import { isPurposeQuestion, PURPOSE_GROUNDING, purposeResponseIssue } from './purpose-quality-v120.js';
import { EVIDENCE_RELEVANCE_GUIDANCE, irrelevantEvidenceAnswer, relevantSources } from './topic-relevance-v121.js';
import { focusGuidance, removeRedundantParagraphs } from './answer-density-v124.js';
import { datedResearchAnswer } from './dated-research-v122.js';
import { generateWithFallback, providerRegistry, providerOperationalSnapshot } from './providers.js';
import { runTools, formatToolContext, toolRegistry } from './tools.js';
import {researchCapabilities} from './live-research-v119.js';
import {collaborationCapabilities} from './live-collaboration-v119.js';
import { recallMemoryDetailed, saveTurnDetailed, formatMemoryContext, memoryStatus } from './memory.js';
import { createConversationTrace, CONVERSATION_E2E_VERSION } from './conversation-e2e-v130.js';
import { buildResponseEnvelope } from './response-envelope-v131.js';
import { progressiveContract } from './progressive-intelligence-v133.js';
import { streamingContract } from './provider-streaming-v134.js';

function sanitizeAttachments(attachments=[]) {
  return attachments.slice(0,5).filter(a => a && typeof a.name === 'string' && typeof a.text === 'string')
    .map(a => ({ name:a.name.slice(0,180), type:String(a.type||'text/plain').slice(0,100), text:a.text.slice(0,120000) }));
}

function attachmentContext(attachments=[]) {
  if (!attachments.length) return '';
  return `\n\nARCHIVOS ADJUNTOS:\n${attachments.map(a => `\n--- ${a.name} (${a.type}) ---\n${a.text}`).join('\n')}`;
}

function deterministicTurn({started,trace,reply,provider,model,agent={id:'general',name:'Universal Core'},tools=[],sources=[],grounded=true,extras={}}){
  const latencyMs=Date.now()-started;
  const response=buildResponseEnvelope({reply,sources,provider,model,agent,latencyMs,memory:{recalled:0},tools,fallbackFailures:[]});
  return {
    reply,sources,provider,model,agent,tools,usage:null,latencyMs,grounded,
    response,speech_text:response.speechText,components:response.components,actions:response.actions,
    e2e:trace.snapshot({deterministic:true}),
    ...extras
  };
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
    conversationE2E:{version:CONVERSATION_E2E_VERSION,stages:['router','memory','tools','provider','sources','persistence','ui','voice'],automaticRecovery:true},
    progressiveIntelligence:progressiveContract(),
    providerStreaming:streamingContract(),
    providerOperations:providerOperationalSnapshot(),
    providers,
    tools,
    memory:memoryStatus(),
    ready:providers.some(p=>p.configured)
  };
}

export async function executeMission(payload={},options={}) {
  const started = Date.now();
  const trace = createConversationTrace({route:'render',onProgress:options?.onProgress});
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
  if (isCoreSelfQuery(message)) {
    trace.end('router','ok',{strategy:'self_query'});
    trace.end('memory','skipped',{strategy:'capability_registry'});
    trace.end('tools','skipped',{strategy:'capability_registry'});
    trace.end('provider','skipped',{strategy:'deterministic'});
    trace.end('sources','skipped',{strategy:'capability_registry'});
    trace.end('persistence','skipped',{strategy:'capability_registry'});
    const history=Array.isArray(payload.history)?payload.history:[];
    const reply=coreSelfResponse({question:message,history});
    return deterministicTurn({
      started,trace,reply,provider:'wae_core',model:'runtime_capabilities/v132',
      extras:{capabilityMatrix:capabilitySnapshot()}
    });
  }
  const shortComparison=coreComparisonFastAnswer(message);
  if(shortComparison){
    trace.end('router','ok',{strategy:'comparison_fast'});trace.end('provider','skipped',{strategy:'deterministic'});
    return deterministicTurn({started,trace,reply:shortComparison,provider:'wae_core',model:'verified_product_comparison/v1'});
  }
  // A dated, explicitly sourced result is better than forcing a model through
  // unavailable live search for the exact observed research regression.
  if(payload.canvas!==true&&payload.canvas_blueprint!==true){
    const dated=datedResearchAnswer(message);
    if(dated){
      trace.end('router','ok',{strategy:'dated_registry'});trace.end('provider','skipped',{strategy:'deterministic'});trace.end('sources','ok',{count:1});
      return deterministicTurn({
        started,trace,reply:dated.reply,provider:'wae_research_registry',model:dated.id,
        agent:{id:'research',name:'Universal Core'},sources:[dated.source],
        extras:{asOf:dated.asOf,liveResearch:false}
      });
    }
  }

  trace.begin('router');
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
  const requestedTools = Array.isArray(payload.tools) ? payload.tools : [];
  const publicResearch=payload.web_enabled!==false && !/\b(?:sin internet|sin buscar en internet|no busques en la web|no uses la web)\b/i.test(message) && /\b(?:cient[ií]fic\w*|ciencia|research|estudio(?:s)?|paper(?:s)?|acad[eé]mic\w*|investigaci[oó]n|laboratorio(?:s)?|epidemi\w*|salud p[uú]blica)\b/i.test(message);
  const researchEnabled=payload.web_enabled!==false && needsWebResearch(message, mode);
  trace.end('router','ok',{mode:agent.id,research:researchEnabled,attachments:attachments.length,requestedTools:requestedTools.length});

  trace.begin('memory');
  const memoryResult = await recallMemoryDetailed(userKey, message, 6);
  const memory = memoryResult.items;
  trace.end('memory',memoryResult.status,{recalled:memory.length,code:memoryResult.code||undefined,configured:memoryStatus().configured});

  const toolAgent=payload.web_enabled===false?{...agent,tools:agent.tools.filter(x=>x!=='web_search'&&x!=='public_research'&&x!=='waeweb_search')}:agent;
  const allowedRequested=payload.web_enabled===false?requestedTools.filter(x=>x!=='web_search'&&x!=='public_research'&&x!=='waeweb_search'):requestedTools;
  trace.begin('tools');
  const toolResults = await runTools({ agent:toolAgent, message, requestedTools:[...allowedRequested,...(researchEnabled?['web_search']:[]),...(publicResearch?['public_research']:[])] });
  const toolFailures=toolResults.filter(x=>!x.ok).length;
  const toolSuccesses=toolResults.filter(x=>x.ok).length;
  trace.end('tools',toolResults.length?(toolFailures?'recovered':'ok'):'skipped',{attempted:toolResults.length,succeeded:toolSuccesses,failed:toolFailures,tools:toolResults.map(x=>x.tool)});

  const system = `${agent.system}${worldSystemInstruction(worldMission)}${industrialSystemInstruction(industrialMission)}${professionalSystemInstruction(professionalMission)}\n\n${QUALITY_GUIDANCE}\n\nIDENTIDAD DE PRODUCTO: ${WAE_IDENTITY_POLICY} Si preguntan directamente por procedencia, entrenamiento o privacidad, responde con hechos verificables. Calidad de respuesta WAE Premium: responde en el idioma y tono de la persona, natural y claro, como un tutor competente; entra directamente a resolver la consulta. No impongas títulos, listas ni tablas como plantilla; úsalos únicamente si facilitan comprender, comparar, ejecutar o verificar. Para programación, proporciona implementación, pruebas y riesgos específicos cuando proceda. Distingue hechos, inferencias e incertidumbres. Si hay evidencias de herramientas, enlaza sus fuentes reales y explica qué respaldan; no inventes URLs, citas, bibliografía, mediciones, proveedores, acciones ejecutadas ni resultados. Evita respuestas de relleno, bloques de texto interno y afirmaciones sobre capacidades que no estén disponibles. Identifica límites reales; si una integración no está disponible dilo; prioriza seguridad, consentimiento y reversibilidad; no afirmes que ejecutaste acciones externas salvo que aparezcan en EVIDENCIA DE HERRAMIENTAS. No fuerces una tabla ni un formato fijo si una respuesta breve resulta más útil. En preguntas comparativas (por ejemplo «¿eres equivalente a Google?»), responde primero la comparación concreta y distingue buscador, asistente y modelos de IA según corresponda. No sustituyas la respuesta por una ficha sobre tu identidad, registro de proveedores o estado del servidor; menciona una limitación solo cuando cambie la conclusión.`;
  const comparison=isCoreComparison(message);
  const purpose=isPurposeQuestion(message);
  const economicsEvidence=economics?'\n\nCÁLCULO MATEMÁTICO DETERMINISTA CON DATOS EXPRESAMENTE RECIBIDOS (no inventes cifras adicionales):\n'+JSON.stringify(economics):'';
  const enrichedMessage = `${message}${formatPreferences(payload.preferences)}${formatProject(payload.project)}${attachmentContext(attachments)}${formatMemoryContext(memory)}${formatToolContext(toolResults)}${economicsEvidence}`;
  const softwareDeploymentQuestion=/(?:mis sistemas|mis aplicaciones|mi plataforma|wae os|universal core|software|backend|servidor|saa[sS]|render)/i.test(message) && /(?:gpu|gratis|gratuit|escal|r[aá]pid|energ[ií]a|potencia|resisten|rendim)/i.test(message);
  const deploymentGuidance=softwareDeploymentQuestion?'\n\nFOCO DE MISIÓN: El usuario pide que sus productos y sistemas digitales operen sin GPU propia, con costo limitado, velocidad y escalabilidad. No conviertas \"energía\" o \"resistencia\" de una app en consejos sobre fuente de alimentación de PC, watts o voltajes, salvo solicitud explícita de hardware. Distingue inferencia remota de cómputo local y especifica límites de tiers gratuitos sin prometer capacidad ilimitada.':'';
  const groundedSystem=system+deploymentGuidance+'\n\n'+EVIDENCE_RELEVANCE_GUIDANCE+(comparison?'\n\n'+CORE_COMPARISON_GROUNDING:'')+(purpose?'\n\n'+PURPOSE_GROUNDING:'')+'\n\n'+focusGuidance(message,mode,attachments.length>0);
  const verifiedEmail=toolResults.some(x=>x.ok&&/^(?:gmail|email_send|send_email)$/.test(x.tool));
  const verifiedWeb=toolResults.some(x=>x.ok&&/^(?:waeweb_search|web_search|public_research)$/.test(x.tool)&&Array.isArray(x.data)&&x.data.length>0);
  trace.begin('provider');
  let generated;
  try {
    generated = await generateWithFallback({ provider:String(payload.provider || 'auto'), system:groundedSystem, message:enrichedMessage, history, mode:agent.id, webEnabled:researchEnabled, qualityGate:answer=>irrelevantEvidenceAnswer(answer,message)||coreComparisonIssue(answer,message)||purposeResponseIssue(answer,message,{verifiedEmail,verifiedWeb})||productIdentityIssue(answer,message), retryColdStart:attachments.length===0&&requestedTools.length===0, onProviderEvent:options?.onProviderEvent });
    trace.end('provider',generated.failures?.length?'recovered':'ok',{provider:generated.provider,model:generated.model,fallbackCount:generated.failures?.length||0});
  } catch (error) {
    throw trace.attachFailure(error,'provider',error?.code||'provider_failed');
  }
  trace.begin('sources');
  const gatheredSources=toolResults.filter(x=>x.ok).flatMap(x=>Array.isArray(x.data)?x.data:(x.data?.results||[])).filter(x=>x?.url&&x?.title).map(x=>({title:x.title,url:x.url,publishedAt:x.publishedAt||null,retrievedAt:x.retrievedAt||null,scope:x.scope||null}));
  const realSources=relevantSources(message,[...(generated.sources||[]),...gatheredSources]);
  trace.end('sources',researchEnabled?(realSources.length?'ok':'recovered'):'skipped',{count:realSources.length,required:researchEnabled});
  // Accepted replies stay accepted; only exact duplicate prose is removed.
  // Never force an extra model call or truncate a complex deliverable.
  const reply = removeRedundantParagraphs(appendSourceLinks(generated.text, realSources, message),message,mode,attachments.length>0);

  trace.begin('persistence');
  const persistence=await saveTurnDetailed(userKey, sessionId, message, reply, { provider:generated.provider, model:generated.model, agent:agent.id, tools:toolResults.map(x=>x.tool), industrialDomain:industrialMission?.domains?.map(x=>x.id)||[], professionalDomain:professionalMission?.domains?.map(x=>x.id)||[],worldDomain:worldMission?.domains?.map(x=>x.id)||[] });
  trace.end('persistence',persistence.status,{saved:persistence.saved,code:persistence.code||undefined});

  const responseEnvelope=buildResponseEnvelope({
    reply,
    sources:realSources,
    provider:generated.provider,
    model:generated.model,
    agent,
    latencyMs:Date.now()-started,
    memory:{recalled:memory.length},
    tools:toolResults,
    fallbackFailures:generated.failures||[]
  });

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
    economic_projection:economics,
    response:responseEnvelope,
    speech_text:responseEnvelope.speechText,
    components:responseEnvelope.components,
    actions:responseEnvelope.actions,
    e2e:trace.snapshot()
  };
}