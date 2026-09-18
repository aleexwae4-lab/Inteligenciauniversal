import { createHash } from 'node:crypto';
import { callInternalSupabaseRpc, internalSupabaseTransportState } from '../internal-supabase-rpc-v74.js';
export const WEB_EVIDENCE_PERSISTENCE_VERSION='web-evidence-persistence/v2.0.0';
const clean=(v,max=80000)=>String(v??'').replace(/\u0000/g,'').trim().slice(0,max);
const sha=v=>createHash('sha256').update(String(v??'')).digest('hex');
export function webEvidencePersistenceState(){
  const transport=internalSupabaseTransportState();
  return{version:WEB_EVIDENCE_PERSISTENCE_VERSION,enabled:String(process.env.WAE_WEB_PERSIST_EVIDENCE||'0')==='1',configured:transport.configured,leastPrivilegeReady:transport.leastPrivilegeReady,credentialMode:transport.credentialMode,policy:'official_or_primary_high_trust_metadata_only'};
}
export function shouldPersistWebEvidence(item={}){
  const state=webEvidencePersistenceState();if(!state.enabled||!state.leastPrivilegeReady)return{ok:false,reason:'persistence_disabled_or_unprivileged'};
  const doc=item.document||item.extracted||{},source=item.registrySource||{},trust=Number(item.authority?.trustScore||0);
  if(!/^https:\/\//i.test(doc.finalUrl||item.url||''))return{ok:false,reason:'https_required'};
  if(trust<80)return{ok:false,reason:'trust_below_80'};
  if(source.communitySource||source.sourceType==='social_signal'||source.sourceType==='community_signal')return{ok:false,reason:'community_not_promotable'};
  if(!(source.primarySource||source.officialSource||source.governmentSource||source.academicSource))return{ok:false,reason:'authority_class_not_promotable'};
  if(clean(doc.text,2000).length<100)return{ok:false,reason:'insufficient_extracted_text'};
  if(!/^[0-9a-f]{64}$/i.test(String(doc.contentHash||'')))return{ok:false,reason:'invalid_content_hash'};
  return{ok:true,reason:'eligible'};
}
export async function persistWebEvidence(item={}){
  const decision=shouldPersistWebEvidence(item);if(!decision.ok)return{persisted:false,...decision};
  const doc=item.document||item.extracted||{},url=doc.finalUrl||item.url,parsed=new URL(url),authority=Math.max(0,Math.min(1,Number(item.authority?.trustScore||0)/100));
  const freshness=Math.max(0,Math.min(1,Number(item.authority?.components?.freshness||50)/100));
  const quality=Math.max(0,Math.min(1,0.45+Math.min(0.35,Number(doc.wordCount||0)/6000)+(doc.structured&&Object.keys(doc.structured).length?0.1:0)+(doc.promptInjectionDetected? -0.2:0)));
  const sourceClass=clean(item.registrySource?.category||item.registrySource?.sourceType||'unclassified',80);
  const evidenceHash=sha([doc.contentHash,url,sourceClass,clean(doc.excerpt,4000)].join('\n'));
  const result=await callInternalSupabaseRpc({
    functionName:'wae_web_ingest_document_v2',timeoutMs:1800,clientInfo:'wae-web-intelligence-v2',
    body:{p_url:url,p_origin:parsed.origin,p_host:parsed.hostname.toLowerCase(),p_title:clean(doc.title||item.title,500),p_description:clean(doc.description,2000),p_excerpt:clean(doc.excerpt||item.snippet,4000),p_index_text:clean(doc.text,80000),p_content_hash:doc.contentHash,p_evidence_hash:evidenceHash,p_http_status:Number(doc.httpStatus)||200,p_content_type:clean(doc.contentType,160),p_word_count:Number(doc.wordCount)||0,p_link_count:Number(doc.linkCount)||0,p_source_class:sourceClass,p_authority_score:authority,p_freshness_score:freshness,p_quality_score:quality,p_robots_status:({parsed:'allowed',not_found:'allowed',disabled:'unknown',unavailable:'unavailable'}[String(doc.robots?.status||'unknown')]||(/^http_/.test(String(doc.robots?.status||''))?'unavailable':'error')),p_robots_hash:/^[0-9a-f]{64}$/i.test(String(doc.robots?.hash||''))?doc.robots.hash:null}
  });
  return result.ok?{persisted:true,documentId:result.payload?.document_id||result.payload?.id||null,mode:result.mode}:{persisted:false,reason:result.error||'rpc_failed',status:result.status||null};
}
