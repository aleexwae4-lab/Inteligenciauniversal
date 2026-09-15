export const ANSWER_INTELLIGENCE_VERSION='answer-intelligence/v60';
export const ANSWER_INTELLIGENCE_SCHEMA='universal-answer-verification/v1';

const CITATION_RX=/\[((?:W|K|R)\d+)\]/gi;
const CODE_RX=/```[\s\S]*?```/g;
const OPINION_RX=/\b(en mi opini[oó]n|considero|recomiendo|conviene|prefiero|mi recomendaci[oó]n|yo (?:creo|pienso)|a mi juicio)\b/i;
const INFERENCE_RX=/\b(probablemente|posiblemente|parece|sugiere|podr[ií]a|puede indicar|es posible|estimo|estimaci[oó]n|aproximadamente|infer(?:ir|encia))\b/i;
const FACT_SIGNAL_RX=/\b(es|son|fue|fueron|tiene|tienen|incluye|incluyen|ocurri[oó]|public[oó]|lanz[oó]|fund[oó]|naci[oó]|muri[oó]|cuesta|vale|representa|equivale|aument[oó]|disminuy[oó]|gan[oó]|perdi[oó]|registr[oó]|report[oó]|seg[uú]n)\b/i;
const NUMBER_OR_DATE_RX=/\b(?:\d{1,4}(?:[.,]\d+)?%?|20\d{2}|19\d{2})\b/;

