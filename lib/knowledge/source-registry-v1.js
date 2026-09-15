import { metadataOnlyLicense } from './license-registry-v1.js';

export const KNOWLEDGE_SOURCE_REGISTRY_VERSION='knowledge-source-registry/v1';

const now=()=>new Date().toISOString();

const SOURCES=Object.freeze([
  {source_id:'openalex',name:'OpenAlex',category:'academic_graph',base_url:'https://api.openalex.org',api_available:true,authentication_required:false,full_text:false,metadata:true,rate_limit:'provider-managed; identify requests when possible',health:'unknown',trust_score:0.92,certification:'candidate_integrated',license:metadataOnlyLicense({license:'CC0 metadata',copyrightStatus:'metadata_facts'}),domains:['science','medicine','biology','physics','computer_science','mathematics','economics','engineering','general_knowledge']},
  {source_id:'crossref',name:'Crossref',category:'scholarly_metadata',base_url:'https://api.crossref.org',api_available:true,authentication_required:false,full_text:false,metadata:true,rate_limit:'public/polite pool; backoff required',health:'unknown',trust_score:0.96,certification:'candidate_integrated',license:metadataOnlyLicense({license:'reusable bibliographic metadata; abstracts excluded',copyrightStatus:'metadata_facts'}),domains:['science','medicine','biology','physics','computer_science','mathematics','economics','engineering','general_knowledge']},
  {source_id:'wikidata',name:'Wikidata',category:'structured_knowledge',base_url:'https://www.wikidata.org',api_available:true,authentication_required:false,full_text:false,metadata:true,rate_limit:'Wikimedia API etiquette',health:'unknown',trust_score:0.84,certification:'candidate_integrated',license:{...metadataOnlyLicense({license:'CC0',copyrightStatus:'public_domain'}),license_class:'cc0',ingestion_permission:'allowed',storage_permission:true,embedding_permission:true,redistribution_permission:true,model_training_permission:true},domains:['history','biography','philosophy','literature','general_knowledge','science']},
  {source_id:'wikipedia',name:'Wikipedia',category:'encyclopedia',base_url:'https://www.wikipedia.org',api_available:true,authentication_required:false,full_text:true,metadata:true,rate_limit:'Wikimedia API etiquette',health:'unknown',trust_score:0.76,certification:'candidate_integrated',license:{...metadataOnlyLicense({license:'CC BY-SA',copyrightStatus:'licensed'}),license_class:'creative_commons',ingestion_permission:'transient_excerpt',storage_permission:false,embedding_permission:false,redistribution_permission:true,model_training_permission:false},domains:['history','biography','philosophy','literature','general_knowledge','science']},
  {source_id:'pubmed',name:'PubMed',category:'biomedical_metadata',base_url:'https://eutils.ncbi.nlm.nih.gov',api_available:true,authentication_required:false,full_text:false,metadata:true,rate_limit:'3 req/s without NCBI API key; higher with key',health:'unknown',trust_score:0.98,certification:'candidate_integrated',license:metadataOnlyLicense({license:'metadata-only; article copyright varies',copyrightStatus:'mixed'}),domains:['medicine','biology','health']},
  {source_id:'arxiv',name:'arXiv',category:'preprints',base_url:'https://export.arxiv.org',api_available:true,authentication_required:false,full_text:false,metadata:true,rate_limit:'respect arXiv API delay/backoff',health:'unknown',trust_score:0.78,certification:'candidate_integrated',license:metadataOnlyLicense({license:'metadata-only; per-item full-text license varies',copyrightStatus:'mixed'}),domains:['physics','computer_science','mathematics','statistics','engineering','economics']},
  {source_id:'open_library',name:'Open Library',category:'books',base_url:'https://openlibrary.org',api_available:true,authentication_required:false,full_text:false,metadata:true,rate_limit:'1 req/s unidentified; 3 req/s identified; low-volume discovery only',health:'unknown',trust_score:0.80,certification:'candidate_integrated',license:metadataOnlyLicense({license:'metadata-only; follow Open Library usage guidelines',copyrightStatus:'mixed'}),domains:['literature','history','biography','philosophy','general_knowledge','books']},
  {source_id:'zenodo',name:'Zenodo',category:'research_repository',base_url:'https://zenodo.org/api',api_available:true,authentication_required:false,full_text:false,metadata:true,rate_limit:'provider-managed; backoff required',health:'unknown',trust_score:0.88,certification:'candidate_integrated',license:metadataOnlyLicense({license:'metadata CC0; files use per-record license',copyrightStatus:'mixed'}),domains:['science','datasets','software','engineering','general_knowledge']},
  {source_id:'core',name:'CORE',category:'academic_aggregator',base_url:'https://api.core.ac.uk',api_available:true,authentication_required:true,full_text:true,metadata:true,rate_limit:'API-key plan dependent',health:'disabled',trust_score:0.88,certification:'auth_required_not_certified',license:metadataOnlyLicense({license:'per-record/open-access rights vary',copyrightStatus:'mixed'}),domains:['science','medicine','computer_science','general_knowledge']},
  {source_id:'doaj',name:'Directory of Open Access Journals',category:'open_access_directory',base_url:'https://doaj.org/api',api_available:true,authentication_required:false,full_text:false,metadata:true,rate_limit:'not certified in WAE v1',health:'disabled',trust_score:0.91,certification:'pending_endpoint_certification',license:metadataOnlyLicense({license:'metadata/API access; article licenses vary',copyrightStatus:'mixed'}),domains:['science','medicine','biology','general_knowledge']},
  {source_id:'scielo',name:'SciELO',category:'scholarly_repository',base_url:'https://www.scielo.org',api_available:false,authentication_required:false,full_text:true,metadata:true,rate_limit:'connector not certified',health:'disabled',trust_score:0.91,certification:'pending_api_and_license_certification',license:metadataOnlyLicense({license:'per-journal/article license varies',copyrightStatus:'mixed'}),domains:['medicine','biology','science','latam','general_knowledge']},
  {source_id:'project_gutenberg',name:'Project Gutenberg',category:'public_domain_books',base_url:'https://www.gutenberg.org',api_available:false,authentication_required:false,full_text:true,metadata:true,rate_limit:'bulk/mirror policy required; no search API certified',health:'disabled',trust_score:0.90,certification:'pending_bulk_connector_certification',license:{...metadataOnlyLicense({license:'public-domain focus; jurisdiction/per-item checks required',copyrightStatus:'mixed'}),ingestion_permission:'per_record_check',storage_permission:false,embedding_permission:false,model_training_permission:false},domains:['literature','history','books']}
]);

