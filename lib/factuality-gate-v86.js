export const FACTUALITY_GATE_VERSION='factuality-gate/v86';
export const FACTUALITY_GATE_SCHEMA='universal-factuality-gate/v1';

const CURRENT_RX=/\b(hoy|ahora|actual(?:es|mente|idad|izado|izada)?|vigente|reciente|últim[oa]s?|latest|today|current|currently|news|noticias|precio|cotizaci[oó]n|presidente actual|ceo actual|poblaci[oó]n actual|reforma reciente)\b/i;
const RESEARCH_RX=/\b(investiga|investigaci[oó]n|verifica|compara fuentes|fuentes?|evidencia|web|benchmark|estad[ií]stica|paper|estudio|cient[ií]fic)\b/i;
const HIGH_RISK_DOMAIN_RX=/\b(diagn[oó]stic|tratamiento|dosis|medicamento|farmacol|salud|m[eé]dic|legal|jur[ií]dic|penal|delito|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude)\b/i;
const HIGH_IMPACT_FACT_RX=/\b(es legal|es ilegal|es delito|constituye delito|puede causar|causa|contraindic|efectos? secundarios?|dosis|tratamiento recomendado|riesgo de|probabilidad de|tasa de|rendimiento de|rentabilidad|prescripci[oó]n|plazo legal|pena de|sanci[oó]n de|impuesto aplicable)\b/i;
const PRECISE_FACT_RX=/\b(qui[eé]n(?:es)?|cu[aá]ndo|d[oó]nde|cu[aá]nt[oa]s?|autor(?:a)? de|fundador(?:a)? de|naci[oó]|muri[oó]|fecha|a[nñ]o|edad|capital de|poblaci[oó]n|presidente de|ceo de|director(?:a)? de|de qu[eé] trata|personajes? de|nombre(?:s)? de)\b/i;
const TRANSFORM_RX=/\b(traduce|traducci[oó]n|corrige|ortograf[ií]a|reescribe|reformula|resume este|resumir este)\b/i;
const CREATIVE_RX=/\b(escribe|redacta|crea|genera|inventa|poema|cuento|gui[oó]n|copy|correo|mensaje|post|slogan|lema)\b/i;
const MEMORY_RX=/\b(recuerda|recordar|memoria|conversaci[oó]n anterior|lo que te dije)\b/i;

const text=(value,max=30000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);

function sourceCount(payload={}){
  const direct=Array.isArray(payload?.web_sources)?payload.web_sources:[];
  const nested=Array.isArray(payload?.response?.sources)?payload.response.sources:[];
  const ids=new Set();
  for(const source of [...direct,...nested]){
    const key=String(source?.url||source?.key||source?.title||'').trim();
    if(key)ids.add(key);
  }
  return ids.size;
}

export function classifyFactualityRequest(body={}){
  const message=text(body?.message||body?.task||body?.prompt||'');
  const mode=String(body?.mode||body?.agent||'general').toLowerCase();
  const transform=TRANSFORM_RX.test(message)||CREATIVE_RX.test(message)||MEMORY_RX.test(message);
  const current=CURRENT_RX.test(message);
  const research=mode==='research'||RESEARCH_RX.test(message)||body?.web_enabled===true;
  const highRiskDomain=HIGH_RISK_DOMAIN_RX.test(message);
  const preciseFact=PRECISE_FACT_RX.test(message);
  const highImpactFact=highRiskDomain&&(current||research||preciseFact||HIGH_IMPACT_FACT_RX.test(message));
  const requiresVerification=!transform&&(current||research||preciseFact||highImpactFact);
  return{
    schema:FACTUALITY_GATE_SCHEMA,
    version:FACTUALITY_GATE_VERSION,
    message,
    mode,
    current,
    research,
    high_risk:highRiskDomain,
    high_impact_fact:highImpactFact,
    precise_fact:preciseFact,
    transform,
    requires_verification:requiresVerification,
    preferred_repair:current||research||highImpactFact?'research':'focused_factual'
  };
}

export function factualityDecision(payload={},body={}){
  const profile=classifyFactualityRequest(body);
  const audit=payload?.answer_intelligence||payload?.response?.metadata?.answerIntelligence||{};
  const quality=payload?.quality_reliability||payload?.response?.metadata?.qualityReliability||{};
  const gate=String(audit?.gate||'PASS').toUpperCase();
  const sources=Number(audit?.source_count??audit?.sourceCount??sourceCount(payload));
  const citedSources=Number(audit?.cited_source_count??audit?.citedSourceCount??0);
  const factualClaims=Number(audit?.factual_claims??audit?.factualClaims??0);
  const coverage=Number(audit?.citation_coverage??audit?.citationCoverage??1);
  const reasons=[];

  if(profile.requires_verification){
    if(sources<1)reasons.push('verification_required_without_evidence');
    if(sources>0&&citedSources<1)reasons.push('evidence_present_but_uncited');
    if(['HOLD','REPAIR','UNVERIFIED'].includes(gate))reasons.push(`answer_gate_${gate.toLowerCase()}`);
    if(gate==='REVIEW')reasons.push('answer_gate_review');
    if(factualClaims>0&&sources>0&&coverage<0.6)reasons.push('material_claims_under_cited');
    if(quality?.critical_failure===true||quality?.criticalFailure===true)reasons.push('quality_critical_failure');
  }

  return{
    schema:FACTUALITY_GATE_SCHEMA,
    version:FACTUALITY_GATE_VERSION,
    profile,
    source_count:sources,
    cited_source_count:citedSources,
    factual_claims:factualClaims,
    citation_coverage:Number.isFinite(coverage)?coverage:0,
    upstream_gate:gate,
    requires_repair:reasons.length>0,
    reasons:[...new Set(reasons)],
    accept:reasons.length===0,
    repair_strategy:profile.preferred_repair
  };
}

export function factualityHoldText(decision={}){
  const profile=decision?.profile||{};
  if(profile.current)return 'No voy a darte ese dato como actual porque no pude verificarlo con evidencia suficiente en este turno. Prefiero bloquear una afirmación posiblemente incorrecta antes que presentarla como un hecho vigente.';
  if(profile.high_impact_fact)return 'No voy a presentar esa afirmación de alto impacto como un hecho sin evidencia suficiente. La respuesta quedó bloqueada por el control de precisión para evitar información incorrecta o engañosa.';
  return 'No voy a presentar ese dato como un hecho porque la evidencia disponible no fue suficiente para verificarlo. El control de precisión bloqueó la respuesta antes de entregar información posiblemente incorrecta.';
}

export function factualityGateCapabilities(){
  return{
    version:FACTUALITY_GATE_VERSION,
    schema:FACTUALITY_GATE_SCHEMA,
    policy:'verify-before-accept',
    verifyOn:['current_information','research','high_impact_factual','precise_factual_questions'],
    failClosedWhenEvidenceMissing:true,
    requireCitedEvidence:true,
    minimumMaterialCitationCoverage:0.6,
    unverifiedPromotion:false,
    baseModelTraining:false
  };
}
