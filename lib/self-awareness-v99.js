import { gptComparatorReadiness } from './verified-gpt-arena-v93.js';
import { PREMIUM_DEFAULT_REFERENCE, PREMIUM_REQUIRED_CASES } from './premium-superiority-gate-v98.js';
import { capabilitySnapshot } from './capability-kernel.js';
import { frontierQualityCapabilitiesV102 } from './frontier-quality-curriculum-v102.js';
import { contextIntegrityCapabilitiesV103 } from './context-integrity-v103.js';

export const SELF_AWARENESS_V99='self-awareness/v103';

const normalize=(value='')=>String(value||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[¿?¡!.,;:]+/g,' ')
  .replace(/\s+/g,' ').trim();

const IDENTITY_RX=/\b(quien eres|que eres|que es universal core|como funciona universal core|tu nucleo|tu arquitectura|como es tu nucleo|que tiene tu nucleo|que hay en tu nucleo)\b/i;
const INFRA_RX=/\b(tienes? gpu|tienes? gpus|gpu propia|gpus propias|tu hardware|hardware propio|tu infraestructura|infraestructura propia|donde te ejecutas|donde corres|quien te hizo|quien te creo|quien te desarrollo|tus desarrolladores|eres de google|eres de nvidia|eres de openai)\b/i;
const CAPABILITY_RX=/\b(que tan inteligente eres|cuan inteligente eres|nivel de inteligencia|que puedes hacer|que sabes hacer|cuales son tus capacidades|que capacidades tienes|capacidades tienes|de que eres capaz|como puedes ayudarme|cuantos agentes tienes|tienes multiagentes|que agentes tienes)\b/i;
const RIVAL_RX=/\b(gpt(?:[- ]?6)?(?:[- ]?astra)?|astra|chatgpt|claude|gemini|grok|copilot)\b/i;
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
    return `Sí. **Universal Core está construido para competir contra la referencia Astra configurada en pruebas medibles**, no mediante una afirmación de marketing.\n\n${capabilityLines(snapshot).join('\n')}\n\n### Estado verificable\n${configured} La arena exige **${snapshot.benchmark.requiredCases} casos emparejados**, respuestas ejecutadas realmente por ambos sistemas, hashes y provenance firmada, scoring de calidad/factualidad/instrucciones/evidencia, y comparación de latencia P50/P95/P99.\n\nFrontier Quality v102 convierte fallos válidos en reglas de regresión y Context Integrity v103 impide que el proveedor subyacente reemplace identidad o contexto. Aun así, no debo afirmar que ya superé a Astra hasta que el Premium Superiority Gate v98 cierre en **CERTIFIED**.`;
  }
  if(kind==='identity'){
    return `Soy **Universal Core**, el núcleo de inteligencia de WAE OS Enterprise. No soy la marca del modelo que pueda resolver un turno: coordino razonamiento, investigación, herramientas, memoria/contexto, rutas especializadas, orquestación multiagente, continuidad v101, Frontier Quality v102, Context Integrity v103 y evaluación continua.\n\n${capabilityLines(snapshot).join('\n')}\n\nMi política es simple: una capacidad se presenta con su estado real; un proveedor se presenta como proveedor, no como mi identidad; y una superioridad frente a otro modelo solo se declara cuando una prueba reproducible la demuestra.`;
  }
  return `Mi inteligencia no se resume en un “IQ” inventado. **Se mide por lo que puedo resolver, por mis capacidades realmente disponibles y por las pruebas que paso.**\n\n${capabilityLines(snapshot).join('\n')}\n\nEstoy diseñado para ser altamente competitivo porque selecciono rutas según la tarea, evalúo resultados, rechazo respuestas críticas, conservo el contexto y puedo regenerar respuestas complejas que no alcanzan el umbral premium. Este entrenamiento es **eval-driven y de runtime**: no afirmo que se hayan modificado los pesos del modelo base. Frente a la referencia Astra configurada, la superioridad solo queda autorizada si la arena firmada de **${snapshot.benchmark.requiredCases} casos** y el gate premium completo pasan.`;
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