export function listKnowledgeSources({includeDisabled=true}={}){
  return SOURCES.filter(source=>includeDisabled||source.health!=='disabled').map(source=>({...source,last_check:null,registry_version:KNOWLEDGE_SOURCE_REGISTRY_VERSION}));
}

export function getKnowledgeSource(id=''){
  const source=SOURCES.find(item=>item.source_id===String(id).toLowerCase());
  return source?{...source,last_check:null,registry_version:KNOWLEDGE_SOURCE_REGISTRY_VERSION}:null;
}

export function routableSourcesForDomains(domains=[]){
  const wanted=new Set((Array.isArray(domains)?domains:[]).map(x=>String(x).toLowerCase()));
  return SOURCES.filter(source=>source.certification==='candidate_integrated'&&source.health!=='disabled'&&(!wanted.size||source.domains.some(domain=>wanted.has(domain))));
}

export function sourceRegistrySnapshot(healthById={}){
  return SOURCES.map(source=>{
    const health=healthById[source.source_id];
    return {...source,health:health?.status||source.health,last_check:health?.checked_at||null,health_detail:health?.detail||null,registry_version:KNOWLEDGE_SOURCE_REGISTRY_VERSION};
  });
}

export function sourceRegistryHealth(){return{version:KNOWLEDGE_SOURCE_REGISTRY_VERSION,source_count:SOURCES.length,routable_count:SOURCES.filter(x=>x.certification==='candidate_integrated').length,generated_at:now()}}
