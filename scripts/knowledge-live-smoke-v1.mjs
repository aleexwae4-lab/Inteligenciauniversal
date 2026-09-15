import { createKnowledgeConnectors } from '../lib/knowledge/connectors-scientific-v2.js';
import { searchKnowledge } from '../lib/knowledge/fabric-v1.js';

const connectors=createKnowledgeConnectors();
const probes=[
  ['openalex','machine learning'],
  ['crossref','machine learning'],
  ['wikidata','Albert Einstein'],
  ['wikipedia','Albert Einstein'],
  ['pubmed','hypertension'],
  ['europe_pmc','hypertension randomized controlled trial'],
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
  await sleep(id==='open_library'||id==='arxiv'?1100:350);
}

try{
  const fused=await searchKnowledge('hypertension clinical evidence',{sources:['pubmed','europe_pmc','openalex','crossref'],perSource:2,limit:6,includeGlobalIndex:false});
  if(!fused.records?.length)throw new Error('fused_retrieval_empty');
  if(fused.citations.length!==fused.records.length)throw new Error('citation_count_mismatch');
  if(!fused.citations.every(c=>c.url&&c.title&&c.source))throw new Error('citation_provenance_incomplete');
  if(!fused.source_status.every(s=>s.status==='healthy'))throw new Error(`fused_source_degraded:${JSON.stringify(fused.source_status)}`);
  if(!fused.scientific_evidence||fused.scientific_evidence.total!==fused.records.length)throw new Error('scientific_profile_missing');
  if(!fused.records.every(r=>r.quality?.scientific?.integrity))throw new Error('integrity_profile_missing');
  results.push({source:'scientific_fusion',status:'PASS',documents_retrieved:fused.documents_retrieved,documents_after_dedup:fused.documents_after_dedup,citations:fused.citations.length,scientific_evidence:fused.scientific_evidence,integrity_conflicts:fused.integrity_conflicts?.length||0,source_status:fused.source_status});
}catch(error){
  failed=true;
  results.push({source:'scientific_fusion',status:'FAIL',error:String(error?.message||error).slice(0,240)});
}

try{
  const query='¿Qué tipo de evidencia científica existe sobre hipertensión y cómo debo interpretar preprints frente a ensayos aleatorizados?';
  const multilingual=await searchKnowledge(query,{mode:'research',maxSources:5,perSource:2,limit:6,includeGlobalIndex:false});
  if(multilingual.understanding?.domains?.[0]!=='medicine')throw new Error(`spanish_domain_wrong:${JSON.stringify(multilingual.understanding?.domains)}`);
  if(multilingual.sources_selected?.[0]!=='pubmed'||multilingual.sources_selected?.[1]!=='europe_pmc')throw new Error(`spanish_source_priority_wrong:${JSON.stringify(multilingual.sources_selected)}`);
  const q=String(multilingual.understanding?.rerank_normalized||'');
  if(!q.includes('hypertension')||!q.includes('randomized')||!q.includes('trial'))throw new Error(`spanish_rerank_query_wrong:${q}`);
  if(!multilingual.records?.length)throw new Error('spanish_retrieval_empty');
  const top=multilingual.records[0];
  const semanticText=`${top.title||''} ${(top.topics||[]).join(' ')}`.toLowerCase();
  if(!/(hypertension|blood pressure|hypertensive)/.test(semanticText))throw new Error(`spanish_top_result_not_hypertension:${top.title||'missing'}`);
  if(!multilingual.source_status.filter(s=>['pubmed','europe_pmc'].includes(s.source_id)).every(s=>s.status==='healthy'))throw new Error(`spanish_biomedical_source_degraded:${JSON.stringify(multilingual.source_status)}`);
  results.push({source:'spanish_scientific_routing_reranking',status:'PASS',domain:multilingual.understanding.domains[0],sources:multilingual.sources_selected.slice(0,4),rerank_query:q,top_title:String(top.title).slice(0,140),top_source:top.source?.id,top_relevance:top.quality?.relevance,top_score:top.quality?.rerank_score});
}catch(error){
  failed=true;
  results.push({source:'spanish_scientific_routing_reranking',status:'FAIL',error:String(error?.message||error).slice(0,300)});
}

console.log(JSON.stringify({schema:'wae-knowledge-live-smoke/v70.2-multilingual',checked_at:new Date().toISOString(),results},null,2));
if(failed)process.exitCode=1;
