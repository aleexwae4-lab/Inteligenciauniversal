import { createKnowledgeConnectors as createBaseKnowledgeConnectors } from './connectors-live-v1.js';
import { getKnowledgeSource } from './source-registry-v1.js';
import { metadataOnlyLicense, normalizeLicenseMetadata } from './license-registry-v1.js';
import { safeConnectorFetch, sanitizeRetrievedText } from './retrieval-security-v1.js';

export const SCIENTIFIC_CONNECTORS_VERSION='knowledge-connectors-scientific/v2';
const text=(value,max=4000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const arr=value=>Array.isArray(value)?value:[];
const stripDoi=value=>text(value,300).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:/i,'').toLowerCase();

function europePmcLicense(item={}){
  const canonical=item.pmcid?`https://europepmc.org/article/PMC/${encodeURIComponent(item.pmcid)}`:item.pmid?`https://europepmc.org/article/MED/${encodeURIComponent(item.pmid)}`:'https://europepmc.org/';
  return normalizeLicenseMetadata({
    source:'europe_pmc',sourceId:item.pmcid||item.pmid||item.id||'',canonicalUrl:canonical,
    baseline:metadataOnlyLicense({license:'metadata-only; full-text rights vary by article',copyrightStatus:'mixed'}),
    provenance:{connector_version:SCIENTIFIC_CONNECTORS_VERSION,is_open_access:item.isOpenAccess===true||String(item.isOpenAccess).toLowerCase()==='y'}
  });
}

export class EuropePmcConnector {
  constructor({fetchImpl=fetch}={}){this.id='europe_pmc';this.name='Europe PMC';this.fetchImpl=fetchImpl}
  async capabilities(){return{search:true,getRecord:false,fullText:false,citations:false,licenseMetadata:true,source:getKnowledgeSource(this.id)}}
  async getRecord(){return null}
  async getFullText(){return null}
  async getCitations(){return{nodes:[],edges:[]}}
  async getLicenseMetadata(id=''){return normalizeLicenseMetadata({source:this.id,sourceId:id,canonicalUrl:'https://europepmc.org/',baseline:metadataOnlyLicense({license:'metadata-only; full-text rights vary by article',copyrightStatus:'mixed'}),provenance:{connector_version:SCIENTIFIC_CONNECTORS_VERSION}})}
  async healthCheck(){const started=Date.now();try{const rows=await this.search('hypertension',{limit:1});return{source_id:this.id,status:'healthy',latency_ms:Date.now()-started,result_count:rows.length,checked_at:new Date().toISOString()}}catch(error){return{source_id:this.id,status:Number(error?.status)===429?'rate_limited':'degraded',latency_ms:Date.now()-started,error:text(error?.message||error,180),checked_at:new Date().toISOString()}}}
  async search(query,{limit=6}={}){
    const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.searchParams.set('query',text(query,500));
    url.searchParams.set('format','json');
    url.searchParams.set('pageSize',String(Math.max(1,Math.min(Number(limit)||6,10))));
    url.searchParams.set('resultType','core');
    const response=await safeConnectorFetch(url,{timeoutMs:7500},this.fetchImpl);
    if(!response.ok)throw Object.assign(new Error(`knowledge_source_http_${response.status}`),{status:response.status});
    const data=await response.json();
    return arr(data?.resultList?.result).map(item=>{
      const pmid=text(item.pmid||((String(item.source).toUpperCase()==='MED')?item.id:''),100)||undefined;
      const pmcid=text(item.pmcid,100)||undefined;
      const doi=stripDoi(item.doi)||undefined;
      const canonical=pmcid?`https://europepmc.org/article/PMC/${encodeURIComponent(pmcid)}`:pmid?`https://europepmc.org/article/MED/${encodeURIComponent(pmid)}`:doi?`https://doi.org/${doi}`:'https://europepmc.org/';
      const rawAbstract=text(item.abstractText||'',4000);const safeAbstract=sanitizeRetrievedText(rawAbstract,4000);
      const pubTypes=[...new Set([text(item.pubType,200),...arr(item.pubTypeList?.pubType).map(x=>text(x,200))].filter(Boolean))];
      const license=europePmcLicense(item);
      const authors=arr(item.authorList?.author).map(a=>({name:text(a?.fullName||[a?.firstName,a?.lastName].filter(Boolean).join(' '),300),orcid:text(a?.authorId?.type==='ORCID'?a?.authorId?.value:'',300)||undefined,affiliations:[]})).filter(a=>a.name);
      if(!authors.length&&item.authorString)authors.push(...String(item.authorString).split(/,|;/).slice(0,20).map(name=>({name:text(name,300)})).filter(a=>a.name));
      const retractionSignal=pubTypes.some(type=>/retract/i.test(type));
      return{
        id:`europe_pmc:${pmcid||pmid||doi||text(item.id,300)}`,
        type:'paper',title:text(item.title,800),abstract:safeAbstract.text||undefined,authors,
        publicationDate:text(item.firstPublicationDate||item.dateOfPublication||item.pubYear,60)||undefined,
        language:text(item.language,30)||undefined,
        identifiers:{doi,pmid,pmcid,arxiv:undefined,isbn:undefined,openalex:undefined,wikidata:undefined},
        topics:[],
        source:{id:this.id,canonical_url:canonical,retrieved_at:new Date().toISOString(),connector_version:SCIENTIFIC_CONNECTORS_VERSION},
        license,citations:[],
        quality:{source_authority:getKnowledgeSource(this.id)?.trust_score||0.97,peer_review_status:'unknown',publication_type:pubTypes[0]||'research_article',citation_count:Number(item.citedByCount||0),publication_date:item.firstPublicationDate||item.pubYear||null,retraction_status:retractionSignal?'retracted_or_retraction_notice':'unknown',author_identity:'partial',institution:null,primary_vs_secondary_source:'bibliographic_index',cross_source_confirmation:0,license_confidence:license.confidence||'policy'},
        provenance:{source:this.id,source_record_id:pmcid||pmid||doi||text(item.id,300),canonical_url:canonical,retrieved_at:new Date().toISOString(),prompt_injection_detected:safeAbstract.injection_detected===true},
        raw_metadata:{source:item.source||null,pubtype:pubTypes,is_open_access:item.isOpenAccess??null,in_epmc:item.inEPMC??null,has_references:item.hasReferences??null,journal:item.journalTitle||null}
      };
    }).filter(record=>record.title);
  }
}

export function createKnowledgeConnectors(options={}){
  const base=createBaseKnowledgeConnectors(options);
  const europePmc=new EuropePmcConnector(options);
  base.set(europePmc.id,europePmc);
  return base;
}
