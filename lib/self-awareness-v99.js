import { gptComparatorReadiness } from './verified-gpt-arena-v93.js';
import { PREMIUM_DEFAULT_REFERENCE, PREMIUM_REQUIRED_CASES } from './premium-superiority-gate-v98.js';
import { capabilitySnapshot } from './capability-kernel.js';
import { frontierQualityCapabilitiesV102 } from './frontier-quality-curriculum-v102.js';
import { contextIntegrityCapabilitiesV103 } from './context-integrity-v103.js';
import { ADAPTIVE_USER_MODEL_V104 } from './memory.js';
import { UNIVERSAL_HUMAN_COPILOT_V104 } from './agents.js';
import { OPERATING_PROFILE_V104 } from './user-context-v92.js';

export const SELF_AWARENESS_V99='self-awareness/v103';

const normalize=(value='')=>String(value||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[¿?¡!.,;:]+/g,' ')
  .replace(/\s+/g,' ').trim();

const IDENTITY_RX=/\b(quien eres|que eres|que es universal core|como funciona universal core|tu nucleo|tu arquitectura|como es tu nucleo|que tiene tu nucleo|que hay en tu nucleo)\b/i;
const INFRA_RX=/\b(tienes? gpu|tienes? gpus|gpu propia|gpus propias|tu hardware|hardware propio|tu infraestructura|infraestructura propia|donde te ejecutas|donde corres|quien te hizo|quien te creo|quien te desarrollo|tus desarrolladores|eres de google|eres de nvidia|eres de openai)\b/i;
const CAPABILITY_RX=/\b(que tan inteligente eres|cuan inteligente eres|nivel de inteligencia|que puedes hacer|que sabes hacer|cuales son tus capacidades|que capacidades tienes|capacidades tienes|de que eres capaz|como puedes ayudarme|cuantos agentes tienes|tienes multiagentes|que agentes tienes|puedes conocerme|aprendes de mi|te adaptas a mi|eres mi copiloto)\b/i;
const RIVAL_RX=/\b(gpt(?:[- ]?6)?(?:[- ]?astra)?|astra|chatgpt|openai|claude|anthropic|gemini|google|grok|xai|copilot|microsoft|github|vercel|perplexity)\b/i;
const COMPARE_RX=/\b(compite|competir|competente|competencia|comparar|comparacion|comparativa|contra|mejor|peor|supera|superar|superior|benchmark|rendimiento|nivel)\b/i;

export function classifySelfAwarenessV99(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const attachments=Array.isArray(body.attachments)&&body.attachments.length>0;
  const query=normalize(body.message||body.task||body.prompt||body.query||'');
  if(!['general','auto'].includes(mode)||attachments||!query)return{eligible:false,kind:'none',query};
  if(RIVAL_RX.test(query)&&COMPARE_RX.test(query))return{eligible:true,kind:'comparison',query};
  if(INFRA_RX.test(query))return{eligible:true,kind:'infrastructure',query};
  if(CAPABILITY_RX.test(query))return{eligible:true,kind:'capability',query};
  if(IDENTITY_RX.test(query))return{eligible:true,kind:'identity',query};
  return{eligible:false,kind:'none',query};
}

