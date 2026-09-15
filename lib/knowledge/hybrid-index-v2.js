import { metadataOnlyLicense, normalizeLicenseMetadata } from './license-registry-v1.js';

export const HYBRID_INDEX_VERSION='wae-hybrid-index/v2';
const text=(value,max=5000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function supabaseEndpoint(){
  const raw=String(process.env.SUPABASE_URL||'').trim();
  if(!raw)return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:')return null;
    if(!(url.hostname==='supabase.co'||url.hostname.endsWith('.supabase.co')))return null;
    return url.origin;
  }catch{return null}
}

export function globalHybridIndexConfigured(){return Boolean(supabaseEndpoint()&&process.env.SUPABASE_SERVICE_ROLE_KEY)}

export async function searchGlobalHybridIndex(query,{limit=6,fetchImpl=fetch}={}){
  const base=supabaseEndpoint();const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key)return{version:HYBRID_INDEX_VERSION,status:'disabled',reason:'supabase_service_configuration_missing',retrieval_mode:'fts_trigram_graph_authority_v4',records:[],latency_ms:0};
  const q=text(query,700);if(!q)return{version:HYBRID_INDEX_VERSION,status:'skipped',reason:'query_required',retrieval_mode:'fts_trigram_graph_authority_v4',records:[],latency_ms:0};
  const started=Date.now();
  try{
    const response=await fetchImpl(`${base}/rest/v1/rpc/wae_global_search_v4`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_query:q,p_limit:Math.max(1,Math.min(Number(limit)||6,12))}),signal:AbortSignal.timeout(3500)});
    if(!response.ok)throw Object.assign(new Error(`hybrid_index_http_${response.status}`),{status:response.status});
    const rows=await response.json();
    const records=(Array.isArray(rows)?rows:[]).map(row=>{
      const canonical=text(row.url,1600);const license=normalizeLicenseMetadata({source:'wae_global_index',sourceId:row.id,canonicalUrl:canonical,baseline:metadataOnlyLicense({license:'unknown indexed-web rights; metadata/excerpt only',copyrightStatus:'unknown'}),provenance:{retrieval_mode:'fts_trigram_graph_authority_v4',index_version:HYBRID_INDEX_VERSION}});
      return{id:`wae_global_index:${row.id}`,type:'web_document',title:text(row.title,800),abstract:text(row.description||row.excerpt,3000)||undefined,authors:[],publicationDate:row.fetched_at||undefined,language:undefined,identifiers:{},topics:[],source:{id:'wae_global_index',canonical_url:canonical,retrieved_at:new Date().toISOString(),connector_version:HYBRID_INDEX_VERSION},license,citations:[],quality:{source_authority:clamp(Math.max(Number(row.institutional_authority_score||0),Number(row.graph_authority_score||0))),peer_review_status:'unknown',publication_type:'indexed_web_document',citation_count:null,publication_date:row.fetched_at||null,retraction_status:'unknown',author_identity:'unknown',institution:row.host||null,primary_vs_secondary_source:'indexed_web',cross_source_confirmation:0,license_confidence:license.confidence||'policy',index_rank:clamp(row.rank),lexical_score:clamp(row.lexical_score),advanced_semantic_score:clamp(row.advanced_semantic_score),temporal_freshness_score:clamp(row.temporal_freshness_score),structural_quality_score:clamp(row.structural_quality_score)},provenance:{source:'wae_global_index',source_record_id:String(row.id||''),canonical_url:canonical,retrieved_at:new Date().toISOString(),retrieval_mode:'fts_trigram_graph_authority_v4'},raw_metadata:{host:row.host||null,content_hash:row.content_hash||null,semantic_profile_hash:row.semantic_profile_hash||null,ranking_hash:row.ranking_hash||null}};
    }).filter(record=>record.title&&/^https?:\/\//.test(record.source.canonical_url));
    return{version:HYBRID_INDEX_VERSION,status:'healthy',retrieval_mode:'fts_trigram_graph_authority_v4',records,latency_ms:Date.now()-started};
  }catch(error){return{version:HYBRID_INDEX_VERSION,status:Number(error?.status)===429?'rate_limited':'degraded',reason:text(error?.message||error,180),retrieval_mode:'fts_trigram_graph_authority_v4',records:[],latency_ms:Date.now()-started}}
}

export function privateVectorArchitecture(){return{available:true,integrated_into_public_fabric:false,reason:'requires_authenticated_organization_user_and_query_embedding',rpc:'wae_retrieve_knowledge_v91',vector_indexes:['idx_wae_rag_chunks_semantic_hnsw','idx_wae_rag_chunks_embedding_hnsw'],fts_index:'wae_rag_chunks_fts_idx',semantic_profile:'wae-supabase-gte-small-384-v1',fallback_profile:'wae-local-hash-1536-v1'}}
