import { getKnowledgeSource } from './source-registry-v1.js';
import { normalizeLicenseMetadata, metadataOnlyLicense, classifyLicense } from './license-registry-v1.js';
import { safeConnectorFetch, sanitizeRetrievedText } from './retrieval-security-v1.js';

export const KNOWLEDGE_CONNECTORS_VERSION='knowledge-connectors/v1';
const text=(value,max=4000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const arr=value=>Array.isArray(value)?value:[];
const iso=value=>{if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString()};
const stripDoi=value=>text(value,300).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:/i,'').toLowerCase();
const escapeXml=value=>String(value||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const xmlTag=(block,tag)=>{const m=String(block).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'));return m?escapeXml(m[1].replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim():''};
const xmlTags=(block,tag)=>[...String(block).matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'gi'))].map(m=>escapeXml(m[1].replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()).filter(Boolean);

function baseLicense(source,sourceId,url,override){
  const def=getKnowledgeSource(source);
  return normalizeLicenseMetadata({source,sourceId,canonicalUrl:url,baseline:override||def?.license||metadataOnlyLicense(),provenance:{connector_version:KNOWLEDGE_CONNECTORS_VERSION}});
}

function record({id,type='paper',title,abstract,authors=[],publicationDate,language,identifiers={},topics=[],sourceId,canonicalUrl,license,quality={},citations=[],raw={}}){
  const clean=sanitizeRetrievedText(abstract||'',4000);
  return{
    id:`${sourceId}:${text(id,500)}`,type,title:text(title,800),abstract:clean.text||undefined,authors:arr(authors).map(a=>typeof a==='string'?{name:text(a,300)}:{name:text(a?.name,300),orcid:text(a?.orcid,300)||undefined,id:text(a?.id,300)||undefined,affiliations:arr(a?.affiliations).map(x=>text(x,300)).filter(Boolean)}).filter(a=>a.name),
    publicationDate:publicationDate||undefined,language:language||undefined,
    identifiers:{doi:identifiers.doi?stripDoi(identifiers.doi):undefined,isbn:identifiers.isbn||undefined,pmid:identifiers.pmid||undefined,pmcid:identifiers.pmcid||undefined,arxiv:identifiers.arxiv||undefined,openalex:identifiers.openalex||undefined,wikidata:identifiers.wikidata||undefined},
    topics:[...new Set(arr(topics).map(x=>text(x,200)).filter(Boolean))].slice(0,20),
    source:{id:sourceId,canonical_url:canonicalUrl,retrieved_at:new Date().toISOString(),connector_version:KNOWLEDGE_CONNECTORS_VERSION},
    license:license||baseLicense(sourceId,id,canonicalUrl),citations:arr(citations),
    quality:{source_authority:getKnowledgeSource(sourceId)?.trust_score||0,peer_review_status:'unknown',publication_type:type,citation_count:null,publication_date:publicationDate||null,retraction_status:'unknown',author_identity:'partial',institution:null,primary_vs_secondary_source:'unknown',cross_source_confirmation:0,license_confidence:(license||{}).confidence||'policy',...quality},
    provenance:{source:sourceId,source_record_id:text(id,500),canonical_url:canonicalUrl,retrieved_at:new Date().toISOString(),prompt_injection_detected:clean.injection_detected===true},
    raw_metadata:raw
  };
}

async function jsonResponse(url,{fetchImpl=fetch,headers={},timeoutMs=5500}={}){
  const res=await safeConnectorFetch(url,{headers,timeoutMs},fetchImpl);
  if(!res.ok)throw Object.assign(new Error(`knowledge_source_http_${res.status}`),{status:res.status});
  return res.json();
}
async function textResponse(url,{fetchImpl=fetch,headers={},timeoutMs=5500}={}){
  const res=await safeConnectorFetch(url,{headers,timeoutMs},fetchImpl);
  if(!res.ok)throw Object.assign(new Error(`knowledge_source_http_${res.status}`),{status:res.status});
  return res.text();
}

class BaseConnector {
  constructor(id,{fetchImpl=fetch}={}){this.id=id;this.name=getKnowledgeSource(id)?.name||id;this.fetchImpl=fetchImpl}
  async capabilities(){const s=getKnowledgeSource(this.id);return{search:true,getRecord:false,fullText:false,citations:false,licenseMetadata:true,source:s}}
  async getRecord(){return null}
  async getFullText(){return null}
  async getCitations(){return{nodes:[],edges:[]}}
  async getLicenseMetadata(id=''){return baseLicense(this.id,id,getKnowledgeSource(this.id)?.base_url||'')}
  async healthCheck(){const started=Date.now();try{const rows=await this.search('test',{limit:1,healthProbe:true});return{source_id:this.id,status:'healthy',latency_ms:Date.now()-started,result_count:rows.length,checked_at:new Date().toISOString()}}catch(error){const status=Number(error?.status)===429?'rate_limited':'degraded';return{source_id:this.id,status,latency_ms:Date.now()-started,error:text(error?.message||error,180),checked_at:new Date().toISOString()}}}
}

export class OpenAlexConnector extends BaseConnector {
  constructor(options={}){super('openalex',options)}
  async search(query,{limit=6}={}){
    const url=new URL('https://api.openalex.org/works');url.searchParams.set('search',text(query,500));url.searchParams.set('per-page',String(Math.max(1,Math.min(Number(limit)||6,10))));
    if(process.env.WAE_CONTACT_EMAIL)url.searchParams.set('mailto',process.env.WAE_CONTACT_EMAIL);
    const data=await jsonResponse(url,{fetchImpl:this.fetchImpl});
    return arr(data?.results).map(work=>{
      const primary=work?.primary_location||{};const sourceUrl=work?.doi||primary?.landing_page_url||work?.id||'';const locationLicense=primary?.license||null;
      const lic=locationLicense?normalizeLicenseMetadata({source:this.id,sourceId:work?.id,canonicalUrl:sourceUrl,license:locationLicense,provenance:{field:'primary_location.license'}}):baseLicense(this.id,work?.id,sourceUrl);
      return record({id:work?.id||work?.doi,type:work?.type==='book'?'book':'paper',title:work?.display_name||work?.title,authors:arr(work?.authorships).map(a=>({name:a?.author?.display_name,id:a?.author?.id,orcid:a?.author?.orcid,affiliations:arr(a?.institutions).map(i=>i?.display_name)})),publicationDate:work?.publication_date||String(work?.publication_year||''),language:work?.language,identifiers:{doi:work?.doi,openalex:work?.id},topics:arr(work?.topics).map(t=>t?.display_name).concat(arr(work?.concepts).map(c=>c?.display_name)),sourceId:this.id,canonicalUrl:sourceUrl,license:lic,quality:{citation_count:Number(work?.cited_by_count||0),publication_type:work?.type||'work',primary_vs_secondary_source:'index_metadata'},raw:{open_access:work?.open_access||null,type:work?.type||null}});
    }).filter(x=>x.title);
  }
}

export class CrossrefConnector extends BaseConnector {
  constructor(options={}){super('crossref',options)}
  async search(query,{limit=6}={}){
    const url=new URL('https://api.crossref.org/works');url.searchParams.set('query.bibliographic',text(query,500));url.searchParams.set('rows',String(Math.max(1,Math.min(Number(limit)||6,10))));url.searchParams.set('select','DOI,title,author,published,published-print,published-online,type,URL,license,reference-count,is-referenced-by-count,subject,language,relation,update-to');if(process.env.WAE_CONTACT_EMAIL)url.searchParams.set('mailto',process.env.WAE_CONTACT_EMAIL);
    const data=await jsonResponse(url,{fetchImpl:this.fetchImpl});
    return arr(data?.message?.items).map(item=>{
      const doi=stripDoi(item?.DOI);const urlValue=item?.URL||`https://doi.org/${doi}`;const licenseUrl=arr(item?.license)[0]?.URL||'';
      const lic=licenseUrl?normalizeLicenseMetadata({source:this.id,sourceId:doi,canonicalUrl:urlValue,license:licenseUrl,provenance:{field:'license'}}):baseLicense(this.id,doi,urlValue);
      const parts=item?.['published-print']?.['date-parts']||item?.['published-online']?.['date-parts']||item?.published?.['date-parts'];const p=arr(parts)[0]||[];const pub=p.length?`${p[0]}-${String(p[1]||1).padStart(2,'0')}-${String(p[2]||1).padStart(2,'0')}`:null;
      return record({id:doi||item?.URL,type:/book/.test(item?.type||'')?'book':'paper',title:arr(item?.title)[0],authors:arr(item?.author).map(a=>({name:[a?.given,a?.family].filter(Boolean).join(' '),orcid:a?.ORCID,affiliations:arr(a?.affiliation).map(x=>x?.name)})),publicationDate:pub,language:item?.language,identifiers:{doi},topics:item?.subject,sourceId:this.id,canonicalUrl:urlValue,license:lic,quality:{citation_count:Number(item?.['is-referenced-by-count']||0),publication_type:item?.type||'work',retraction_status:arr(item?.['update-to']).some(x=>/retract/i.test(x?.label||x?.type||''))?'possible_update_or_retraction':'unknown',primary_vs_secondary_source:'publisher_deposited_metadata'},citations:[],raw:{reference_count:Number(item?.['reference-count']||0),relation:item?.relation||null,updates:item?.['update-to']||[]}});
    }).filter(x=>x.title);
  }
}

export class WikidataConnector extends BaseConnector {
  constructor(options={}){super('wikidata',options)}
  async search(query,{limit=6,language='en'}={}){
    const lang=/^es/i.test(language)?'es':'en';const url=new URL('https://www.wikidata.org/w/api.php');url.searchParams.set('action','wbsearchentities');url.searchParams.set('search',text(query,500));url.searchParams.set('language',lang);url.searchParams.set('uselang',lang);url.searchParams.set('limit',String(Math.max(1,Math.min(Number(limit)||6,10))));url.searchParams.set('format','json');url.searchParams.set('origin','*');
    const data=await jsonResponse(url,{fetchImpl:this.fetchImpl});
    return arr(data?.search).map(item=>record({id:item?.id,type:'web_document',title:item?.label||item?.id,abstract:item?.description,authors:[],identifiers:{wikidata:item?.id},topics:[],sourceId:this.id,canonicalUrl:item?.concepturi||`https://www.wikidata.org/wiki/${item?.id}`,license:normalizeLicenseMetadata({source:this.id,sourceId:item?.id,canonicalUrl:item?.concepturi,license:'cc0',provenance:{source_policy:'Wikidata structured data'}}),quality:{publication_type:'knowledge_entity',primary_vs_secondary_source:'structured_knowledge'},raw:{match:item?.match||null,aliases:item?.aliases||[]}}));
  }
}

export class WikipediaConnector extends BaseConnector {
  constructor(options={}){super('wikipedia',options)}
  async search(query,{limit=5,language='en'}={}){
    const lang=/^es/i.test(language)?'es':'en';const host=`${lang}.wikipedia.org`;const url=new URL(`https://${host}/w/api.php`);url.searchParams.set('action','query');url.searchParams.set('generator','search');url.searchParams.set('gsrsearch',text(query,500));url.searchParams.set('gsrlimit',String(Math.max(1,Math.min(Number(limit)||5,8))));url.searchParams.set('prop','extracts|info');url.searchParams.set('exintro','1');url.searchParams.set('explaintext','1');url.searchParams.set('inprop','url');url.searchParams.set('format','json');url.searchParams.set('origin','*');
    const data=await jsonResponse(url,{fetchImpl:this.fetchImpl});
    return Object.values(data?.query?.pages||{}).map(page=>record({id:page?.pageid,type:'encyclopedia_entry',title:page?.title,abstract:page?.extract,authors:[],language:lang,sourceId:this.id,canonicalUrl:page?.fullurl||`https://${host}/?curid=${page?.pageid}`,license:normalizeLicenseMetadata({source:this.id,sourceId:page?.pageid,canonicalUrl:page?.fullurl,license:'cc-by-sa',provenance:{use:'transient_excerpt'}}),quality:{publication_type:'encyclopedia_entry',primary_vs_secondary_source:'secondary'},raw:{pageid:page?.pageid}}));
  }
}

export class PubMedConnector extends BaseConnector {
  constructor(options={}){super('pubmed',options)}
  async search(query,{limit=6}={}){
    const max=Math.max(1,Math.min(Number(limit)||6,10));const email=process.env.WAE_CONTACT_EMAIL||'';
    const s=new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');s.searchParams.set('db','pubmed');s.searchParams.set('term',text(query,500));s.searchParams.set('retmax',String(max));s.searchParams.set('retmode','json');s.searchParams.set('tool','WAEUniversalCore');if(email)s.searchParams.set('email',email);if(process.env.NCBI_API_KEY)s.searchParams.set('api_key',process.env.NCBI_API_KEY);
    const found=await jsonResponse(s,{fetchImpl:this.fetchImpl});const ids=arr(found?.esearchresult?.idlist).slice(0,max);if(!ids.length)return[];
    const u=new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');u.searchParams.set('db','pubmed');u.searchParams.set('id',ids.join(','));u.searchParams.set('retmode','json');u.searchParams.set('tool','WAEUniversalCore');if(email)u.searchParams.set('email',email);if(process.env.NCBI_API_KEY)u.searchParams.set('api_key',process.env.NCBI_API_KEY);
    const data=await jsonResponse(u,{fetchImpl:this.fetchImpl});
    return ids.map(id=>{const item=data?.result?.[id];if(!item)return null;const articleIds=Object.fromEntries(arr(item?.articleids).map(x=>[String(x?.idtype||'').toLowerCase(),x?.value]));const doi=articleIds.doi||'';const canonical=`https://pubmed.ncbi.nlm.nih.gov/${id}/`;return record({id,type:'paper',title:item?.title,authors:arr(item?.authors).map(a=>a?.name),publicationDate:item?.pubdate||item?.sortpubdate,identifiers:{pmid:id,pmcid:articleIds.pmc,doi},topics:arr(item?.attributes),sourceId:this.id,canonicalUrl:canonical,license:baseLicense(this.id,id,canonical),quality:{publication_type:arr(item?.pubtype)[0]||'paper',primary_vs_secondary_source:'bibliographic_index',retraction_status:arr(item?.pubtype).some(x=>/retract/i.test(x))?'retracted_or_retraction_notice':'unknown'},raw:{pubtype:item?.pubtype||[],source:item?.source||null,articleids:item?.articleids||[]}})}).filter(Boolean);
  }
}

export class ArxivConnector extends BaseConnector {
  constructor(options={}){super('arxiv',options)}
  async search(query,{limit=6}={}){
    const url=new URL('https://export.arxiv.org/api/query');url.searchParams.set('search_query',`all:${text(query,300)}`);url.searchParams.set('start','0');url.searchParams.set('max_results',String(Math.max(1,Math.min(Number(limit)||6,8))));url.searchParams.set('sortBy','relevance');
    const xml=await textResponse(url,{fetchImpl:this.fetchImpl,headers:{Accept:'application/atom+xml'},timeoutMs:8000});const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(m=>m[1]);
    return entries.map(block=>{const idUrl=xmlTag(block,'id');const arxiv=(idUrl.match(/\/abs\/([^?#]+)/)||[])[1]||idUrl.split('/').pop();const title=xmlTag(block,'title');const summary=xmlTag(block,'summary');const authors=[...block.matchAll(/<author>([\s\S]*?)<\/author>/gi)].map(m=>xmlTag(m[1],'name'));const categories=[...block.matchAll(/<category[^>]+term=["']([^"']+)["']/gi)].map(m=>m[1]);return record({id:arxiv,type:'paper',title,abstract:summary,authors,publicationDate:xmlTag(block,'published'),identifiers:{arxiv},topics:categories,sourceId:this.id,canonicalUrl:idUrl||`https://arxiv.org/abs/${arxiv}`,license:baseLicense(this.id,arxiv,idUrl),quality:{publication_type:'preprint',peer_review_status:'preprint',primary_vs_secondary_source:'primary_preprint'},raw:{updated:xmlTag(block,'updated'),categories}})}).filter(x=>x.title);
  }
}

export class OpenLibraryConnector extends BaseConnector {
  constructor(options={}){super('open_library',options)}
  async search(query,{limit=6}={}){
    const url=new URL('https://openlibrary.org/search.json');url.searchParams.set('q',text(query,400));url.searchParams.set('limit',String(Math.max(1,Math.min(Number(limit)||6,8))));url.searchParams.set('fields','key,title,author_name,first_publish_year,subject,language,isbn,edition_count');
    const headers={};if(process.env.WAE_CONTACT_EMAIL)headers['User-Agent']=`WAEUniversalCore (${process.env.WAE_CONTACT_EMAIL})`;
    const data=await jsonResponse(url,{fetchImpl:this.fetchImpl,headers,timeoutMs:5000});
    return arr(data?.docs).map(item=>{const key=item?.key||'';const canonical=key?`https://openlibrary.org${key}`:'https://openlibrary.org';return record({id:key||item?.title,type:'book',title:item?.title,authors:item?.author_name,publicationDate:item?.first_publish_year?String(item.first_publish_year):null,language:arr(item?.language)[0],identifiers:{isbn:arr(item?.isbn)[0]},topics:item?.subject,sourceId:this.id,canonicalUrl:canonical,license:baseLicense(this.id,key,canonical),quality:{publication_type:'book_metadata',primary_vs_secondary_source:'library_catalog'},raw:{edition_count:item?.edition_count||null,isbn_count:arr(item?.isbn).length}})}).filter(x=>x.title);
  }
}

export class ZenodoConnector extends BaseConnector {
  constructor(options={}){super('zenodo',options)}
  async search(query,{limit=6}={}){
    const url=new URL('https://zenodo.org/api/records');url.searchParams.set('q',text(query,400));url.searchParams.set('size',String(Math.max(1,Math.min(Number(limit)||6,10))));url.searchParams.set('sort','bestmatch');
    const data=await jsonResponse(url,{fetchImpl:this.fetchImpl,timeoutMs:6500});
    return arr(data?.hits?.hits).map(item=>{const m=item?.metadata||{};const canonical=item?.links?.html||`https://zenodo.org/records/${item?.id}`;const rawLicense=m?.license?.id||m?.license?.title||'';const lic=rawLicense?normalizeLicenseMetadata({source:this.id,sourceId:item?.id,canonicalUrl:canonical,license:rawLicense,provenance:{field:'metadata.license'}}):baseLicense(this.id,item?.id,canonical);return record({id:item?.id,type:m?.resource_type?.type==='dataset'?'dataset':(m?.resource_type?.type==='software'?'software':'paper'),title:m?.title,abstract:m?.description,authors:arr(m?.creators).map(a=>({name:a?.name,orcid:a?.orcid,affiliations:a?.affiliation?[a.affiliation]:[]})),publicationDate:m?.publication_date||item?.created,language:m?.language,identifiers:{doi:m?.doi||item?.doi},topics:arr(m?.keywords),sourceId:this.id,canonicalUrl:canonical,license:lic,quality:{publication_type:m?.resource_type?.type||'repository_record',primary_vs_secondary_source:'repository_record'},raw:{access_right:m?.access_right||null,version:m?.version||null,communities:m?.communities||[]}})}).filter(x=>x.title);
  }
}

export function createKnowledgeConnectors(options={}){
  const connectors=[new OpenAlexConnector(options),new CrossrefConnector(options),new WikidataConnector(options),new WikipediaConnector(options),new PubMedConnector(options),new ArxivConnector(options),new OpenLibraryConnector(options),new ZenodoConnector(options)];
  return new Map(connectors.map(connector=>[connector.id,connector]));
}

export function connectorCapabilities(){return[...createKnowledgeConnectors().values()].map(c=>({id:c.id,name:c.name,search:true,get_record:false,full_text:false,citations:false,license_metadata:true}))}
