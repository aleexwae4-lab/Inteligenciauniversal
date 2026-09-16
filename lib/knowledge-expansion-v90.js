import { classifyUniversalKnowledge } from './universal-knowledge-mesh-v89.js';

export const KNOWLEDGE_EXPANSION_VERSION='autonomous-knowledge-expansion/v90';
export const KNOWLEDGE_EXPANSION_SCHEMA='knowledge-source-certification/v1';

const text=(value,max=1000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const now=()=>new Date().toISOString();

const CANDIDATES=Object.freeze([
  {
    id:'semantic_scholar',name:'Semantic Scholar Academic Graph',domains:['science','medicine','software','general'],
    probe_url:'https://api.semanticscholar.org/graph/v1/paper/search?query=artificial%20intelligence&limit=1&fields=paperId,title,year,url',
    authority_class:'scholarly_graph',access:'public_rate_limited',content_policy:'metadata_first',license_policy:'API terms govern returned metadata; full text is never assumed licensed',
    expected_fields:['data'],promotion_requirements:['health_probe','schema_probe','rate_limit_backoff','license_review','prompt_injection_test','dedupe_test']
  },
  {
    id:'library_of_congress',name:'Library of Congress JSON API',domains:['books','history','geography','general'],
    probe_url:'https://www.loc.gov/search/?q=artificial%20intelligence&fo=json&c=1&at=results',
    authority_class:'national_library',access:'public',content_policy:'metadata_and_public_collection_records',license_policy:'rights vary by item; no blanket full-text or training permission',
    expected_fields:['results'],promotion_requirements:['health_probe','schema_probe','item_rights_review','prompt_injection_test','dedupe_test']
  }
]);

function candidateById(id){return CANDIDATES.find(item=>item.id===String(id||'').toLowerCase())||null}

async function probeCandidate(candidate,{fetchImpl=fetch,timeoutMs=2200}={}){
  const started=Date.now();
  try{
    const response=await fetchImpl(candidate.probe_url,{headers:{Accept:'application/json','User-Agent':'WAE-Universal-Core/90'},signal:AbortSignal.timeout(Math.max(500,Math.min(5000,Number(timeoutMs)||2200)))});
    if(!response.ok)return{status:response.status===429?'rate_limited':'degraded',http_status:response.status,latency_ms:Date.now()-started,schema_ok:false};
    const body=await response.json();
    const schemaOk=candidate.expected_fields.every(field=>Object.prototype.hasOwnProperty.call(body||{},field));
    return{status:schemaOk?'healthy':'schema_mismatch',http_status:response.status,latency_ms:Date.now()-started,schema_ok:schemaOk};
  }catch(error){
    return{status:error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':'degraded',http_status:null,latency_ms:Date.now()-started,schema_ok:false,error:text(error?.message||error,160)};
  }
}

export function knowledgeExpansionCandidatesV90(query=''){
  const classification=classifyUniversalKnowledge({message:query||'general knowledge',knowledge:true});
  const domains=new Set(classification.domains||[]);
  const candidates=CANDIDATES.map(item=>{
    const matched=item.domains.filter(domain=>domains.has(domain));
    return{...item,relevance:matched.length?Math.min(1,.55+matched.length*.15):.25,matched_domains:matched,certification:'candidate',active_in_answer_path:false};
  }).sort((a,b)=>b.relevance-a.relevance);
  return{version:KNOWLEDGE_EXPANSION_VERSION,schema:KNOWLEDGE_EXPANSION_SCHEMA,classification,candidates};
}

export async function auditKnowledgeExpansionV90({query='',candidateId=null,live=true,fetchImpl=fetch,timeoutMs=2200}={}){
  const planned=knowledgeExpansionCandidatesV90(query);
  const selected=candidateId?[candidateById(candidateId)].filter(Boolean):planned.candidates.slice(0,3);
  const results=[];
  for(const candidate of selected){
    const probe=live?await probeCandidate(candidate,{fetchImpl,timeoutMs}):{status:'not_probed',http_status:null,latency_ms:null,schema_ok:false};
    const blockers=[];
    if(probe.status!=='healthy')blockers.push('health_or_schema_not_verified');
    blockers.push('license_review_required_before_fulltext_or_training');
    results.push({
      id:candidate.id,name:candidate.name,authority_class:candidate.authority_class,access:candidate.access,content_policy:candidate.content_policy,license_policy:candidate.license_policy,
      matched_domains:candidate.matched_domains||[],probe,promotion:'HOLD',blockers,promotion_requirements:candidate.promotion_requirements,active_in_answer_path:false
    });
  }
  return{
    version:KNOWLEDGE_EXPANSION_VERSION,schema:KNOWLEDGE_EXPANSION_SCHEMA,generated_at:now(),query:text(query,1500),
    policy:{autoDiscover:true,autoProbe:true,autoPromote:false,promotionRequiresCertification:true,unknownLicensesFailClosed:true,arbitraryWebIngestion:false,baseModelTraining:false},
    results
  };
}

export function knowledgeExpansionCapabilitiesV90(){
  return{
    version:KNOWLEDGE_EXPANSION_VERSION,schema:KNOWLEDGE_EXPANSION_SCHEMA,candidateCount:CANDIDATES.length,
    candidateIds:CANDIDATES.map(item=>item.id),autoDiscover:true,autoProbe:true,autoPromote:false,promotionRequiresCertification:true,
    policies:{licenseFailClosed:true,rightsPerItem:true,promptInjectionGate:true,dedupeRequired:true,rateLimitBackoffRequired:true,baseModelTraining:false}
  };
}
