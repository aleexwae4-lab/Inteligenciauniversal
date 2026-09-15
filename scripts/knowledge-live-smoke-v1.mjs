import { createKnowledgeConnectors } from '../lib/knowledge/connectors-v1.js';
import { searchKnowledge } from '../lib/knowledge/fabric-v1.js';

const connectors=createKnowledgeConnectors();
const probes=[
  ['openalex','machine learning'],
  ['crossref','machine learning'],
  ['wikidata','Albert Einstein'],
  ['wikipedia','Albert Einstein'],
  ['pubmed','hypertension'],
  ['arxiv','transformer neural network'],
  ['open_library','Don Quixote'],
  ['zenodo','machine learning']
];

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
let failed=false;

for(const [id,query] of probes){
  const connector=connectors.get(id);
  const started=Date.now();
  try{
    const rows=await connector.search(query,{limit:1,language:'en'});
    const first=rows[0];
    if(!first?.title)throw new Error('empty_or_unnormalized_result');
    if(first.source?.id!==id)throw new Error(`source_identity_mismatch:${first.source?.id||'missing'}`);
    if(!first.license?.ingestion_permission)throw new Error('license_metadata_missing');
    if(!first.provenance?.source_record_id)throw new Error('provenance_missing');
    results.push({source:id,status:'PASS',latency_ms:Date.now()-started,title:String(first.title).slice(0,90),license:first.license.license||'unknown',ingestion:first.license.ingestion_permission});
  }catch(error){
    failed=true;
    results.push({source:id,status:'FAIL',latency_ms:Date.now()-started,error:String(error?.message||error).slice(0,180)});
  }
  // Avoid behaving like a bulk harvester and keep spacing polite for public APIs.
  await sleep(id==='open_library'||id==='arxiv'?1100:350);
}

try{
  const fused=await searchKnowledge('machine learning',{sources:['openalex','crossref'],perSource:2,limit:4});
  if(!fused.records?.length)throw new Error('fused_retrieval_empty');
  if(fused.citations.length!==fused.records.length)throw new Error('citation_count_mismatch');
  if(!fused.citations.every(c=>c.url&&c.title&&c.source))throw new Error('citation_provenance_incomplete');
  results.push({source:'fabric_fusion',status:'PASS',documents_retrieved:fused.documents_retrieved,documents_after_dedup:fused.documents_after_dedup,citations:fused.citations.length,source_status:fused.source_status});
}catch(error){
  failed=true;
  results.push({source:'fabric_fusion',status:'FAIL',error:String(error?.message||error).slice(0,180)});
}

console.log(JSON.stringify({schema:'wae-knowledge-live-smoke/v1',checked_at:new Date().toISOString(),results},null,2));
if(failed)process.exitCode=1;
