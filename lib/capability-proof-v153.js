export const CAPABILITY_PROOF_VERSION='capability-proof/v153';

const bool=value=>value===true;
const count=(items,state)=>items.filter(item=>item.state===state).length;
const compact=value=>String(value??'').trim().slice(0,160);

function area({id,name,state,evidence=[],limits=[],metrics={}}){
  return{
    id,name,state,
    evidence:[...new Set(evidence.filter(Boolean).map(compact))].slice(0,12),
    limits:[...new Set(limits.filter(Boolean).map(compact))].slice(0,8),
    metrics
  };
}

function stateFor({ready=false,partial=false,conditional=false}={}){
  if(ready)return'verified';
  if(partial)return'partial';
  if(conditional)return'conditional';
  return'unavailable';
}

export function capabilityProofSnapshot({capabilityMatrix={}}={}){
  const matrix=capabilityMatrix&&typeof capabilityMatrix==='object'?capabilityMatrix:{};
  const op=matrix.operational||{};
  const intel=matrix.intelligence||{};
  const research=matrix.research||{};
  const foundry=matrix.foundry||{};
  const collaboration=matrix.collaboration||{};

  const areas=[
    area({
      id:'research',name:'Investigación verificable',
      state:stateFor({ready:bool(op.webResearch),partial:bool(op.publicResearch)}),
      evidence:[
        bool(op.webResearch)&&'runtime:web_research_configured',
        bool(op.publicResearch)&&'runtime:public_research_configured',
        bool(research.academic)&&'source:academic_index',
        bool(research.recentNews)&&'source:recent_news_index',
        bool(research.encyclopedia)&&'source:encyclopedia_context'
      ],
      limits:[
        !bool(op.webResearch)&&'La búsqueda web general depende de una ruta configurada.',
        'La cobertura y actualidad dependen de las fuentes disponibles en el turno.'
      ]
    }),
    area({
      id:'software_foundry',name:'Ingeniería, Fábrica de software y Product Foundry',
      state:stateFor({ready:bool(op.softwareFactory)&&bool(op.digitalProductFoundry)}),
      evidence:[
        bool(op.softwareFactory)&&'runtime:software_factory',
        bool(op.digitalProductFoundry)&&'runtime:digital_product_foundry',
        foundry.version&&('registry:'+foundry.version),
        foundry.threeD?.studio&&('studio:'+foundry.threeD.studio),
        bool(op.questDialogueSaveEngine)&&'runtime:quest_dialogue_save_engine'
      ],
      limits:[
        'Los paquetes fuente deben probarse en el target final antes de considerarse release nativo.',
        'La ejecución física, publicación en tiendas y credenciales externas requieren autorización.'
      ],
      metrics:{
        browserTargets:Array.isArray(foundry.browserExecutable)?foundry.browserExecutable.length:0,
        sourceTargets:Array.isArray(foundry.sourceTargets)?foundry.sourceTargets.length:0
      }
    }),
    area({
      id:'analysis_data',name:'Análisis y datos',
      state:stateFor({ready:Array.isArray(intel.agentModes)&&intel.agentModes.includes('analysis')}),
      evidence:[
        Array.isArray(intel.agentModes)&&intel.agentModes.includes('analysis')&&'mode:analysis',
        'contract:explicit_input_unit_economics',
        'response:tables_json_metrics_supported'
      ],
      limits:[
        'Las métricas financieras requieren entradas explícitas o fuentes verificables.',
        'No se deben inventar datasets, resultados ejecutados ni rendimientos.'
      ]
    }),
    area({
      id:'business_professions',name:'Empresa y profesiones',
      state:stateFor({ready:Number(intel.professionalDomains)>0&&Number(intel.professionalSpecialists)>0}),
      evidence:[
        Number(intel.professionalDomains)>0&&('catalog:professional_domains='+Number(intel.professionalDomains)),
        Number(intel.professionalSpecialists)>0&&('catalog:professional_specialists='+Number(intel.professionalSpecialists)),
        Array.isArray(intel.agentModes)&&intel.agentModes.includes('executive')&&'mode:executive'
      ],
      limits:['La asistencia especializada no sustituye certificación, firma o responsabilidad profesional humana.'],
      metrics:{domains:Number(intel.professionalDomains)||0,specialists:Number(intel.professionalSpecialists)||0}
    }),
    area({
      id:'industry_systems',name:'Industria y sistemas',
      state:stateFor({ready:Number(intel.industrialDomains)>0&&Number(intel.industrialSpecialists)>0}),
      evidence:[
        Number(intel.industrialDomains)>0&&('catalog:industrial_domains='+Number(intel.industrialDomains)),
        Number(intel.industrialSpecialists)>0&&('catalog:industrial_specialists='+Number(intel.industrialSpecialists))
      ],
      limits:['La asistencia digital no equivale a operación física ni certificación de seguridad industrial.'],
      metrics:{domains:Number(intel.industrialDomains)||0,specialists:Number(intel.industrialSpecialists)||0}
    }),
    area({
      id:'global_problems',name:'Problemas complejos y globales',
      state:stateFor({ready:Number(intel.worldDomains)>0&&Array.isArray(intel.worldMethod)&&intel.worldMethod.length>0}),
      evidence:[
        Number(intel.worldDomains)>0&&('catalog:world_domains='+Number(intel.worldDomains)),
        Array.isArray(intel.worldMethod)&&intel.worldMethod.length&&('method:'+intel.worldMethod.join('>'))
      ],
      limits:['El sistema puede diseñar y verificar planes; no debe atribuirse intervención material no ejecutada.'],
      metrics:{domains:Number(intel.worldDomains)||0,phases:Array.isArray(intel.worldMethod)?intel.worldMethod.length:0}
    }),
    area({
      id:'work_experience',name:'Experiencia de trabajo',
      state:stateFor({ready:bool(op.workspace)&&bool(op.canvas)&&bool(op.projects),partial:bool(op.workspace)||bool(op.canvas)}),
      evidence:[
        bool(op.workspace)&&'ui:workspace',
        bool(op.canvas)&&'ui:canvas',
        bool(op.projects)&&'ui:projects',
        bool(op.voiceInterface)&&'ui:voice',
        bool(op.visualEvidence)&&'ui:visual_evidence',
        bool(op.temporaryCollaboration)&&'runtime:temporary_collaboration',
        bool(op.persistentMemory)&&'runtime:persistent_memory'
      ],
      limits:[
        !bool(op.persistentMemory)&&'Persistencia remota no verificada en este runtime.',
        !bool(op.githubSearch)&&'GitHub requiere conexión autorizada para operaciones verificables.',
        collaboration.persistent!==true&&'La colaboración actual no se declara persistente.'
      ]
    }),
    area({
      id:'inference_runtime',name:'Runtime generativo',
      state:stateFor({ready:bool(op.generativeInference),conditional:!bool(op.generativeInference)}),
      evidence:[bool(op.generativeInference)&&'runtime:generative_provider_configured'],
      limits:[!bool(op.generativeInference)&&'No hay proveedor generativo verificado en este proceso.']
    })
  ];

  const summary={
    total:areas.length,
    verified:count(areas,'verified'),
    partial:count(areas,'partial'),
    conditional:count(areas,'conditional'),
    unavailable:count(areas,'unavailable')
  };

  return{
    version:CAPABILITY_PROOF_VERSION,
    capabilityRegistry:matrix.version||null,
    generatedAt:new Date().toISOString(),
    policy:{
      runtimeBackedClaimsOnly:true,
      unavailableCapabilitiesMustNotBeClaimedAsActive:true,
      secretsExcluded:true,
      externalActionsRequireAuthorization:true,
      physicalExecutionClaimed:false
    },
    summary,areas
  };
}

export function capabilityProofLine(proof={}){
  const summary=proof.summary||{};
  const total=Number(summary.total)||0;
  const verified=Number(summary.verified)||0;
  const partial=Number(summary.partial)||0;
  const conditional=Number(summary.conditional)||0;
  return '**Estado operativo verificable:** '+verified+'/'+total+' áreas verificadas'
    +(partial?', '+partial+' parciales':'')
    +(conditional?', '+conditional+' condicionales':'')
    +'. El detalle de evidencia y límites está disponible en /api/capabilities/proof.';
}
