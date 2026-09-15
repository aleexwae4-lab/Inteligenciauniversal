import test from 'node:test';
import assert from 'node:assert/strict';
import { EuropePmcConnector } from '../lib/knowledge/connectors-scientific-v2.js';
import { classifyScientificStudy, researchIntegrityCheck, scientificEvidenceProfile, applyScientificEvidenceProfiles, detectResearchIntegrityConflicts, scientificEvidenceSummary } from '../lib/knowledge/scientific-evidence-v2.js';
import { understandKnowledgeQuery, rerankKnowledgeRecords } from '../lib/knowledge/fabric-v1.js';
import { searchGlobalHybridIndex, privateVectorArchitecture } from '../lib/knowledge/hybrid-index-v2.js';
import { metadataOnlyLicense } from '../lib/knowledge/license-registry-v1.js';

const json=body=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
function record(overrides={}){return{id:'x',type:'paper',title:'Hypertension treatment evidence',authors:[{name:'Researcher'}],publicationDate:'2025-01-01',identifiers:{doi:'10.1000/test'},topics:['hypertension'],source:{id:'pubmed',canonical_url:'https://pubmed.ncbi.nlm.nih.gov/1/',retrieved_at:new Date().toISOString()},license:metadataOnlyLicense(),quality:{source_authority:.98,peer_review_status:'unknown',publication_type:'Journal Article',citation_count:20,retraction_status:'unknown',author_identity:'partial',primary_vs_secondary_source:'bibliographic_index',cross_source_confirmation:1},provenance:{source:'pubmed',source_record_id:'1'},raw_metadata:{pubtype:['Journal Article']},...overrides}}

test('v70 scientific classifier separates systematic review, meta-analysis, RCT and preprint',()=>{
  assert.equal(classifyScientificStudy(record({quality:{publication_type:'Systematic Review'}})),'systematic_review');
  assert.equal(classifyScientificStudy(record({quality:{publication_type:'Meta-Analysis'}})),'meta_analysis');
  assert.equal(classifyScientificStudy(record({raw_metadata:{pubtype:['Randomized Controlled Trial']}})),'randomized_controlled_trial');
  assert.equal(classifyScientificStudy(record({source:{id:'arxiv'}})),'preprint');
});

test('v70 integrity engine excludes retracted evidence from supporting factual claims',()=>{
  const retracted=record({quality:{retraction_status:'Retracted Publication'}});
  const integrity=researchIntegrityCheck(retracted);
  assert.equal(integrity.status,'retracted');
  assert.equal(integrity.usable_for_supporting_claims,false);
  const profile=scientificEvidenceProfile(retracted,understandKnowledgeQuery('evidencia clínica sobre hipertensión'));
  assert.equal(profile.ranking_multiplier,0.12);
  assert.equal(profile.evidence_stage,'compromised');
});

test('v70 preprints remain preliminary and are penalized versus controlled evidence',()=>{
  const understanding=understandKnowledgeQuery('evidencia clínica sobre hipertensión');
  const preprint=record({id:'pre',source:{id:'arxiv',canonical_url:'https://arxiv.org/abs/1'},quality:{source_authority:.98,publication_type:'paper',citation_count:20,retraction_status:'unknown'},identifiers:{doi:'10.1/pre'}});
  const rct=record({id:'rct',raw_metadata:{pubtype:['Randomized Controlled Trial']},identifiers:{doi:'10.1/rct'}});
  const [a,b]=applyScientificEvidenceProfiles([preprint,rct],understanding);
  assert.equal(a.quality.scientific.evidence_stage,'preliminary');
  assert.equal(a.quality.scientific.ranking_multiplier,0.78);
  assert.equal(b.quality.scientific.study_type,'randomized_controlled_trial');
  const ranked=rerankKnowledgeRecords([a,b],understanding);
  assert.equal(ranked[0].id,'rct');
});

test('v70.2 multilingual reranker prefers hypertension RCT over unrelated highly cited RCT',()=>{
  const understanding={...understandKnowledgeQuery('¿Qué evidencia existe sobre hipertensión y ensayos aleatorizados?'),rerank_normalized:'hypertension preprint randomized controlled trial'};
  const unrelated=record({id:'covid',title:'Remdesivir in adults with severe COVID-19: a randomised, double-blind, placebo-controlled, multicentre trial',topics:['COVID-19','clinical trial'],source:{id:'openalex',canonical_url:'https://doi.org/10.1016/example',retrieved_at:new Date().toISOString()},identifiers:{doi:'10.1016/example'},quality:{source_authority:.92,peer_review_status:'unknown',publication_type:'article',citation_count:3664,retraction_status:'unknown',author_identity:'partial',primary_vs_secondary_source:'index_metadata',cross_source_confirmation:0},raw_metadata:{type:'article'}});
  const relevant=record({id:'hypertension-rct',title:'Heart Rate Variability and Blood Pressure Response to Exercise in Individuals with Mild Hypertension: A Randomized Controlled Clinical Trial',topics:['hypertension','blood pressure'],identifiers:{doi:'10.30476/relevant'},quality:{source_authority:.98,peer_review_status:'unknown',publication_type:'Journal Article',citation_count:0,retraction_status:'unknown',author_identity:'partial',primary_vs_secondary_source:'bibliographic_index',cross_source_confirmation:0},raw_metadata:{pubtype:['Randomized Controlled Trial']}});
  const profiled=applyScientificEvidenceProfiles([unrelated,relevant],understanding);
  const ranked=rerankKnowledgeRecords(profiled,understanding);
  assert.equal(ranked[0].id,'hypertension-rct');
  assert.ok(ranked[0].quality.relevance>ranked[1].quality.relevance);
  assert.equal(ranked[0].quality.rerank_query_version,'multilingual-scientific/v70.2');
});

