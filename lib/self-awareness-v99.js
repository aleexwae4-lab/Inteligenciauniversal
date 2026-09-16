import { gptComparatorReadiness } from './verified-gpt-arena-v93.js';
import { PREMIUM_DEFAULT_REFERENCE, PREMIUM_REQUIRED_CASES } from './premium-superiority-gate-v98.js';

export const SELF_AWARENESS_V99='self-awareness/v99';

const normalize=(value='')=>String(value||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[¿?¡!.,;:]+/g,' ')
  .replace(/\s+/g,' ').trim();

const IDENTITY_RX=/\b(quien eres|que eres|que es universal core|como funciona universal core|tu nucleo|tu arquitectura|como es tu nucleo|que tiene tu nucleo|que hay en tu nucleo)\b/i;
const CAPABILITY_RX=/\b(que tan inteligente eres|cuan inteligente eres|nivel de inteligencia|que puedes hacer|que sabes hacer|cuales son tus capacidades|que capacidades tienes|capacidades tienes|de que eres capaz|como puedes ayudarme|cuantos agentes tienes|tienes multiagentes|que agentes tienes)\b/i;
const RIVAL_RX=/\b(gpt(?:[- ]?6)?(?:[- ]?astra)?|astra|chatgpt|claude|gemini|grok|copilot)\b/i;
const COMPARE_RX=/\b(compite|competir|competente|competencia|comparar|comparacion|comparativa|contra|mejor|peor|supera|superar|superior|benchmark|rendimiento|nivel)\b/i;

export function classifySelfAwarenessV99(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const attachments=Array.isArray(body.attachments)&&body.attachments.length>0;
  const query=normalize(body.message||body.task||body.prompt||body.query||'');
  if(!['general','auto'].includes(mode)||attachments||!query)return{eligible:false,kind:'none',query};
  if(RIVAL_RX.test(query)&&COMPARE_RX.test(query))return{eligible:true,kind:'comparison',query};
  if(CAPABILITY_RX.test(query))return{eligible:true,kind:'capability',query};
  if(IDENTITY_RX.test(query))return{eligible:true,kind:'identity',query};
  return{eligible:false,kind:'none',query};
}

export function selfAwarenessSnapshotV99(stats={}){
  const comparator=gptComparatorReadiness();
  return{
    version:SELF_AWARENESS_V99,
    identity:'Universal Core',
    capabilities:{
      reasoning:true,
      liveResearch:true,
      codeAndEngineering:true,
      toolExecution:true,
      memoryAndContext:true,
      multiAgentOrchestration:true,
      evaluationAndRegression:true,
      voiceInterface:true,
    },
    executiveRoles:Number(stats?.executiveOrchestration?.executiveRoles||0),
    activeAgentInstances:Number(stats?.executiveOrchestration?.activeAgentInstances||0),
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
    },
  };
}

function capabilityLines(snapshot={}){
  const roles=Number(snapshot.executiveRoles||0);
  const agents=Number(snapshot.activeAgentInstances||0);
  return [
    '**Razonamiento y síntesis:** análisis, planificación, resolución de problemas y respuestas estructuradas.',
    '**Investigación actual:** recuperación web/evidencia para hechos que cambian con el tiempo.',
    '**Ingeniería:** código, arquitectura, debugging y ejecución de herramientas cuando la ruta lo permite.',
    '**Contexto y memoria:** continuidad de conversación y recuperación de contexto disponible.',
    `**Orquestación:** especialistas y multiagentes${roles?` conectados a ${roles} roles ejecutivos`:''}${agents?` y ${agents} instancias activas`:''}.`,
    '**Calidad verificable:** evals, regresiones, factuality gates, telemetría P50/P95/P99 y arena comparativa firmada.',
  ];
}

export function buildSelfAwarenessReplyV99({kind='capability',stats={}}={}){
  const snapshot=selfAwarenessSnapshotV99(stats);
  if(kind==='comparison'){
    const configured=snapshot.benchmark.comparatorExecutable
      ? `El comparador externo está ejecutable como **${snapshot.benchmark.configuredReferenceId}**.`
      : `La referencia premium objetivo es **${snapshot.benchmark.exactReference}**, pero el comparador externo completo todavía no está listo para una certificación final.`;
    return `Sí. **Universal Core está construido para competir contra GPT-6 Astra en pruebas medibles**, no mediante una afirmación de marketing.\n\n${capabilityLines(snapshot).join('\n')}\n\n### Estado verificable\n${configured} La arena exige **${snapshot.benchmark.requiredCases} casos emparejados**, respuestas ejecutadas realmente por ambos sistemas, hashes y provenance firmada, scoring de calidad/factualidad/instrucciones/evidencia, y comparación de latencia P50/P95/P99.\n\nPor eso puedo afirmar que **tengo arquitectura y mecanismos para competir**. No debo afirmar que ya superé a Astra hasta que el Premium Superiority Gate v98 cierre en **CERTIFIED**. Cada derrota válida se convierte en una regresión para entrenamiento y re-prueba.`;
  }
  if(kind==='identity'){
    return `Soy **Universal Core**, el núcleo de inteligencia de WAE OS Enterprise. No soy una sola llamada a un modelo: coordino razonamiento, investigación, herramientas, memoria/contexto, rutas especializadas, orquestación multiagente y un sistema de evaluación continua.\n\n${capabilityLines(snapshot).join('\n')}\n\nMi política es simple: una capacidad se presenta como disponible cuando existe en el sistema; una superioridad frente a otro modelo solo se declara cuando una prueba reproducible la demuestra.`;
  }
  return `Mi inteligencia no se resume en un “IQ” inventado. **Se mide por lo que puedo resolver y por las pruebas que paso.**\n\n${capabilityLines(snapshot).join('\n')}\n\nEstoy diseñado para ser altamente competitivo porque puedo seleccionar rutas distintas según la tarea y aprender de resultados operativos. Aun así, no confundo capacidad con victoria: frente a GPT-6 Astra, la superioridad solo queda autorizada si la arena firmada de **${snapshot.benchmark.requiredCases} casos** y el gate premium completo pasan.`;
}

export function selfAwarenessCapabilitiesV99(){
  return{
    version:SELF_AWARENESS_V99,
    groundedSelfKnowledge:true,
    recognizesCapabilityQuestions:true,
    recognizesCompetitorComparisons:true,
    competitorComparisonsRequireFreshVerification:true,
    exactPremiumReference:PREMIUM_DEFAULT_REFERENCE,
    requiredVerifiedCases:PREMIUM_REQUIRED_CASES,
    falseSuperiorityClaimsBlocked:true,
    benchmarkScopedClaimsOnly:true,
  };
}
