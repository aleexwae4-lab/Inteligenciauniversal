import { classifySelfAwarenessV99 } from './self-awareness-v99.js';
import { PREMIUM_DEFAULT_REFERENCE, PREMIUM_REQUIRED_CASES } from './premium-superiority-gate-v98.js';

export const SELF_AWARENESS_V101='self-awareness/v101-grounded-capability-model';

const clean=(value,max=240)=>String(value??'').trim().slice(0,max);

function operationalState(operational={}){
  if(operational?.generativeEligibleNow===true){
    return operational?.generativeHealthyNow===true?'available':'degraded';
  }
  if(operational?.generativeConfigured===true)return'unavailable';
  return'unconfigured';
}

function supportedState(condition=true){return condition?'available':'unavailable'}

export function buildSelfAwarenessSnapshotV101({stats={},operational=null,toolCount=0,capabilityDomains=0}={}){
  const generative=operationalState(operational||{});
  const roles=Number(stats?.executiveOrchestration?.executiveRoles||0);
  const agents=Number(stats?.executiveOrchestration?.activeAgentInstances||0);
  return{
    version:SELF_AWARENESS_V101,
    identity:'Universal Core',
    product:'WAE OS Enterprise',
    operational:{
      generative,
      generativeConfigured:operational?.generativeConfigured===true,
      generativeEligible:operational?.generativeEligibleNow===true,
      generativeHealthy:operational?.generativeHealthyNow===true,
      configuredProviders:Number(operational?.configuredProviderCount||0),
      eligibleProviders:Number(operational?.eligibleProviderCount||0),
      healthyProviders:Number(operational?.healthyProviderCount||0),
      preferredProvider:operational?.preferredProvider||null,
    },
    capabilities:{
      reasoning:{status:generative,grounding:'operational_provider_snapshot'},
      writingAndTransformation:{status:generative,grounding:'operational_provider_snapshot'},
      codeAndEngineering:{status:generative,grounding:'operational_provider_snapshot'},
      liveResearch:{status:generative==='unconfigured'?'degraded':generative,grounding:'knowledge_and_provider_runtime'},
      toolExecution:{status:supportedState(Number(toolCount)>0),registeredTools:Number(toolCount||0)},
      memoryAndContext:{status:'available',grounding:'runtime_architecture'},
      multiAgentOrchestration:{status:supportedState(roles>0||agents>0),executiveRoles:roles,activeAgentInstances:agents},
      evaluationAndRegression:{status:'available',grounding:'evaluation_plane_and_eval_training'},
      voiceInterface:{status:'available',grounding:'client_runtime'},
      capabilityDomains:Number(capabilityDomains||0),
    },
    benchmark:{
      exactReference:PREMIUM_DEFAULT_REFERENCE,
      requiredCases:PREMIUM_REQUIRED_CASES,
      claimStatus:'UNVERIFIED_UNTIL_SIGNED_CERTIFICATION',
      certificationEndpoint:'/api/benchmark/v98',
    },
    truthPolicy:{
      dynamicOperationalStatus:true,
      capabilitiesMustBeGrounded:true,
      unavailableCapabilitiesMustNotBeClaimedAsAvailable:true,
      globalNumberOneClaimAllowed:false,
      superiorityRequiresCompleteSignedCertification:true,
      benchmarkScopedClaimsOnly:true,
    },
  };
}

function line(label,item={}){
  const status=clean(item.status||'unknown',40);
  return `**${label}:** ${status}${Number.isFinite(Number(item.registeredTools))&&Number(item.registeredTools)>0?` (${Number(item.registeredTools)} herramientas registradas)`:''}.`;
}

export function buildSelfAwarenessReplyV101({kind='capability',snapshot={}}={}){
  const capabilities=snapshot.capabilities||{};
  const op=snapshot.operational||{};
  const lines=[
    line('Razonamiento',capabilities.reasoning),
    line('Investigación actual',capabilities.liveResearch),
    line('Ingeniería y código',capabilities.codeAndEngineering),
    line('Herramientas',capabilities.toolExecution),
    line('Memoria y contexto',capabilities.memoryAndContext),
    line('Orquestación multiagente',capabilities.multiAgentOrchestration),
    line('Evaluación y regresiones',capabilities.evaluationAndRegression),
    line('Voz',capabilities.voiceInterface),
  ];
  const providers=`Proveedores configurados: **${Number(op.configuredProviders||0)}**; elegibles ahora: **${Number(op.eligibleProviders||0)}**; saludables ahora: **${Number(op.healthyProviders||0)}**.`;

  if(kind==='comparison'){
    return `**Universal Core está construido para competir con ${snapshot?.benchmark?.exactReference||PREMIUM_DEFAULT_REFERENCE}, pero la victoria debe demostrarse, no declararse.**\n\n${lines.join('\n')}\n\n${providers}\n\n### Prueba exigida\nLa certificación requiere **${Number(snapshot?.benchmark?.requiredCases||PREMIUM_REQUIRED_CASES)} casos emparejados**, ejecución real de ambos sistemas, hashes, provenance firmada, scoring ciego y gates de calidad, factualidad, instrucciones, seguridad y latencia. El estado permanece **NO VERIFICADO** hasta que el gate firmado lo autorice; una afirmación global de “#1” sigue bloqueada sin esa evidencia.`;
  }
  if(kind==='identity'){
    return `Soy **Universal Core**, el núcleo de inteligencia de **WAE OS Enterprise**. Mi autoconocimiento v101 no es una lista fija: separa capacidades arquitectónicas de capacidades operativas y refleja si la generación está disponible, degradada o no elegible en ese momento.\n\n${lines.join('\n')}\n\n${providers}`;
  }
  return `**Estas son mis capacidades verificables en este momento.** No presento una función como disponible si la telemetría operativa dice lo contrario.\n\n${lines.join('\n')}\n\n${providers}\n\nLa mejora se mide mediante evals y regresiones. Frente a ${snapshot?.benchmark?.exactReference||PREMIUM_DEFAULT_REFERENCE}, solo una certificación firmada de ${Number(snapshot?.benchmark?.requiredCases||PREMIUM_REQUIRED_CASES)} casos puede autorizar una afirmación comparativa.`;
}

export function classifySelfAwarenessV101(body={}){return classifySelfAwarenessV99(body)}

export function selfAwarenessCapabilitiesV101(){
  return{
    version:SELF_AWARENESS_V101,
    groundedSelfKnowledge:true,
    dynamicOperationalStatus:true,
    distinguishesArchitectureFromRuntimeAvailability:true,
    exactPremiumReference:PREMIUM_DEFAULT_REFERENCE,
    requiredVerifiedCases:PREMIUM_REQUIRED_CASES,
    falseCapabilityClaimsBlocked:true,
    falseSuperiorityClaimsBlocked:true,
  };
}