test('v70 detects identifier-level integrity conflicts without merging by name alone',()=>{
  const a=applyScientificEvidenceProfiles([record({id:'a',title:'Study title',publicationDate:'2024-01-01'})],{} )[0];
  const b=applyScientificEvidenceProfiles([record({id:'b',title:'Corrected study title',publicationDate:'2025-01-01',quality:{retraction_status:'Retracted Publication'}})],{} )[0];
  const conflicts=detectResearchIntegrityConflicts([a,b]);
  assert.equal(conflicts.length,1);
  assert.ok(conflicts[0].issues.includes('title_mismatch_same_doi'));
  assert.ok(conflicts[0].issues.includes('publication_year_mismatch_same_doi'));
  assert.ok(conflicts[0].issues.includes('integrity_status_mismatch_same_doi'));
});

test('v70 scientific summary exposes evidence composition instead of opaque confidence only',()=>{
  const understanding=understandKnowledgeQuery('clinical evidence');
  const rows=applyScientificEvidenceProfiles([
    record({raw_metadata:{pubtype:['Systematic Review']},identifiers:{doi:'10.1/a'}}),
    record({source:{id:'arxiv'},identifiers:{doi:'10.1/b'}}),
    record({quality:{retraction_status:'Retracted Publication'},identifiers:{doi:'10.1/c'}})
  ],understanding);
  const summary=scientificEvidenceSummary(rows);
  assert.equal(summary.total,3);assert.equal(summary.systematic_reviews,1);assert.equal(summary.preprints,1);assert.equal(summary.retracted,1);assert.equal(summary.usable_for_supporting_claims,2);
});

test('Europe PMC connector normalizes identifiers, publication type, provenance and stays metadata-only by default',async()=>{
  const connector=new EuropePmcConnector({fetchImpl:async url=>{
    const parsed=new URL(url);assert.equal(parsed.hostname,'www.ebi.ac.uk');assert.match(parsed.pathname,/europepmc\/webservices\/rest\/search/);
    return json({resultList:{result:[{id:'123',source:'MED',pmid:'123',pmcid:'PMC999',doi:'10.5555/EPMC',title:'Randomized study',authorString:'A Author, B Author',firstPublicationDate:'2025-03-01',pubTypeList:{pubType:['Randomized Controlled Trial']},citedByCount:17,isOpenAccess:'Y',abstractText:'Clinical abstract.'}]}});
  }});
  const [item]=await connector.search('hypertension',{limit:1});
  assert.equal(item.source.id,'europe_pmc');assert.equal(item.identifiers.pmid,'123');assert.equal(item.identifiers.pmcid,'PMC999');assert.equal(item.identifiers.doi,'10.5555/epmc');
  assert.equal(item.raw_metadata.pubtype[0],'Randomized Controlled Trial');assert.equal(item.license.ingestion_permission,'metadata_only');assert.equal(item.license.model_training_permission,false);assert.equal(item.provenance.source_record_id,'PMC999');
});

test('global hybrid index uses only configured Supabase RPC and labels its retrieval mode accurately',async()=>{
  const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL='https://example-project.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='service-test-key';
  try{
    const result=await searchGlobalHybridIndex('machine learning',{limit:2,fetchImpl:async (url,options)=>{
      assert.equal(url,'https://example-project.supabase.co/rest/v1/rpc/wae_global_search_v4');assert.equal(options.method,'POST');assert.equal(options.headers.apikey,'service-test-key');
      return json([{id:'11111111-1111-1111-1111-111111111111',url:'https://example.org/doc',host:'example.org',title:'Indexed evidence',description:'machine learning evidence',fetched_at:'2026-09-15T00:00:00Z',institutional_authority_score:.8,graph_authority_score:.7,rank:.9,lexical_score:.8,advanced_semantic_score:.7,temporal_freshness_score:.9,structural_quality_score:.8}]);
    }});
    assert.equal(result.status,'healthy');assert.equal(result.retrieval_mode,'fts_trigram_graph_authority_v4');assert.equal(result.records[0].source.id,'wae_global_index');assert.equal(result.records[0].license.embedding_permission,false);
  }finally{if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey}
});

test('private vector architecture is acknowledged but not exposed through public knowledge retrieval',()=>{
  const architecture=privateVectorArchitecture();
  assert.equal(architecture.available,true);assert.equal(architecture.integrated_into_public_fabric,false);assert.equal(architecture.rpc,'wae_retrieve_knowledge_v91');assert.ok(architecture.vector_indexes.includes('idx_wae_rag_chunks_semantic_hnsw'));
});
