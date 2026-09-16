import { shouldUseLiveData } from './live-data-mesh-v58.js';
import { libraryRelevant, bibliographicLookupIntent } from './library-intelligence-v52.js';

export const UNIVERSAL_INTELLIGENCE_PLANNER_VERSION='universal-intelligence-planner/v87';

const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ\s]/gi,' ').replace(/\s+/g,' ').trim();
const bool=value=>value===true;
const GENERAL_MODES=new Set(['','general','auto']);

const SCIENCE_RX=/\b(cientific\w*|ciencia\w*|medic\w*|salud\w*|clinic\w*|farmacol\w*|biolog\w*|genetic\w*|fisic\w*|quimic\w*|matematic\w*|estadistic\w*|paper\w*|estudio\w*|evidencia\w*|meta\s*analisis|metaanalisis|revision\w* sistematic\w*|pubmed|openalex|crossref|arxiv|doi|teorema\w*|physics|chemistry|biology|medicine|scientific\w*|academic\w*)\b/i;
const ACADEMIC_RX=/\b(investig\w*|academ\w*|bibliografi\w*|fuente\w*|evidencia\w*|paper\w*|articul\w*|publicacion\w*|literatura cientific\w*|estado del arte|review\w*|research\w*)\b/i;
const REASONING_RX=/\b(razona\w*|razonamiento\w*|analiza\w*|analisis|explica por que|demuestra\w*|deduce\w*|infiere\w*|compara\w*|contrasta\w*|evalua\w*|diagnostica\w*|causa\w*|trade off|tradeoff|escenario\w*|hipotesis|arquitectura\w*|estrategia\w*|decision\w*|optimiza\w*|planifica\w*|resuelve\w*)\b/i;
const EXEC_ACTION_RX=/\b(analiza\w*|audita\w*|compara\w*|estrategia\w*|plan|planifica\w*|decide\w*|decision\w*|disena\w*|optimiza\w*|escala\w*|monetiza\w*|diagnostica\w*|arquitectura\w*|evalua\w*|recomienda\w*|construye\w*|implementa\w*)\b/i;
const EXPLICIT_MULTIAGENT_RX=/\b(multiagente\w*|multi agent\w*|multiagent\w*|comite\w*|consejo\w*|war room|mesa de guerra|especialista\w*|agentes especializados)\b/i;
const CODE_RX=/\b(codigo\w*|programa\w*|software|github|api|backend|frontend|bug|debug|typescript|javascript|python|sql|deploy|render|supabase|vercel|arquitectura de software|devops|sre)\b/i;
const DESIGN_RX=/\b(diseno\w*|ux|ui|interfaz\w*|experiencia de usuario|flujo\w*|pantalla\w*|responsive|movil\w*|branding|producto visual)\b/i;

const EXEC_DOMAINS=[
  ['technology',/\b(tecnologia\w*|software|ia|inteligencia artificial|arquitectura\w*|datos|backend|frontend|api|cloud|devops|ciberseguridad)\b/i],
  ['finance',/\b(finanzas|financiero\w*|costo\w*|coste\w*|presupuesto\w*|inversion\w*|roi|ingresos|margen|ebitda|flujo de caja|valuacion\w*)\b/i],
  ['product',/\b(producto\w*|usuario\w*|ux|ui|roadmap|adopcion|retencion|experiencia)\b/i],
  ['operations',/\b(operacion\w*|proceso\w*|escala\w*|capacidad|sla|automatizacion|productividad)\b/i],
  ['risk_legal',/\b(seguridad|riesgo\w*|legal\w*|juridic\w*|ley\w*|contrato\w*|cumplimiento|compliance|privacidad|auditoria\w*)\b/i],
  ['growth',/\b(marketing|marca\w*|ventas|crecimiento|mercado\w*|adquisicion|conversion|crm|cliente\w*)\b/i],
  ['organization',/\b(empresa\w*|negocio\w*|organizacion\w*|universidad\w*|estrategia\w*|direccion|equipo\w*|recursos humanos|talento)\b/i]
];

function domainMatches(message=''){
  const q=norm(message);
  const domains=EXEC_DOMAINS.filter(([,rx])=>rx.test(q)).map(([id])=>id);
  if(CODE_RX.test(q)&&!domains.includes('technology'))domains.push('technology');
  if(DESIGN_RX.test(q)&&!domains.includes('product'))domains.push('product');
  return domains;
}

function isBookIntent(message='',mode='general'){
  const q=String(message||'');
  return bibliographicLookupIntent(q)||libraryRelevant(q,mode)||/\b(isbn|libro\w*|book\w*|novela\w*|obra literaria|autor\w*|biblioteca\w*|open library|gutenberg)\b/i.test(q);
}