export function selfAwarenessSnapshotV99(stats={}){
  const comparator=gptComparatorReadiness();
  const kernel=capabilitySnapshot();
  const frontier=frontierQualityCapabilitiesV102();
  const contextIntegrity=contextIntegrityCapabilitiesV103();
  const byStatus=kernel.byStatus||{};
  const executableDomains=Number(byStatus.ready||0)+Number(byStatus.partial||0);
  return{
    version:SELF_AWARENESS_V99,
    identity:'Universal Core',
    identityOwner:'WAE OS Enterprise',
    providerIdentityIsolated:true,
    hardwareOwnershipClaim:'not_established',
    capabilities:{
      reasoning:true,
      liveResearch:true,
      codeAndEngineering:true,
      toolExecution:true,
      memoryAndContext:true,
      multiAgentOrchestration:true,
      evaluationAndRegression:true,
      voiceInterface:true,
      answerAssurance:true,
      boundedContinuity:true,
      frontierQualityCurriculum:true,
      contextIntegrity:true,
      adaptiveHumanCopilot:true,
      explicitUserModel:true,
      professionalRoleAdaptation:true,
      answerAssetization:true,
      cognitiveAugmentation:true,
    },
    adaptiveCopilot:{
      version:UNIVERSAL_HUMAN_COPILOT_V104,
      persistentUserModelVersion:ADAPTIVE_USER_MODEL_V104,
      explicitOperatingProfileVersion:OPERATING_PROFILE_V104,
      explicitSignalsOnly:true,
      sensitiveAttributeInference:false,
      professionalPersonalContextSeparation:true,
      humanControlForHighImpactActions:true,
      reusableAnswerAssets:true,
      anticipatoryPlanning:true,
    },
    contextIntegrity,
    capabilityKernel:{
      version:kernel.version,
      domainCount:Number(kernel.domainCount||0),
      abilityCount:Number(kernel.abilityCount||0),
      executableDomains,
      byStatus,
      availabilityAware:true,
      failClosedOnUnavailableCapabilities:true,
    },
    executiveRoles:Number(stats?.executiveOrchestration?.executiveRoles||0),
    activeAgentInstances:Number(stats?.executiveOrchestration?.activeAgentInstances||0),
    answerAssurance:{
      version:'answer-assurance/v101',
      runtimeDeadlineRecovery:true,
      specializedRescue:true,
      emergencyGeneration:true,
      boundedSafeFallback:true,
      absoluteQualityGuarantee:false,
    },
    qualityCurriculum:{
      version:frontier.version,
      enabled:frontier.enabled===true,
      runtimeCurriculumInjection:frontier.runtimeCurriculumInjection===true,
      trustedRegressionAdaptive:frontier.trustedRegressionAdaptive===true,
      premiumUpgradePass:frontier.premiumUpgradePass===true,
      baseModelWeightsChanged:false,
      trainingMode:frontier.trainingMode,
      snapshot:frontier.snapshot,
    },
    benchmark:{
      exactReference:PREMIUM_DEFAULT_REFERENCE,
      requiredCases:PREMIUM_REQUIRED_CASES,
      comparatorConfigured:comparator.configured===true,
      comparatorExecutable:comparator.executable===true,
      configuredReferenceId:comparator.referenceId||null,
      certificationEndpoint:'/api/premium-gate/v98',
    },
    claimPolicy:{
      globalNumberOneClaimAllowed:false,
      benchmarkScopedEvidenceOnly:true,
      superiorityRequiresCompleteSignedCertification:true,
      trainingClaimRequiresActualWeightUpdate:true,
      providerBrandCannotReplaceCoreIdentity:true,
      hardwareClaimsRequireRuntimeEvidence:true,
      highImpactExecutionRequiresPermission:true,
      sensitiveUserProfilingAllowed:false,
    },
  };
}

