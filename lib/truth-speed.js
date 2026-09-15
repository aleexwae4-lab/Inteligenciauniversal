const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

const CURRENT_RX=/\b(hoy|ahora|actual(?:es|idad|izado|izada)?|reciente|ultim[oa]s?|latest|today|current|news|noticias|precio|cotizacion|jurisprudencia|reforma|ley vigente|presidente actual|ceo actual)\b/i;
const RESEARCH_RX=/\b(investiga|investigacion|fuentes?|citas?|verifica|benchmark|estadistica|mercado|competidor|buscar en (?:la )?web)\b|\b(?:con|usa|aporta|incluye)\s+evidencia\b|\bevidencia\s+(?:web|externa|verificable|actual|de fuentes?)\b/i;
const HIGH_RISK_RX=/\b(medic|salud|diagnostic|tratamiento|dosis|farmacol|legal|juridic|penal|delito|fiscal|tributar|inversion|credito|fraude|seguridad critica|alto riesgo|high[- ]risk)\b/i;
const CREATIVE_RX=/\b(escribe|redacta|crea|genera|inventa|poema|cuento|guion|copy|correo|mensaje|publicacion|post|lema|slogan|branding)\b/i;
const REPO_RX=/\b(github|repositorio|repository|repo\b|commit|pull request|\bpr\b|branch|archivo|file)\b/i;
const CODE_RX=/```|\b(codigo|programa(?:r|cion)?|typescript|javascript|python|sql|api|backend|frontend|debug|bug|refactor|deploy)\b/i;
const FACTUAL_RX=/^\s*(que|quien|cual|cuanto|donde|cuando|define|explica|what|who|which|how many|where|when)\b/i;
const URL_RX=/https?:\/\/[^\s)\]}>"']+/gi;
const CITATION_RX=/\[W(\d+)\]/gi;

const uniq=items=>[...new Set(items.filter(Boolean))];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function deriveTruthSpeedPolicy({message='',mode='general',attachments=[],provider='auto'}={}){
  const q=fold(message),requestedMode=String(mode||'general').toLowerCase();
  const current=CURRENT_RX.test(q),research=requestedMode==='research'||RESEARCH_RX.test(q),highRisk=HIGH_RISK_RX.test(q),creative=CREATIVE_RX.test(q);
  const evidenceRequired=!creative&&(current||research||highRisk);
  const repoRelevant=REPO_RX.test(q),code=requestedMode==='code'||CODE_RX.test(q),factual=FACTUAL_RX.test(q);
  const hasAttachments=Array.isArray(attachments)&&attachments.length>0;
  const complexity=evidenceRequired||highRisk||hasAttachments?'deep':code||q.length>420?'standard':'fast';
  const timeoutMs=complexity==='fast'?22000:complexity==='standard'?32000:45000;
  const maxProviderAttempts=complexity==='fast'?2:complexity==='standard'?3:4;
  const edgeFirst=['auto','wae_edge'].includes(String(provider||'auto'));
  return{
    schema:'truth-speed-policy/v1',version:'truth-speed-governor/v36',
    evidenceRequired,current,research,highRisk,creative,repoRelevant,code,factual,hasAttachments,
    complexity,timeoutMs,maxProviderAttempts,edgeFirst,
    failClosedOnMissingEvidence:evidenceRequired,
    providerHallucinationTolerance:0
  };
}

export function planRuntimeTools({agentTools=[],requestedTools=[],message='',mode='general',attachments=[],provider='auto'}={}){
  const policy=deriveTruthSpeedPolicy({message,mode,attachments,provider});
  const explicit=new Set(Array.isArray(requestedTools)?requestedTools:[]),available=new Set(Array.isArray(agentTools)?agentTools:[]),selected=[];
  for(const id of explicit)selected.push(id);
  if(available.has('github_search')&&!explicit.has('github_search')&&(policy.repoRelevant||policy.hasAttachments&&policy.code))selected.push('github_search');
  // Universal Edge already owns web/research on the default path. Avoid duplicate Tavily preflight.
  if(available.has('web_search')&&!explicit.has('web_search')&&policy.evidenceRequired&&!policy.edgeFirst)selected.push('web_search');
  return{policy,tools:uniq(selected)};
}

function normalizeUrl(value=''){
  try{const u=new URL(String(value));u.hash='';return `${u.protocol}//${u.host}${u.pathname.replace(/\/$/,'')}${u.search}`.toLowerCase()}catch{return''}
}

export function auditGrounding({answer='',sources=[],policy}={}){
  const a=String(answer||''),p=policy||deriveTruthSpeedPolicy({}),safeSources=Array.isArray(sources)?sources:[];
  const sourceUrls=new Set(safeSources.map(source=>normalizeUrl(source?.url)).filter(Boolean));
  const answerUrls=uniq((a.match(URL_RX)||[]).map(url=>url.replace(/[.,;:!?]+$/,'')).map(normalizeUrl).filter(Boolean));
  const unsupportedUrls=answerUrls.filter(url=>!sourceUrls.has(url));
  let maxCitation=0,match;
  CITATION_RX.lastIndex=0;
  while((match=CITATION_RX.exec(a)))maxCitation=Math.max(maxCitation,Number(match[1])||0);
  const invalidCitation=maxCitation>safeSources.length;
  const missingEvidence=p.evidenceRequired&&safeSources.length===0;
  const reasons=[];
  if(missingEvidence)reasons.push('missing_required_evidence');
  if(unsupportedUrls.length)reasons.push('unsupported_url');
  if(invalidCitation)reasons.push('invalid_citation_index');
  const hardFailure=missingEvidence||unsupportedUrls.length>0||invalidCitation;
  let confidence=p.evidenceRequired?(safeSources.length?0.88:0.15):0.78;
  if(unsupportedUrls.length||invalidCitation)confidence=Math.min(confidence,0.2);
  if(safeSources.length>=2)confidence=Math.min(0.98,confidence+0.05);
  return{
    schema:'truth-grounding/v1',version:'truth-speed-governor/v36',pass:!hardFailure,hardFailure,
    confidence:Number(clamp(confidence,0,1).toFixed(3)),reasons,sourceCount:safeSources.length,
    unsupportedUrls,invalidCitation,maxCitation,evidenceRequired:p.evidenceRequired
  };
}

export function truthSpeedInstruction(policy={}){
  if(policy.evidenceRequired)return 'REGLA DE VERACIDAD: esta solicitud requiere evidencia. No afirmes hechos actuales o de alto riesgo sin fuentes observadas. Si la evidencia no está disponible, dilo explícitamente en vez de adivinar. No inventes URLs, citas, cifras ni autoridades.';
  return 'REGLA DE VERACIDAD: responde con conocimiento estable y precisión calibrada. No inventes URLs, citas, cifras, nombres, estados actuales ni acciones ejecutadas. Si un dato depende del presente, exige verificación.';
}

export function truthSpeedCapabilities(){
  return{
    version:'truth-speed-governor/v36',schema:'truth-speed-policy/v1',
    adaptiveTimeoutsMs:{fast:22000,standard:32000,deep:45000},
    providerAttempts:{fast:2,standard:3,deep:4},
    evidenceFailClosed:true,unsupportedUrlFailClosed:true,invalidCitationFailClosed:true,
    duplicateWebPreflightAvoidance:true,toolPlanning:true,baseModelTraining:false
  };
}
