import {
  OpenAlexConnector,
  WikidataConnector,
  WikipediaConnector,
  PubMedConnector,
  ArxivConnector,
  OpenLibraryConnector,
  ZenodoConnector
} from './connectors-v1.js';
import { getKnowledgeSource } from './source-registry-v1.js';
import { normalizeLicenseMetadata, metadataOnlyLicense } from './license-registry-v1.js';
import { safeConnectorFetch } from './retrieval-security-v1.js';

const text=(value,max=4000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const arr=value=>Array.isArray(value)?value:[];
const stripDoi=value=>text(value,300).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:/i,'').toLowerCase();

function baselineLicense(sourceId,sourceRecordId,canonicalUrl){
  const source=getKnowledgeSource(sourceId);
  return normalizeLicenseMetadata({source:sourceId,sourceId:sourceRecordId,canonicalUrl,baseline:source?.license||metadataOnlyLicense(),provenance:{connector_version:'knowledge-connectors-live/v1'}});
}

async function jsonResponse(url,{fetchImpl=fetch,timeoutMs=6500}={}){
  const response=await safeConnectorFetch(url,{timeoutMs},fetchImpl);
  if(!response.ok)throw Object.assign(new Error(`knowledge_source_http_${response.status}`),{status:response.status});
  return response.json();
}

export class CrossrefLiveConnector {
  constructor({fetchImpl=fetch}={}){this.id='crossref';this.name='Crossref';this.fetchImpl=fetchImpl}
  async capabilities(){return{search:true,getRecord:false,fullText:false,citations:false,licenseMetadata:true,source:getKnowledgeSource(this.id)}}
  async getRecord(){return null}
  async getFullText(){return null}
  async getCitations(){return{nodes:[],edges:[]}}
  async getLicenseMetadata(id=''){return baselineLicense(this.id,id,'https://api.crossref.org/v1')}
  async healthCheck(){const started=Date.now();try{const rows=await this.search('machine learning',{limit:1});return{source_id:this.id,status:'healthy',latency_ms:Date.now()-started,result_count:rows.length,checked_at:new Date().toISOString()}}catch(error){return{source_id:this.id,status:Number(error?.status)===429?'rate_limited':'degraded',latency_ms:Date.now()-started,error:text(error?.message||error,180),checked_at:new Date().toISOString()}}}
  async search(query,{limit=6}={}){
    // Crossref recommends versioned REST URLs. We intentionally do not use `select` here:
    // update/retraction relationship fields vary by record/schema, and an invalid select member makes the entire request 400.
    // Abstracts may be copyright-protected, so this connector never copies item.abstract into the normalized record.
    const url=new URL('https://api.crossref.org/v1/works');
    url.searchParams.set('query.bibliographic',text(query,500));
    url.searchParams.set('rows',String(Math.max(1,Math.min(Number(limit)||6,10))));
    if(process.env.WAE_CONTACT_EMAIL)url.searchParams.set('mailto',process.env.WAE_CONTACT_EMAIL);
    const data=await jsonResponse(url,{fetchImpl:this.fetchImpl});
    return arr(data?.message?.items).map(item=>{
      const doi=stripDoi(item?.DOI);
      const canonical=item?.URL||`https://doi.org/${doi}`;
      const licenseUrl=arr(item?.license)[0]?.URL||'';
      const license=licenseUrl
        ?normalizeLicenseMetadata({source:this.id,sourceId:doi,canonicalUrl:canonical,license:licenseUrl,provenance:{field:'license',connector_version:'knowledge-connectors-live/v1'}})
        :baselineLicense(this.id,doi,canonical);
      const parts=item?.['published-print']?.['date-parts']||item?.['published-online']?.['date-parts']||item?.published?.['date-parts'];
      const p=arr(parts)[0]||[];
      const publicationDate=p.length?`${p[0]}-${String(p[1]||1).padStart(2,'0')}-${String(p[2]||1).padStart(2,'0')}`:undefined;
      const updates=arr(item?.['update-to']);
      const retractionStatus=updates.some(x=>/retract/i.test(`${x?.label||''} ${x?.type||''}`))?'possible_update_or_retraction':'unknown';
      return{
        id:`crossref:${doi||text(item?.URL,500)}`,
        type:/book/.test(item?.type||'')?'book':'paper',
        title:text(arr(item?.title)[0],800),
        abstract:undefined,
        authors:arr(item?.author).map(a=>({name:text([a?.given,a?.family].filter(Boolean).join(' '),300),orcid:text(a?.ORCID,300)||undefined,affiliations:arr(a?.affiliation).map(x=>text(x?.name,300)).filter(Boolean)})).filter(a=>a.name),
        publicationDate,
        language:item?.language||undefined,
        identifiers:{doi:doi||undefined,isbn:undefined,pmid:undefined,pmcid:undefined,arxiv:undefined,openalex:undefined,wikidata:undefined},
        topics:[...new Set(arr(item?.subject).map(x=>text(x,200)).filter(Boolean))].slice(0,20),
        source:{id:this.id,canonical_url:canonical,retrieved_at:new Date().toISOString(),connector_version:'knowledge-connectors-live/v1'},
        license,
        citations:[],
        quality:{source_authority:getKnowledgeSource(this.id)?.trust_score||0.96,peer_review_status:'unknown',publication_type:item?.type||'work',citation_count:Number(item?.['is-referenced-by-count']||0),publication_date:publicationDate||null,retraction_status:retractionStatus,author_identity:'partial',institution:null,primary_vs_secondary_source:'publisher_deposited_metadata',cross_source_confirmation:0,license_confidence:license.confidence||'policy'},
        provenance:{source:this.id,source_record_id:doi||text(item?.URL,500),canonical_url:canonical,retrieved_at:new Date().toISOString(),prompt_injection_detected:false},
        raw_metadata:{reference_count:Number(item?.['reference-count']||0),relation:item?.relation||null,updates}
      };
    }).filter(x=>x.title);
  }
}

export function createKnowledgeConnectors(options={}){
  const connectors=[
    new OpenAlexConnector(options),
    new CrossrefLiveConnector(options),
    new WikidataConnector(options),
    new WikipediaConnector(options),
    new PubMedConnector(options),
    new ArxivConnector(options),
    new OpenLibraryConnector(options),
    new ZenodoConnector(options)
  ];
  return new Map(connectors.map(connector=>[connector.id,connector]));
}
