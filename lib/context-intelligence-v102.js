export const CONTEXT_INTELLIGENCE_V102='context-intelligence/v102';

const clean=(value,max=240)=>String(value??'').replace(/\u0000/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>clean(value,30000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const DOMAIN_RULES=[
  ['forensic',[
    [/\b(perit[oa]|pericial|dictamen|cadena de custodia|evidencia digital|informatic[ao] forense|metadatos forenses|hash sha|adquisicion forense)\b/i,3],
    [/\b(indicio|integridad de evidencia|laboratorio forense|trazabilidad de evidencia)\b/i,2],
  ]],
  ['legal',[
    [/\b(abogad[oa]|litigio|demanda|amparo|jurisprudencia|juzgado|tribunal|fiscalia|ministerio publico|jurisdiccion)\b/i,3],
    [/\b(contrato|escrito legal|codigo penal|codigo civil|procedimiento|expediente legal|alegato)\b/i,2],
  ]],
  ['software',[
    [/\b(software|backend|frontend|full[- ]?stack|api|repositorio|github|deploy|deployment|debug|bug|base de datos|database|devops|sre)\b/i,2],
    [/\b(codigo|typescript|javascript|python|react|node\.?js|sql|docker|kubernetes|vercel|render|supabase)\b/i,1],
  ]],
  ['engineering',[
    [/\b(ingenier[oa]|engineering|aeroespacial|mecanica|electrica|electronica|mecatronica|propulsion|avionica|powertrain)\b/i,3],
    [/\b(fmea|cad|matlab|simulacion|elementos finitos|thermal|termic[oa]|telemetria|manufactura|battery|bateria|control system)\b/i,2],
  ]],
  ['health',[
    [/\b(medic[oa]|doctor|cirujan[oa]|enfermer[oa]|clinica|paciente|diagnostico|tratamiento|farmacologia|hospital)\b/i,3],
    [/\b(historia clinica|laboratorio clinico|salud|terapia)\b/i,2],
  ]],
  ['finance',[
    [/\b(cfo|finanzas|financiero|contabilidad|contador|tesoreria|inversion|portafolio|valuacion|ebitda|flujo de caja)\b/i,3],
    [/\b(impuestos|presupuesto|margen|unit economics|cac|ltv)\b/i,2],
  ]],
  ['academic',[
    [/\b(profesor|docente|universidad|academico|clase|curso|curriculum|rubrica|plan de estudios)\b/i,3],
    [/\b(investigacion cientifica|paper|articulo cientifico|bibliografia|tesis|alumno|estudiante)\b/i,2],
  ]],
  ['government',[
    [/\b(gobierno|municipio|alcaldia|secretaria de estado|administracion publica|politica publica|dependencia publica)\b/i,3],
    [/\b(servicio publico|regulacion publica|programa publico|presupuesto publico)\b/i,2],
  ]],
  ['executive',[
    [/\b(ceo|director general|fundador|empresa|negocio|startup|consejo directivo|direccion general|operaciones|estrategia empresarial)\b/i,3],
    [/\b(ventas|growth|producto|marketing|monetizacion|modelo de negocio|kpi)\b/i,2],
  ]],
  ['creative',[
    [/\b(creador de contenido|copywriter|disenador|director creativo|campana|guion|video|fotografia|branding|contenido social)\b/i,3],
    [/\b(copy|post|reel|publicacion|anuncio|storyboard)\b/i,1],
  ]],
];

function scoreDomains(value=''){
  const text=norm(value);
  return DOMAIN_RULES.map(([domain,rules])=>({
    domain,
    score:rules.reduce((sum,[rx,weight])=>sum+(rx.test(text)?weight:0),0)
  })).filter(row=>row.score>0).sort((a,b)=>b.score-a.score);
}

export function inferDomainV102(value=''){
  const ranked=scoreDomains(value);
  if(!ranked.length)return{domain:'general',confidence:.35,ranked:[]};
  const top=ranked[0],second=ranked[1];
  if(second&&top.score===second.score)return{domain:'multidisciplinary',confidence:.58,ranked:ranked.slice(0,4)};
  const confidence=Math.min(.96,.56+(top.score*0.08)+((top.score-(second?.score||0))*0.04));
  return{domain:top.domain,confidence:Number(confidence.toFixed(2)),ranked:ranked.slice(0,4)};
}

function explicitProfile(body={}){
  const src=[
    body.operator_context,body.operator,body.user_profile,body.profile
  ].find(x=>x&&typeof x==='object'&&!Array.isArray(x))||{};
  const orgRaw=src.organization??src.organisation??body.organization;
  const org=typeof orgRaw==='string'?orgRaw:(orgRaw&&typeof orgRaw==='object'?(orgRaw.name||orgRaw.title):'');
  return{
    profession:clean(src.profession??body.profession),
    specialty:clean(src.specialty??src.speciality??body.specialty),
    role:clean(src.role??src.position??body.role),
    organization:clean(org),
    organizationType:clean(src.organizationType??src.organization_type??body.organizationType),
    industry:clean(src.industry??body.industry),
    seniority:clean(src.seniority??body.seniority),
    jurisdiction:clean(src.jurisdiction??body.jurisdiction),
    project:clean(src.project??src.projectName??body.projectName),
  };
}

function selfIdentification(raw=''){
  const roleMatch=raw.match(/\b(?:soy|trabajo como|laboro como|me desempeno como|me desempeño como|ejerzo como|mi profesion es|mi profesión es)\s+(?:un[ao]?\s+)?([^,.!?\n]{2,90})/i);
  const profession=clean(roleMatch?.[1]||'',90);
  const orgMatch=raw.match(/\b(?:trabajo|laboro)\s+(?:en|para)\s+([^,.!?\n]{1,100})/i);
  return{profession,organization:clean(orgMatch?.[1]||'',120)};
}

export function inferIntentV102(value=''){
  const q=norm(value);
  if(/\b(debug|depura|corrige el error|arregla|soluciona el bug|fix)\b/.test(q))return'debug';
  if(/\b(construye|implementa|desarrolla|programa|crea la app|crea el sistema|build|implement)\b/.test(q))return'build';
  if(/\b(investiga|busca fuentes|research|estado del arte|literatura|jurisprudencia)\b/.test(q))return'research';
  if(/\b(analiza|audita|evalua|diagnostica|revisa|compara|interpreta)\b/.test(q))return'analyze';
  if(/\b(decide|elige|decision|recomienda una decision|trade[- ]?off)\b/.test(q))return'decide';
  if(/\b(redacta|escribe|prepara un escrito|documento|informe|dictamen|contrato)\b/.test(q))return'draft';
  if(/\b(clase|leccion|enseña|ensena|curso|rubrica|examen|material didactico)\b/.test(q))return'teach';
  if(/\b(negocia|negociacion|objeciones|acuerdo)\b/.test(q))return'negotiate';
  if(/\b(ordena|organiza|estructura estos datos|clasifica)\b/.test(q))return'organize';
  if(/\b(crea|crear|genera|generar|redacta|prepara)\b.{0,28}\b(contenido|post|guion|campana publicitaria|reel|publicacion)\b/.test(q)||/\b(post|reel|copy publicitario)\b/.test(q))return'create_content';
  if(/\b(plan|planear|planea|planifica|planificacion|roadmap|estrategia|proyecto|campana de pruebas)\b/.test(q))return'plan';
  return'answer';
}

function isCurrentRequest(value=''){
  return /\b(hoy|actualmente|actualizado|vigente|ultima version|última versión|mas reciente|más reciente|latest|current|ahora mismo|esta semana|este mes)\b/i.test(String(value||''));
}

function complexity(value='',intent='answer'){
  const raw=String(value||'');
  if(raw.length>1200||/\b(arquitectura|estrategia integral|proyecto completo|multiagente|produccion|producción|auditoria completa|auditoría completa)\b/i.test(raw))return'deep';
  if(raw.length>320||['build','debug','analyze','research','plan','decide','draft'].includes(intent))return'standard';
  return'simple';
}

export function buildContextIntelligenceV102(body={}){
  const raw=clean(body.message||body.task||body.prompt||'',30000);
  const explicit=explicitProfile(body);
  const self=selfIdentification(raw);
  const explicitIdentityText=[explicit.profession,explicit.specialty,explicit.role,explicit.industry].filter(Boolean).join(' ');
  const selfIdentityText=self.profession;
  const operatorInference=inferDomainV102(explicitIdentityText||selfIdentityText);
  const taskInference=inferDomainV102(raw);
  const hasExplicitIdentity=Boolean(explicitIdentityText||explicit.organization||explicit.project);
  const hasSelfIdentity=Boolean(self.profession||self.organization);
  const operatorDomain=(hasExplicitIdentity||hasSelfIdentity)?operatorInference.domain:'general';
  const taskDomain=taskInference.domain;
  const workingDomain=operatorDomain!=='general'?operatorDomain:taskDomain;
  const intent=inferIntentV102(raw);
  const operator={
    profession:explicit.profession||self.profession||null,
    specialty:explicit.specialty||null,
    role:explicit.role||null,
    organization:explicit.organization||self.organization||null,
    organizationType:explicit.organizationType||null,
    industry:explicit.industry||null,
    seniority:explicit.seniority||null,
    jurisdiction:explicit.jurisdiction||null,
    project:explicit.project||clean(body.project_name||body.project,120)||null,
  };
  return{
    version:CONTEXT_INTELLIGENCE_V102,
    active:workingDomain!=='general'||hasExplicitIdentity||hasSelfIdentity||intent!=='answer',
    operator,
    operatorDomain,
    task:{
      domain:taskDomain,
      workingDomain,
      intent,
      current:isCurrentRequest(raw),
      complexity:complexity(raw,intent),
    },
    confidence:{
      operator:(hasExplicitIdentity?Math.max(.9,operatorInference.confidence):hasSelfIdentity?Math.max(.78,operatorInference.confidence):.35),
      task:taskInference.confidence,
    },
    provenance:{
      operator:hasExplicitIdentity?'explicit_profile':hasSelfIdentity?'self_identified_in_message':'unknown',
      organization:explicit.organization?'explicit_profile':self.organization?'self_identified_in_message':'unknown',
      task:'current_message',
    },
    domainCandidates:taskInference.ranked,
  };
}
