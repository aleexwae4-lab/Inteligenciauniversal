import { capabilityPlan } from './capability-kernel.js';
import { planMission } from './orchestrator.js';
import { assetArchiveIntentV105 } from './digital-asset-memory-v105.js';

export const ADAPTIVE_META_OS_V107='adaptive-meta-os/v107';

const safe=(value,max=12000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const uniq=(items,max=16)=>[...new Set((items||[]).filter(Boolean))].slice(0,max);

const PACKS=[
  {id:'medicine_core',name:'Medicine Core',risk:'regulated',rx:/\b(m[eé]dic|doctor|paciente|cl[ií]nic|hospital|farmac|medicamento|laboratorio|diagn[oó]stic|tratamiento|receta|salud)\w*/i,capabilities:['conversation_reasoning','deep_research','memory','projects','document_generation']},
  {id:'legal_core',name:'Legal Core',risk:'regulated',rx:/\b(abogad|jur[ií]dic|legal|ley|jurisprudencia|contrato|demanda|denuncia|expediente|litig|prueba pericial)\w*/i,capabilities:['conversation_reasoning','deep_research','memory','projects','document_generation']},
  {id:'engineering_core',name:'Engineering Core',risk:'standard',rx:/\b(ingenier|c[aá]lculo|simulaci[oó]n|normativa t[eé]cnica|diseño estructural|manufactura|sistema f[ií]sico)\w*/i,capabilities:['conversation_reasoning','advanced_data_analysis','projects','document_generation']},
  {id:'education_core',name:'Education Core',risk:'standard',rx:/\b(universidad|educaci[oó]n|profesor|docente|estudiante|curso|curr[ií]cul|enseñanza|aprendizaje)\w*/i,capabilities:['conversation_reasoning','deep_research','projects','study_mode','document_generation']},
  {id:'finance_core',name:'Finance Core',risk:'regulated',rx:/\b(finanz|contab|fiscal|inversi[oó]n|presupuesto|flujo de caja|ebitda|tesorer[ií]a|valuaci[oó]n)\w*/i,capabilities:['conversation_reasoning','advanced_data_analysis','projects','spreadsheets','document_generation']},
  {id:'government_core',name:'Government Core',risk:'regulated',rx:/\b(gobierno|municipio|alcald[ií]a|secretar[ií]a|administraci[oó]n p[uú]blica|pol[ií]tica p[uú]blica)\w*/i,capabilities:['conversation_reasoning','deep_research','projects','document_generation']},
  {id:'research_core',name:'Research Core',risk:'standard',rx:/\b(investiga|investigaci[oó]n|evidencia|paper|art[ií]culo cient[ií]fico|bibliograf|fuentes|estado del arte)\w*/i,capabilities:['deep_research','web_search','memory','document_generation']},
  {id:'developer_core',name:'Developer Core',risk:'standard',rx:/\b(c[oó]digo|software|program|desarroll|github|api|backend|frontend|base de datos|deploy|render|supabase|vercel|devops|bug|debug)\w*/i,capabilities:['software_engineering','multiagent_engineering','terminal_code_execution','projects']},
  {id:'creator_core',name:'Creator Core',risk:'standard',rx:/\b(diseñ|branding|marca|imagen|video|fotograf|contenido|campaña|guion|creativ|audiovisual)\w*/i,capabilities:['conversation_reasoning','vision','image_generation','image_editing','projects']},
  {id:'business_core',name:'Business Core',risk:'standard',rx:/\b(empresa|negocio|startup|ventas|marketing|operaciones|cliente|producto|saas|monetiz|crecimiento|estrategia|roi)\w*/i,capabilities:['conversation_reasoning','deep_research','projects','document_generation']},
];

const DO_RX=/\b(env[ií]a|publica|despliega|deploy|ejecuta|corre|actualiza|modifica|integra|conecta|crea (?:el|la|un|una)?\s*(?:registro|tarea|evento|repositorio|branch|rama|pull request|pr|tabla|endpoint)|guarda|programa (?:una|un)?\s*(?:tarea|recordatorio)|manda (?:el|la|un|una)?\s*(?:correo|mensaje)|haz el cambio|aplica (?:el|la)?\s*(?:migraci[oó]n|cambio))\b/i;
const CREATE_RX=/\b(crea|genera|redacta|escribe|diseña|construye|prepara|produce|arma|convierte|desarrolla)\b/i;
const DELIVERABLE_RX=/\b(documento|informe|reporte|propuesta|contrato|plan|estrategia|presentaci[oó]n|c[oó]digo|app|aplicaci[oó]n|tabla|gr[aá]fica|manual|libro|curso|metodolog[ií]a|framework|protocolo|api|dataset|automatizaci[oó]n)\b/i;
const PROJECT_RX=/\b(abrir|crear|construir|lanzar|operar|transformar|migrar|implementar|escalar|desarrollar)\b.{0,80}\b(empresa|startup|cl[ií]nica|consultorio|despacho|universidad|laboratorio|agencia|f[aá]brica|plataforma|sistema|producto|saas|aplicaci[oó]n|app|infraestructura|programa)\b/i;

function profileText(profile={}){
  return [
    ...(profile.professional_roles||[]),
    ...(profile.responsibilities||[]),
    ...(profile.goals||[]),
  ].map(x=>safe(x,280)).filter(Boolean).join(' | ');
}

export function executionLevelV107(message=''){
  const text=safe(message);
  if(DO_RX.test(text))return'do';
  if(CREATE_RX.test(text)||DELIVERABLE_RX.test(text))return'create';
  return'know';
}

export function professionalPacksV107(message='',profile={}){
  const current=safe(message);
  const explicitProfile=profileText(profile);
  const currentMatches=PACKS.filter(pack=>pack.rx.test(current));
  const profileMatches=PACKS.filter(pack=>explicitProfile&&pack.rx.test(explicitProfile));
  const selected=uniq([...currentMatches,...profileMatches].map(x=>x.id),4)
    .map(id=>PACKS.find(pack=>pack.id===id));
  return selected.map(pack=>({
    id:pack.id,
    name:pack.name,
    risk:pack.risk,
    source:pack.rx.test(current)?'current_task':'explicit_user_profile',
    capabilityDomains:pack.capabilities,
    humanValidationRequired:pack.risk==='regulated'
  }));
}

export function problemToProjectIntentV107(message=''){
  const text=safe(message);
  const explicit=/\b(proyecto|roadmap|plan de implementaci[oó]n|plan de ejecuci[oó]n|fases|milestones?|hitos)\b/i.test(text);
  const complex=PROJECT_RX.test(text)||text.length>1800;
  return{
    convert:explicit||complex,
    reason:explicit?'explicit_project_language':complex?'multi_step_or_long_horizon':'single_turn_sufficient',
    proposedStatus:(explicit||complex)?'candidate':'not_needed'
  };
}

export function valueMeasurementCandidatesV107({message='',level='know',packs=[]}={}){
  const text=safe(message);
  const categories=[];
  if(level!=='know')categories.push('time_savings','productivity_gain');
  if(DELIVERABLE_RX.test(text)||level==='create')categories.push('knowledge_asset');
  if(/\b(automatiz|workflow|flujo autom[aá]tico|bot|agente)\w*/i.test(text))categories.push('automation_created');
  if(/\b(venta|ingreso|monetiz|cliente|oportunidad comercial|revenue)\w*/i.test(text))categories.push('revenue_generated','opportunity_created');
  if(/\b(ahorr|reducir costo|coste|gasto)\w*/i.test(text))categories.push('cost_savings');
  if(/\b(riesgo|seguridad|compliance|cumplimiento|fraude|vulnerabilidad|error)\w*/i.test(text)||packs.some(x=>x.risk==='regulated'))categories.push('risk_reduction');
  return uniq(categories,8).map(category=>({category,status:'candidate',amount_mxn:null,hours_saved:null,evidenceRequired:true}));
}

export function assetIntentV107(message=''){
  const text=safe(message);
  const archive=assetArchiveIntentV105(text);
  const requestedTypes=[];
  const rules=[
    ['book',/\blibro\b/i],['manual',/\bmanual|playbook\b/i],['methodology',/\bmetodolog[ií]a|framework\b/i],
    ['course',/\bcurso|capacitaci[oó]n\b/i],['software',/\bsoftware|app|aplicaci[oó]n|api\b/i],
    ['automation',/\bautomatizaci[oó]n|workflow\b/i],['document',/\bdocumento|informe|reporte|contrato\b/i],
    ['strategy',/\bestrategia|roadmap|plan\b/i]
  ];
  for(const [type,rx] of rules)if(rx.test(text))requestedTypes.push(type);
  return{requested:archive.matched||requestedTypes.length>0,longitudinal:archive.longitudinal,types:uniq(requestedTypes,8)};
}

export function buildAdaptiveMetaOSStateV107({message='',profile={}}={}){
  const text=safe(message);
  const level=executionLevelV107(text);
  const packs=professionalPacksV107(text,profile);
  const capabilities=capabilityPlan(text);
  const mission=planMission(text);
  const project=problemToProjectIntentV107(text);
  const asset=assetIntentV107(text);
  const kernelMatches=capabilities?.matched||capabilities?.selected||capabilities?.domains||capabilities?.capabilities||[];
  const capabilityDomains=uniq([
    ...(packs.flatMap(x=>x.capabilityDomains||[])),
    ...((Array.isArray(kernelMatches)?kernelMatches:[]).map(x=>typeof x==='string'?x:x?.id))
  ],20);
  return{
    version:ADAPTIVE_META_OS_V107,
    operatingModel:'user→context→profession→need→knowledge→tools→agents→execution→result→memory→asset→value',
    executionLevel:level,
    professionalPacks:packs,
    capabilityDomains,
    capabilityPlan:capabilities,
    orchestration:{
      version:mission.schema,
      strategy:mission.strategy,
      specialists:mission.specialists,
      parallel:mission.parallel===true,
      evidencePolicy:mission.evidencePolicy
    },
    projectIntent:project,
    assetIntent:asset,
    valueMeasurementCandidates:valueMeasurementCandidatesV107({message:text,level,packs}),
    governance:{
      explicitProfileOnly:true,
      sensitiveAttributeInference:false,
      regulatedHumanValidation:packs.some(x=>x.humanValidationRequired),
      inventedMonetaryValue:false,
      autonomousSideEffectsRequireAuthorizedTool:true
    }
  };
}

export function adaptiveMetaOSCapabilitiesV107(){
  return{
    version:ADAPTIVE_META_OS_V107,
    adaptiveUserOperatingSystem:true,
    dynamicProfessionalIntelligence:true,
    capabilityActivation:true,
    multiAgentOrchestration:true,
    knowCreateDo:true,
    problemToProject:true,
    interactionToAsset:true,
    personalValueMeasurement:true,
    contextSwitching:true,
    professionalPacks:PACKS.map(({id,name,risk})=>({id,name,risk})),
    valueCategories:['revenue_generated','cost_savings','time_savings','risk_reduction','productivity_gain','knowledge_asset','automation_created','opportunity_created'],
    safety:{explicitProfileOnly:true,regulatedHumanValidation:true,inventedMonetaryValue:false}
  };
}