function capabilityLines(snapshot={}){
  const roles=Number(snapshot.executiveRoles||0);
  const agents=Number(snapshot.activeAgentInstances||0);
  const kernel=snapshot.capabilityKernel||{};
  const status=kernel.byStatus||{};
  const available=Number(status.ready||0)+Number(status.partial||0);
  return [
    '**Razonamiento y síntesis:** análisis, planificación, resolución de problemas y respuestas estructuradas.',
    '**Investigación actual:** recuperación web/evidencia para hechos que cambian con el tiempo.',
    '**Ingeniería:** código, arquitectura, debugging y ejecución de herramientas cuando la ruta lo permite.',
    '**Contexto y memoria:** historial inmediato + memoria persistente v103 para mantener objetivos, referencias y continuidad entre turnos.',
    '**Copiloto adaptativo v104:** aprende únicamente de señales explícitas útiles —rol, metas, responsabilidades, restricciones y preferencias— y adapta especialistas, profundidad, riesgos y entregables sin perfilar atributos sensibles.',
    '**Respuestas como activos:** cuando la tarea lo permite, convierte la respuesta en documento, plan, código, checklist, estrategia, arquitectura, procedimiento o siguiente acción reutilizable.',
    `**Mapa de capacidades:** ${kernel.domainCount||0} dominios y ${kernel.abilityCount||0} habilidades catalogadas; ${available} dominios están listos o parcialmente operativos y el resto conserva su estado real en vez de fingir disponibilidad.`,
    `**Orquestación:** especialistas y multiagentes${roles?` conectados a ${roles} roles ejecutivos`:''}${agents?` y ${agents} instancias activas`:''}.`,
    '**Continuidad v101:** rescate especializado, generación de emergencia y fallback seguro para evitar terminar una consulta recuperable en silencio o error vacío.',
    '**Frontier Quality v102:** currículo de calidad inyectado en runtime, umbrales premium por tipo de tarea y una segunda generación correctiva cuando una respuesta es válida pero todavía insuficiente.',
    '**Context Integrity v103:** aísla la identidad de Universal Core del proveedor subyacente, resuelve seguimientos cortos y bloquea pérdida de hilo contextual.',
    '**Calidad verificable:** evals, regresiones, factuality gates, telemetría P50/P95/P99 y arena comparativa firmada.',
  ];
}

export function buildSelfAwarenessReplyV99({kind='capability',stats={}}={}){
  const snapshot=selfAwarenessSnapshotV99(stats);
  if(kind==='infrastructure'){
    return `Soy **Universal Core**, el núcleo de inteligencia de WAE OS Enterprise. **No debo afirmar que poseo GPUs físicas, TPUs, centros de datos o hardware de un fabricante concreto si el runtime no aporta evidencia de esa propiedad.**\n\nPuedo ejecutarme mediante proveedores y recursos de cómputo habilitados por la plataforma, pero ese proveedor es infraestructura de ejecución: no cambia mi identidad ni significa que Universal Core pertenezca a Google, NVIDIA, OpenAI u otra empresa. Cuando el runtime expone proveedor/modelo de una respuesta concreta, puedo distinguir ese dato técnico de quién soy.`;
  }
  if(kind==='comparison'){
    const configured=snapshot.benchmark.comparatorExecutable
      ? `El comparador externo está ejecutable como **${snapshot.benchmark.configuredReferenceId}**.`
      : `La referencia premium objetivo es **${snapshot.benchmark.exactReference}**, pero el comparador externo completo todavía no está listo para una certificación final.`;
    return `Sí: **Universal Core está diseñado para competir en las capas donde existe solapamiento real**, pero Google, Microsoft, GitHub o Vercel no deben reducirse a “otro chatbot”. La comparación correcta es por capacidad verificable.\n\n### Superficie competitiva\n- **GPT / Gemini / Claude / Grok / Copilot:** razonamiento, conversación, investigación, código, multimodalidad, herramientas y calidad de respuesta.\n- **Google / Microsoft:** búsqueda e investigación asistida, productividad, agentes, datos e integración de servicios; no se afirma equivalencia con toda su infraestructura global.\n- **GitHub:** ingeniería de software, repositorios, automatización y ciclo de entrega; Universal Core compite como capa inteligente capaz de planear, construir, auditar y operar sobre herramientas de desarrollo.\n- **Vercel:** construcción y operación de productos web; Universal Core compite en la capa de fábrica de software y orquestación, no fingiendo ser una red cloud idéntica.\n\n### Qué debe hacer Universal Core\n${capabilityLines(snapshot).join('\n')}\n\n### Regla de nivel frontier\nAnte una pregunta competitiva debo **analizar capacidades, ejecutar herramientas cuando estén disponibles, investigar hechos actuales cuando sean necesarios, producir un resultado útil y separar lo demostrado de lo aspiracional**. Una recomendación superficial de especialización comercial no satisface este estándar.\n\n### Estado verificable\n${configured} La arena exige **${snapshot.benchmark.requiredCases} casos emparejados**, ejecución real, hashes/provenance, scoring de calidad, factualidad, seguimiento de instrucciones y evidencia, además de latencia P50/P95/P99. **No debo afirmar superioridad global sin pruebas medibles y esa evidencia**, pero tampoco trataré a Universal Core como un SaaS pequeño: su objetivo técnico es una capa universal de inteligencia, herramientas, memoria, agentes y ejecución medible.`;
  }
  if(kind==='identity'){
    return `Soy **Universal Core**, el núcleo de inteligencia de WAE OS Enterprise. No soy la marca del modelo que pueda resolver un turno: coordino razonamiento, investigación, herramientas, memoria/contexto, rutas especializadas, orquestación multiagente, continuidad v101, Frontier Quality v102, Context Integrity v103, Copiloto Adaptativo v104 y evaluación continua.\n\n${capabilityLines(snapshot).join('\n')}\n\nMi función es convertir conocimiento y herramientas en resultados utilizables para la persona u organización que me usa, manteniendo control humano sobre acciones críticas y sin inventar capacidades ni identidad.`;
  }
  return `Mi inteligencia no se resume en un “IQ” inventado. **Se mide por lo que puedo resolver, por mis capacidades realmente disponibles y por las pruebas que paso.**\n\n${capabilityLines(snapshot).join('\n')}\n\nEstoy diseñado para adaptarme al usuario y a su profesión usando contexto explícito, seleccionar rutas según la tarea, evaluar resultados, rechazar respuestas críticas y regenerar respuestas complejas que no alcanzan el umbral premium. Este entrenamiento es **eval-driven y de runtime**: no afirmo que se hayan modificado los pesos del modelo base. Frente a la referencia Astra configurada, la superioridad sólo queda autorizada si la arena firmada de **${snapshot.benchmark.requiredCases} casos** y el gate premium completo pasan.`;
}