const text=(value,max=60000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const unique=items=>[...new Set(items.filter(Boolean))];

function citationKeys(value=''){
  const out=[];
  for(const match of String(value||'').matchAll(CITATION_RX))out.push(String(match[1]||'').toUpperCase());
  return unique(out);
}

function normalizeSources(payload={}){
  const responseSources=Array.isArray(payload?.response?.sources)?payload.response.sources:[];
  const webSources=Array.isArray(payload?.web_sources)?payload.web_sources:[];
  const merged=[...responseSources,...webSources];
  const seen=new Set();
  return merged.map((source,index)=>{
    const key=String(source?.key||`W${index+1}`).toUpperCase().trim();
    const url=String(source?.url||'').trim();
    const id=url||`${key}:${String(source?.title||'')}`;
    if(seen.has(id))return null;
    seen.add(id);
    return{key,url,title:String(source?.title||'').slice(0,500),host:String(source?.host||'').slice(0,250)};
  }).filter(Boolean).slice(0,20);
}

function claimFragments(answer=''){
  const cleaned=text(answer).replace(CODE_RX,' ')
    .split(/\n+/)
    .map(line=>line.replace(/^\s*(?:#{1,6}|[-*+•]|\d+[.)])\s*/,'').trim())
    .filter(line=>line&&!/^\|?\s*:?-{3,}/.test(line));
  const fragments=[];
  for(const line of cleaned){
    if(/^\|.*\|$/.test(line)){
      const cells=line.replace(/^\||\|$/g,'').split('|').map(x=>x.trim()).filter(Boolean);
      if(cells.length>1)fragments.push(cells.join(' — '));
      continue;
    }
    for(const part of line.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/u)){
      const value=part.trim();
      if(value.length>=18)fragments.push(value.slice(0,1200));
    }
  }
  return fragments.slice(0,60);
}

function classifyClaim(fragment=''){
  const clean=String(fragment||'').replace(CITATION_RX,'').trim();
  if(OPINION_RX.test(clean))return'opinion';
  if(INFERENCE_RX.test(clean))return'inference';
  const words=(clean.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)||[]).length;
  if(words>=5&&(FACT_SIGNAL_RX.test(clean)||NUMBER_OR_DATE_RX.test(clean)))return'fact';
  return'other';
}

function publicClaim(claim,validSet){
  const cited=citationKeys(claim.text),valid=cited.filter(key=>validSet.has(key)),invalid=cited.filter(key=>!validSet.has(key));
  return{
    index:claim.index,
    type:claim.type,
    citation_count:cited.length,
    valid_citations:valid,
    invalid_citations:invalid,
    supported:claim.type==='fact'?valid.length>0:null
  };
}

export function auditAnswerIntelligence(payload={}){
  const answer=text(payload?.reply??payload?.response?.content??'');
  const sources=normalizeSources(payload),validSet=new Set(sources.map(x=>x.key));
  const fragments=claimFragments(answer).map((value,index)=>({index:index+1,text:value,type:classifyClaim(value)}));
  const claims=fragments.map(item=>publicClaim(item,validSet));
  const factual=claims.filter(x=>x.type==='fact');
  const opinions=claims.filter(x=>x.type==='opinion');
  const inferences=claims.filter(x=>x.type==='inference');
  const supported=factual.filter(x=>x.supported===true).length;
  const invalid=unique(claims.flatMap(x=>x.invalid_citations));
  const cited=unique(claims.flatMap(x=>x.valid_citations));
  const citationCoverage=factual.length?supported/factual.length:1;
  const sourceBacked=sources.length>0;
  const live=Boolean(payload?.live_data?.used||payload?.response?.metadata?.liveData?.used||payload?.response?.metadata?.liveDataMesh);
  let gate='PASS',risk='low',reason='verified_or_nonfactual';
  if(invalid.length){gate='REPAIR';risk='high';reason='invalid_citation_reference'}
  else if(live&&factual.length>0&&!sourceBacked){gate='HOLD';risk='high';reason='live_claim_without_live_evidence'}
  else if(sourceBacked&&factual.length>=2&&citationCoverage<.35){gate='REVIEW';risk='medium';reason='low_claim_citation_coverage'}
  else if(!sourceBacked&&factual.length>0){gate='UNVERIFIED';risk='medium';reason='factual_claims_without_external_evidence'}
  return{
    schema:ANSWER_INTELLIGENCE_SCHEMA,
    version:ANSWER_INTELLIGENCE_VERSION,
    gate,
    risk,
    reason,
    source_count:sources.length,
    cited_source_count:cited.length,
    factual_claims:factual.length,
    supported_factual_claims:supported,
    opinion_claims:opinions.length,
    inference_claims:inferences.length,
    citation_coverage:Number(citationCoverage.toFixed(3)),
    invalid_citations:invalid,
    source_keys:sources.map(x=>x.key),
    claims:claims.slice(0,30)
  };
}

function stripInvalidCitations(answer='',invalid=[]){
  if(!invalid.length)return String(answer||'');
  const bad=new Set(invalid.map(x=>String(x).toUpperCase()));
  return String(answer||'').replace(CITATION_RX,(full,key)=>bad.has(String(key).toUpperCase())?'':full).replace(/[ \t]+([,.;:!?])/g,'$1').replace(/ {2,}/g,' ');
}

export function applyAnswerIntelligence(payload={}){
  if(!payload||typeof payload!=='object')return payload;
  const audit=auditAnswerIntelligence(payload);
  let reply=text(payload?.reply??payload?.response?.content??'');
  reply=stripInvalidCitations(reply,audit.invalid_citations);
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  const speech=String(payload.speech_text??response.speechText??reply).replace(CITATION_RX,' ').replace(/\s+/g,' ').trim();
  return{
    ...payload,
    reply,
    speech_text:speech,
    answer_intelligence:audit,
    response:{
      ...response,
      content:reply,
      speechText:speech,
      metadata:{...(response.metadata||{}),answerIntelligence:{
        schema:audit.schema,version:audit.version,gate:audit.gate,risk:audit.risk,reason:audit.reason,
        sourceCount:audit.source_count,factualClaims:audit.factual_claims,supportedFactualClaims:audit.supported_factual_claims,
        citationCoverage:audit.citation_coverage,invalidCitations:audit.invalid_citations
      }}
    }
  };
}

export function answerIntelligenceCapabilities(){
  return{
    version:ANSWER_INTELLIGENCE_VERSION,
    schema:ANSWER_INTELLIGENCE_SCHEMA,
    claimTypes:['fact','inference','opinion','other'],
    gates:['PASS','UNVERIFIED','REVIEW','REPAIR','HOLD'],
    invalidCitationFailClosed:true,
    baseModelTraining:false,
    purpose:'claim-level provenance and answer integrity verification'
  };
}