function routeFor(needs={}){
  if(needs.live&&needs.multiagent)return'live_multiagent';
  if(needs.live)return'live_research';
  if(needs.library&&needs.multiagent)return'library_multiagent';
  if(needs.library)return'library_federation';
  if(needs.knowledge)return'scientific_knowledge';
  if(needs.multiagent)return'executive_multiagent';
  if(needs.reasoning)return'deep_reasoning';
  return'standard';
}

export function planUniversalIntelligence(body={}){
  const message=String(body.message||body.task||body.prompt||'').trim();
  const originalMode=String(body.mode||body.agent||'general').toLowerCase();
  const normalized=norm(message);
  const domains=domainMatches(message);
  const explicitMultiagent=bool(body.multiagent)||bool(body.orchestrate)||bool(body.deep)||originalMode==='executive'||EXPLICIT_MULTIAGENT_RX.test(normalized);
  const liveIntent=shouldUseLiveData({message,mode:originalMode,webEnabled:body.web_enabled===true});
  const bookIntent=isBookIntent(message,originalMode);
  const scientific=SCIENCE_RX.test(normalized);
  const academic=ACADEMIC_RX.test(normalized);
  const reasoning=REASONING_RX.test(normalized)||originalMode==='analysis'||originalMode==='code'||originalMode==='design'||originalMode==='executive';
  const executiveAction=EXEC_ACTION_RX.test(normalized);
  const complexExecutive=(executiveAction&&domains.length>=1&&(message.length>=70||domains.length>=2))||originalMode==='executive';
  const autoMultiagent=complexExecutive&&(domains.length>=2||message.length>=180);
  const multiagentAllowed=body.multiagent!==false&&body.orchestrate!==false;
  const liveAllowed=body.web_enabled!==false;
  const libraryAllowed=body.library!==false;
  const knowledgeAllowed=body.knowledge!==false;

  const needs={
    live:liveIntent&&liveAllowed,
    library:bookIntent&&libraryAllowed&&!liveIntent,
    knowledge:!liveIntent&&!bookIntent&&knowledgeAllowed&&(scientific||academic||['research','academic','science'].includes(originalMode)),
    reasoning,
    multiagent:multiagentAllowed&&(explicitMultiagent||autoMultiagent)
  };

  let mode=originalMode||'general';
  if(needs.multiagent&&complexExecutive&&GENERAL_MODES.has(mode))mode='executive';
  else if(needs.live&&GENERAL_MODES.has(mode))mode='research';
  else if(needs.knowledge&&GENERAL_MODES.has(mode))mode='research';
  else if(reasoning&&GENERAL_MODES.has(mode)&&!needs.library)mode=CODE_RX.test(normalized)?'code':DESIGN_RX.test(normalized)?'design':'analysis';

  return{
    version:UNIVERSAL_INTELLIGENCE_PLANNER_VERSION,
    route:routeFor(needs),
    mode,
    original_mode:originalMode||'general',
    needs,
    domains,
    signals:{
      current:liveIntent,
      book:bookIntent,
      scientific,
      academic,
      reasoning,
      executive_complex:complexExecutive,
      explicit_multiagent:explicitMultiagent
    },
    constraints:{
      live_allowed:liveAllowed,
      library_allowed:libraryAllowed,
      knowledge_allowed:knowledgeAllowed,
      multiagent_allowed:multiagentAllowed
    },
    evidence_policy:'verify-before-accept',
    freshness_policy:liveIntent?'live-evidence-required':'stable-knowledge-eligible'
  };
}

export function applyUniversalIntelligencePlan(body={},plan=planUniversalIntelligence(body)){
  const next={...body,mode:plan.mode};
  if(plan.needs.live)next.web_enabled=true;
  if(plan.needs.library)next.library=true;
  if(plan.needs.knowledge)next.knowledge=true;
  if(plan.needs.multiagent){
    next.multiagent=true;
    next.orchestrate=true;
    if(plan.signals.executive_complex)next.deep=true;
  }
  next.intelligence_planner=UNIVERSAL_INTELLIGENCE_PLANNER_VERSION;
  next.intelligence_route=plan.route;
  return next;
}

export function publicUniversalIntelligencePlan(plan={}){
  return{
    version:plan.version||UNIVERSAL_INTELLIGENCE_PLANNER_VERSION,
    route:plan.route||'standard',
    mode:plan.mode||'general',
    needs:{
      live:plan?.needs?.live===true,
      library:plan?.needs?.library===true,
      knowledge:plan?.needs?.knowledge===true,
      reasoning:plan?.needs?.reasoning===true,
      multiagent:plan?.needs?.multiagent===true
    },
    domains:Array.isArray(plan.domains)?plan.domains.slice(0,6):[],
    evidence_policy:plan.evidence_policy||'verify-before-accept',
    freshness_policy:plan.freshness_policy||'stable-knowledge-eligible'
  };
}