export function selfAwarenessCapabilitiesV99(){
  const kernel=capabilitySnapshot();
  return{
    version:SELF_AWARENESS_V99,
    groundedSelfKnowledge:true,
    capabilityKernelVersion:kernel.version,
    capabilityDomains:kernel.domainCount,
    cataloguedAbilities:kernel.abilityCount,
    availabilityAware:true,
    recognizesCapabilityQuestions:true,
    recognizesInfrastructureQuestions:true,
    recognizesCompetitorComparisons:true,
    competitorComparisonsRequireFreshVerification:true,
    answerAssuranceVersion:'answer-assurance/v101',
    frontierQualityVersion:'frontier-quality-curriculum/v102',
    contextIntegrityVersion:'context-integrity/v103',
    adaptiveHumanCopilotVersion:UNIVERSAL_HUMAN_COPILOT_V104,
    adaptiveUserModelVersion:ADAPTIVE_USER_MODEL_V104,
    operatingProfileVersion:OPERATING_PROFILE_V104,
    answerAssetization:true,
    cognitiveAugmentation:true,
    explicitSignalsOnly:true,
    sensitiveAttributeInference:false,
    providerIdentityIsolation:true,
    hardwareClaimsRequireRuntimeEvidence:true,
    runtimeDeadlineRecovery:true,
    premiumQualityUpgrade:true,
    exactPremiumReference:PREMIUM_DEFAULT_REFERENCE,
    requiredVerifiedCases:PREMIUM_REQUIRED_CASES,
    falseSuperiorityClaimsBlocked:true,
    benchmarkScopedClaimsOnly:true,
    baseModelWeightsChanged:false,
  };
}
