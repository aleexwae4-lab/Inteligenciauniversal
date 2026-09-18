export const UNIVERSAL_SOURCE_REGISTRY_VERSION='universal-source-registry/v1.0.0';
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
const now=()=>new Date().toISOString();

function source(input={}){
  const domain=String(input.domain||'').toLowerCase().replace(/^www\./,'');
  return Object.freeze({
    id:String(input.id||domain).toLowerCase(),name:String(input.name||domain),domain,
    category:input.category||'general',subcategory:input.subcategory||null,country:input.country||'global',
    jurisdiction:input.jurisdiction||null,language:input.language||['multi'],sourceType:input.sourceType||'secondary',
    authorityLevel:input.authorityLevel||'medium',reliabilityScore:clamp(input.reliabilityScore??70),
    primarySource:Boolean(input.primarySource),officialSource:Boolean(input.officialSource),academicSource:Boolean(input.academicSource),
    governmentSource:Boolean(input.governmentSource),newsSource:Boolean(input.newsSource),communitySource:Boolean(input.communitySource),
    apiAvailable:Boolean(input.apiAvailable),apiEndpoint:input.apiEndpoint||null,rssAvailable:Boolean(input.rssAvailable),
    searchSupported:input.searchSupported!==false,authenticationRequired:Boolean(input.authenticationRequired),
    rateLimit:input.rateLimit||'provider-managed',robotsPolicy:input.robotsPolicy||'respect',
    termsOfService:input.termsOfService||'provider-specific',license:input.license||'provider-specific',
    copyrightPolicy:input.copyrightPolicy||'metadata/snippets only unless license permits more',
    freshnessProfile:input.freshnessProfile||'MEDIUM',lastVerifiedAt:input.lastVerifiedAt||null,
    healthStatus:input.healthStatus||'registered',averageLatency:input.averageLatency??null,
    trustScore:clamp(input.trustScore??input.reliabilityScore??70),
    supportedCapabilities:Array.isArray(input.supportedCapabilities)?input.supportedCapabilities:[],
    lifecycle:input.lifecycle||'active',notes:input.notes||null
  });
}
const S=(id,name,domain,category,trust,flags={})=>source({id,name,domain,category,reliabilityScore:trust,trustScore:trust,...flags});
const BUILT_INS=[
S('brave_search','Brave Search API','api.search.brave.com','search',88,{sourceType:'discovery_engine',officialSource:true,apiAvailable:true,apiEndpoint:'https://api.search.brave.com/res/v1/web/search',authenticationRequired:true,freshnessProfile:'REAL_TIME',supportedCapabilities:['web_search','news_discovery','source_discovery']}),
S('tavily','Tavily Search API','api.tavily.com','search',86,{sourceType:'discovery_engine',officialSource:true,apiAvailable:true,apiEndpoint:'https://api.tavily.com/search',authenticationRequired:true,freshnessProfile:'REAL_TIME',supportedCapabilities:['web_search','research','source_discovery']}),
S('google_custom_search','Google Custom Search JSON API','www.googleapis.com','search',90,{sourceType:'discovery_engine',officialSource:true,apiAvailable:true,apiEndpoint:'https://www.googleapis.com/customsearch/v1',authenticationRequired:true,freshnessProfile:'REAL_TIME',lifecycle:'sunset_2027-01-01',notes:'Closed to new customers; existing customers must migrate by 2027-01-01.'}),
S('bing_search_legacy','Bing Search APIs (legacy)','api.bing.microsoft.com','search',0,{officialSource:true,apiAvailable:false,searchSupported:false,healthStatus:'retired',lifecycle:'retired_2025-08-11',notes:'Retired by Microsoft on 2025-08-11.'}),
S('duckduckgo','DuckDuckGo Instant Answer API','api.duckduckgo.com','search',72,{sourceType:'discovery_engine',officialSource:true,apiAvailable:true,apiEndpoint:'https://api.duckduckgo.com/',freshnessProfile:'MEDIUM'}),
S('startpage','Startpage','startpage.com','search',75,{officialSource:true,apiAvailable:false,searchSupported:false,healthStatus:'discovery_only'}),
S('yahoo_search','Yahoo Search','search.yahoo.com','search',74,{officialSource:true,apiAvailable:false,searchSupported:false,healthStatus:'discovery_only'}),

S('wikipedia','Wikipedia','wikipedia.org','knowledge',78,{subcategory:'encyclopedia',sourceType:'secondary',apiAvailable:true,supportedCapabilities:['orientation','citations','entity_discovery']}),
S('wikidata','Wikidata','wikidata.org','knowledge',86,{subcategory:'knowledge_graph',sourceType:'structured_knowledge',apiAvailable:true,license:'CC0',supportedCapabilities:['entities','relations','sparql']}),
S('internet_archive','Internet Archive','archive.org','knowledge',82,{subcategory:'archive',sourceType:'archive',apiAvailable:true}),
S('wayback','Wayback Machine','web.archive.org','knowledge',84,{subcategory:'web_archive',sourceType:'archive',apiAvailable:true}),
S('open_library','Open Library','openlibrary.org','knowledge',82,{subcategory:'library',apiAvailable:true}),
S('loc','Library of Congress','loc.gov','knowledge',97,{subcategory:'library',sourceType:'primary_catalog',officialSource:true,governmentSource:true,primarySource:true,apiAvailable:true,country:'US',freshnessProfile:'LOW'}),

S('crossref','Crossref','api.crossref.org','science',97,{subcategory:'doi_metadata',sourceType:'scholarly_metadata',academicSource:true,apiAvailable:true,apiEndpoint:'https://api.crossref.org/v1/works',freshnessProfile:'HIGH'}),
S('openalex','OpenAlex','api.openalex.org','science',95,{subcategory:'academic_graph',academicSource:true,apiAvailable:true,freshnessProfile:'HIGH'}),
S('datacite','DataCite','api.datacite.org','science',96,{subcategory:'doi_metadata',academicSource:true,apiAvailable:true,freshnessProfile:'HIGH'}),
S('semantic_scholar','Semantic Scholar','api.semanticscholar.org','science',90,{subcategory:'academic_graph',academicSource:true,apiAvailable:true,freshnessProfile:'HIGH'}),
S('arxiv','arXiv','export.arxiv.org','science',83,{subcategory:'preprints',sourceType:'preprint_repository',academicSource:true,primarySource:true,apiAvailable:true,freshnessProfile:'HIGH'}),
S('zenodo','Zenodo','zenodo.org','science',90,{subcategory:'repository',academicSource:true,apiAvailable:true,freshnessProfile:'HIGH'}),
S('orcid','ORCID','orcid.org','science',98,{subcategory:'research_identity',academicSource:true,primarySource:true,apiAvailable:true}),
S('ror','Research Organization Registry','ror.org','science',97,{subcategory:'institution_registry',academicSource:true,apiAvailable:true}),

S('pubmed','PubMed','pubmed.ncbi.nlm.nih.gov','medicine',99,{subcategory:'biomedical_index',governmentSource:true,officialSource:true,academicSource:true,apiAvailable:true,country:'US',freshnessProfile:'HIGH'}),
S('ncbi','NCBI','ncbi.nlm.nih.gov','medicine',99,{governmentSource:true,officialSource:true,primarySource:true,apiAvailable:true,country:'US',freshnessProfile:'HIGH'}),
S('who','World Health Organization','who.int','medicine',100,{sourceType:'intergovernmental_primary',officialSource:true,primarySource:true,freshnessProfile:'HIGH'}),
S('nih','National Institutes of Health','nih.gov','medicine',100,{governmentSource:true,officialSource:true,primarySource:true,country:'US',freshnessProfile:'HIGH'}),
S('cdc','CDC','cdc.gov','medicine',100,{governmentSource:true,officialSource:true,primarySource:true,country:'US',freshnessProfile:'HIGH'}),
S('fda','FDA','fda.gov','medicine',100,{governmentSource:true,officialSource:true,primarySource:true,country:'US',freshnessProfile:'HIGH'}),
S('ema','European Medicines Agency','ema.europa.eu','medicine',100,{officialSource:true,primarySource:true,jurisdiction:'EU',freshnessProfile:'HIGH'}),
S('clinicaltrials','ClinicalTrials.gov','clinicaltrials.gov','medicine',99,{governmentSource:true,officialSource:true,primarySource:true,apiAvailable:true,country:'US',freshnessProfile:'HIGH'}),

S('dof','Diario Oficial de la Federación','dof.gob.mx','law',100,{subcategory:'official_gazette',sourceType:'legal_primary',governmentSource:true,officialSource:true,primarySource:true,country:'MX',jurisdiction:'MX',freshnessProfile:'HIGH'}),
S('diputados','Cámara de Diputados','diputados.gob.mx','law',100,{subcategory:'legislation',sourceType:'legal_primary',governmentSource:true,officialSource:true,primarySource:true,country:'MX',jurisdiction:'MX',freshnessProfile:'HIGH'}),
S('senado','Senado de la República','senado.gob.mx','law',99,{subcategory:'legislation',sourceType:'legal_primary',governmentSource:true,officialSource:true,primarySource:true,country:'MX',jurisdiction:'MX',freshnessProfile:'HIGH'}),
S('scjn','Suprema Corte de Justicia de la Nación','scjn.gob.mx','law',100,{subcategory:'court',sourceType:'legal_primary',governmentSource:true,officialSource:true,primarySource:true,country:'MX',jurisdiction:'MX',freshnessProfile:'HIGH'}),
S('sjf','Semanario Judicial de la Federación','sjf2.scjn.gob.mx','law',100,{subcategory:'case_law',sourceType:'legal_primary',governmentSource:true,officialSource:true,primarySource:true,country:'MX',jurisdiction:'MX',freshnessProfile:'HIGH'}),
S('eurlex','EUR-Lex','eur-lex.europa.eu','law',100,{subcategory:'legislation',sourceType:'legal_primary',officialSource:true,primarySource:true,jurisdiction:'EU',freshnessProfile:'HIGH'}),
S('congress','Congress.gov','congress.gov','law',100,{subcategory:'legislation',sourceType:'legal_primary',governmentSource:true,officialSource:true,primarySource:true,country:'US',jurisdiction:'US',apiAvailable:true,freshnessProfile:'HIGH'}),
S('govinfo','GovInfo','govinfo.gov','law',100,{subcategory:'official_publications',governmentSource:true,officialSource:true,primarySource:true,country:'US',jurisdiction:'US',apiAvailable:true,freshnessProfile:'HIGH'}),

S('inegi','INEGI','inegi.org.mx','government_data',100,{subcategory:'statistics',governmentSource:true,officialSource:true,primarySource:true,country:'MX',freshnessProfile:'HIGH'}),
S('banxico','Banco de México','banxico.org.mx','finance',100,{subcategory:'central_bank',governmentSource:true,officialSource:true,primarySource:true,country:'MX',freshnessProfile:'REAL_TIME'}),
S('fred','FRED','fred.stlouisfed.org','finance',99,{subcategory:'economic_data',governmentSource:true,officialSource:true,primarySource:true,country:'US',apiAvailable:true,freshnessProfile:'HIGH'}),
S('sec_edgar','SEC EDGAR','sec.gov','finance',100,{subcategory:'corporate_filings',governmentSource:true,officialSource:true,primarySource:true,country:'US',freshnessProfile:'HIGH'}),
S('world_bank','World Bank','worldbank.org','government_data',99,{sourceType:'intergovernmental',officialSource:true,primarySource:true,apiAvailable:true}),
S('imf','International Monetary Fund','imf.org','government_data',99,{sourceType:'intergovernmental',officialSource:true,primarySource:true}),
S('oecd','OECD','oecd.org','government_data',99,{sourceType:'intergovernmental',officialSource:true,primarySource:true}),

S('github','GitHub','github.com','technology',91,{subcategory:'code_host',sourceType:'primary_software',primarySource:true,apiAvailable:true,freshnessProfile:'HIGH'}),
S('mdn','MDN Web Docs','developer.mozilla.org','technology',97,{subcategory:'documentation',sourceType:'technical_reference',freshnessProfile:'HIGH'}),
S('w3c','W3C','w3.org','technology',100,{subcategory:'standards',sourceType:'standards_primary',officialSource:true,primarySource:true}),
S('ietf','IETF','ietf.org','technology',100,{subcategory:'standards',sourceType:'standards_primary',officialSource:true,primarySource:true}),
S('rfc_editor','RFC Editor','rfc-editor.org','technology',100,{subcategory:'standards',sourceType:'standards_primary',officialSource:true,primarySource:true}),
S('openai_docs','OpenAI Documentation','platform.openai.com','ai',100,{subcategory:'official_docs',sourceType:'vendor_primary',officialSource:true,primarySource:true,freshnessProfile:'HIGH'}),
S('anthropic_docs','Anthropic Documentation','docs.anthropic.com','ai',100,{subcategory:'official_docs',sourceType:'vendor_primary',officialSource:true,primarySource:true,freshnessProfile:'HIGH'}),
S('huggingface','Hugging Face','huggingface.co','ai',88,{subcategory:'models',sourceType:'model_registry',primarySource:true,apiAvailable:true,freshnessProfile:'HIGH'}),

S('nvd','NVD','nvd.nist.gov','cybersecurity',99,{subcategory:'vulnerabilities',governmentSource:true,officialSource:true,primarySource:true,apiAvailable:true,country:'US',freshnessProfile:'HIGH'}),
S('cisa_kev','CISA Known Exploited Vulnerabilities','cisa.gov','cybersecurity',100,{subcategory:'exploited_vulnerabilities',governmentSource:true,officialSource:true,primarySource:true,country:'US',freshnessProfile:'HIGH'}),
S('mitre_attack','MITRE ATT&CK','attack.mitre.org','cybersecurity',98,{subcategory:'threat_knowledge',officialSource:true,primarySource:true,freshnessProfile:'HIGH'}),
S('owasp','OWASP','owasp.org','cybersecurity',97,{subcategory:'application_security',officialSource:true}),

S('reuters','Reuters','reuters.com','news',94,{subcategory:'wire',sourceType:'news',newsSource:true,rssAvailable:true,freshnessProfile:'REAL_TIME'}),
S('ap','Associated Press','apnews.com','news',94,{subcategory:'wire',sourceType:'news',newsSource:true,freshnessProfile:'REAL_TIME'}),
S('bbc','BBC','bbc.com','news',91,{subcategory:'public_media',sourceType:'news',newsSource:true,rssAvailable:true,freshnessProfile:'REAL_TIME'}),
S('reddit','Reddit','reddit.com','community',45,{subcategory:'forum',sourceType:'community_signal',communitySource:true,apiAvailable:true,freshnessProfile:'REAL_TIME'}),
S('stackoverflow','Stack Overflow','stackoverflow.com','community',68,{subcategory:'technical_qna',sourceType:'community_signal',communitySource:true,apiAvailable:true,freshnessProfile:'HIGH'})
];
const registry=new Map(BUILT_INS.map(item=>[item.id,item]));
export function registerSource(input,{replace=false}={}){const item=source(input||{});if(!item.id||!item.domain)throw new Error('source_id_and_domain_required');if(registry.has(item.id)&&!replace)throw new Error(`source_already_registered:${item.id}`);registry.set(item.id,item);return{...item,registryVersion:UNIVERSAL_SOURCE_REGISTRY_VERSION}}
export function upsertSource(input={}){return registerSource(input,{replace:true})}
export function removeSource(id=''){return registry.delete(String(id).toLowerCase())}
export function getSource(id=''){const item=registry.get(String(id).toLowerCase());return item?{...item,registryVersion:UNIVERSAL_SOURCE_REGISTRY_VERSION}:null}
export function listSources({category,activeOnly=false}={}){return[...registry.values()].filter(item=>(!category||item.category===category)&&(!activeOnly||item.lifecycle==='active')).map(item=>({...item,registryVersion:UNIVERSAL_SOURCE_REGISTRY_VERSION}))}
export function findSourceByUrl(value=''){try{const host=new URL(value).hostname.toLowerCase().replace(/^www\./,'');let best=null;for(const item of registry.values()){const d=item.domain.replace(/^www\./,'');if(host===d||host.endsWith(`.${d}`)){if(!best||d.length>best.domain.length)best=item}}return best?{...best,registryVersion:UNIVERSAL_SOURCE_REGISTRY_VERSION}:null}catch{return null}}
export function discoverSourceCandidateFromUrl(value=''){
  try{
    const url=new URL(value),host=url.hostname.toLowerCase().replace(/^www\./,'');
    const registered=findSourceByUrl(value);
    if(registered)return{...registered,discoveryStatus:'registered'};
    const government=/\.(gov|gob)(\.|$)/i.test(host)||/\.gov\.[a-z]{2}$/i.test(host);
    const academic=/\.edu(\.|$)/i.test(host)||/\.ac\.[a-z]{2}$/i.test(host);
    return source({
      id:`discovered_${host.replace(/[^a-z0-9]+/g,'_')}`,name:host,domain:host,category:government?'government_data':academic?'science':'discovered',
      sourceType:'discovered_web',authorityLevel:government||academic?'high':'unknown',reliabilityScore:government?82:academic?78:55,
      primarySource:false,officialSource:government,governmentSource:government,academicSource:academic,apiAvailable:false,
      freshnessProfile:'MEDIUM',healthStatus:'ephemeral_candidate',lifecycle:'ephemeral',supportedCapabilities:['web_evidence'],
      notes:'Discovered dynamically. Must be verified before permanent registry promotion.'
    });
  }catch{return null}
}
export function sourceRegistryHealth(){const rows=[...registry.values()];return{version:UNIVERSAL_SOURCE_REGISTRY_VERSION,generatedAt:now(),sourceCount:rows.length,activeCount:rows.filter(x=>x.lifecycle==='active').length,apiCount:rows.filter(x=>x.apiAvailable).length,primaryCount:rows.filter(x=>x.primarySource).length,categories:[...new Set(rows.map(x=>x.category))].sort()}}
