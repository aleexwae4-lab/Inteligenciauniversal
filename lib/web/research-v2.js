import { findSourceByUrl, discoverSourceCandidateFromUrl, sourceRegistryHealth, listSources } from './source-registry-v1.js';
import { classifyResearchDomain, classifyFreshnessRequirement, deduplicateEvidence, scoreSourceAuthority, detectEvidenceContradictions } from './engines-v1.js';
import { searchWebProviders, providerConfiguration } from './providers-v1.js';
import { buildSpecialistQueries, specialistPack, WEB_SPECIALISTS_VERSION } from './specialists-v2.js';
import { retrieveWebDocument, directRetrievalHealth } from './direct-retrieval-v2.js';
import { persistWebEvidence, webEvidencePersistenceState } from './persistence-v2.js';
import { webSecurityHealth } from './security-v1.js';
import { searchKnowledge } from '../knowledge/fabric-v1.js';

export const UNIVERSAL_WEB_INTELLIGENCE_V2='universal-web-intelligence/v2.0.0';
const CACHE=new Map();
const METRICS={requests:0,cacheHits:0,totalLatencyMs:0,directAttempts:0,directSuccess:0,directFailures:0,pdfsParsed:0,structuredDocuments:0,persisted:0,contradictions:0,citationCoverageSum:0,sourceDiversitySum:0,knowledgeFederations:0};
const ttlMs={STATIC:86400000*30,LOW:86400000*7,MEDIUM:3600000*12,HIGH:900000,REAL_TIME:60000};
const clean=(v,max=4000)=>String(v??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
function sourceTier(record={}){
  const s=record.registrySource||{};
  if(s.primarySource&&s.officialSource)return 1;
  if(s.governmentSource)return 2;
  if(s.category==='law'&&s.officialSource)return 3;
  if(s.sourceType==='intergovernmental'||s.category==='government_data')return 4;
  if(s.academicSource)return 6;
  if(['technology','ai','cybersecurity'].includes(s.category)&&s.primarySource)return 7;
  if(s.category==='news')return 10;
  if(s.communitySource)return 12;
  return 11;
}
function cacheGet(key,requirement){const row=CACHE.get(key);return row&&Date.now()-row.at<(ttlMs[requirement]||3600000)?row.value:null}
function cacheSet(key,value){CACHE.set(key,{at:Date.now(),value});if(CACHE.size>250)CACHE.delete(CACHE.keys().next().value)}
function aggregateProviderStatus(batches=[]){
  const map=new Map();
  for(const batch of batches)for(const row of batch?.status||[]){
    const key=row.provider,prev=map.get(key)||{provider:key,status:'not_configured',count:0,queries:0,errors:[]};
    prev.count+=Number(row.count)||0;prev.queries+=1;
    if(row.status==='healthy'||(prev.status!=='healthy'&&row.status!=='not_configured'))prev.status=row.status;
    if(row.error)prev.errors.push(row.error);
    map.set(key,prev);
  }
  return[...map.values()].map(x=>({...x,errors:x.errors.slice(0,3)}));
}
function knowledgeEvidence(record={}){
  const url=record.source?.canonical_url||'';
  return{
    provider:`knowledge:${record.source?.id||'unknown'}`,title:clean(record.title,800),url,
    snippet:clean(record.abstract||record.title,5000),publishedAt:record.publicationDate||null,
    author:record.authors?.[0]?.name||null,publication:record.venue||record.source?.name||null,
    doi:record.identifiers?.doi||null,retrievedAt:record.source?.retrieved_at||new Date().toISOString(),
    knowledgeRecord:true,knowledgeQuality:record.quality||{},registrySource:findSourceByUrl(url)||discoverSourceCandidateFromUrl(url)
  };
}
function citationV2(record={},index=0){
  const d=record.document||{};
  const excerpt=clean(d.excerpt||record.snippet,1400);
  return{
    key:`W${index+1}`,url:d.finalUrl||record.url||'',title:d.title||record.title||'',author:d.author||record.author||null,
    publication:record.publication||record.registrySource?.name||null,publishedAt:d.publishedAt||record.publishedAt||null,
    retrievedAt:d.headers?new Date().toISOString():(record.retrievedAt||new Date().toISOString()),
    section:d.citation?.section||null,page:d.citation?.page||null,excerpt,
    doi:record.doi||null,jurisdiction:record.registrySource?.jurisdiction||null,contentHash:d.contentHash||null,
    sourceId:record.registrySource?.id||null,retrieval:{direct:d.finalUrl?true:false,kind:d.kind||null,ocrRequired:d.ocrRequired===true}
  };
}
function rank(records=[],freshnessRequirement='MEDIUM'){
  return records.map(item=>{
    const registrySource=item.registrySource||findSourceByUrl(item.url||'')||discoverSourceCandidateFromUrl(item.url||'');
    const next={...item,registrySource};
    const authority=scoreSourceAuthority(next,{corroborationCount:item.corroborationCount||1,freshnessRequirement});
    if(item.knowledgeQuality?.authority?.score)authority.trustScore=Number(clamp(Math.max(authority.trustScore,item.knowledgeQuality.authority.score*100)).toFixed(1));
    return{...next,authority,sourceTier:sourceTier(next)};
  }).sort((a,b)=>(a.sourceTier-b.sourceTier)||((b.authority?.trustScore||0)-(a.authority?.trustScore||0)));
}
async function directEnrich(records,query,options={}){
  const enabled=options.directRetrieval!==false&&String(process.env.WAE_WEB_DIRECT_RETRIEVAL||'1')!=='0';
  if(!enabled)return records;
  const limit=Math.max(0,Math.min(Number(options.directLimit)||4,8));
  const candidates=[];const seenHosts=new Set();
  for(const item of records){
    if(!/^https:\/\//i.test(item.url||'')||item.knowledgeRecord)continue;
    let host='';try{host=new URL(item.url).hostname.toLowerCase()}catch{continue}
    if(seenHosts.has(host))continue;
    seenHosts.add(host);candidates.push(item);
    if(candidates.length>=limit)break;
  }
  METRICS.directAttempts+=candidates.length;
  const settled=await Promise.allSettled(candidates.map(item=>retrieveWebDocument(item.url,{query,fetchImpl:options.fetchImpl||fetch,resolveHostImpl:options.resolveHostImpl,timeoutMs:options.directTimeoutMs||6500,respectRobots:options.respectRobots!==false,extractTables:options.extractPdfTables===true})));
  const byUrl=new Map();
  settled.forEach((r,i)=>{
    const item=candidates[i];
    if(r.status==='fulfilled'){
      METRICS.directSuccess+=1;if(r.value.kind==='pdf')METRICS.pdfsParsed+=1;if(r.value.structured&&Object.keys(r.value.structured).length)METRICS.structuredDocuments+=1;
      byUrl.set(item.url,r.value);
    }else{METRICS.directFailures+=1;byUrl.set(item.url,{error:clean(r.reason?.code||r.reason?.message||r.reason,180)})}
  });
  return records.map(item=>{
    const document=byUrl.get(item.url);if(!document)return item;
    if(document.error)return{...item,directRetrieval:{status:'degraded',error:document.error}};
    return{...item,document,directRetrieval:{status:'healthy',kind:document.kind,latencyMs:document.retrievalLatencyMs},title:document.title||item.title,snippet:document.excerpt||item.snippet,publishedAt:document.publishedAt||item.publishedAt,author:document.author||item.author};
  });
}
export async function retrieveUrlV2(url,options={}){
  const document=await retrieveWebDocument(url,options);
  const registrySource=findSourceByUrl(document.finalUrl)||discoverSourceCandidateFromUrl(document.finalUrl);
  const record={provider:'direct',url:document.finalUrl,title:document.title,snippet:document.excerpt,publishedAt:document.publishedAt,author:document.author,document,registrySource};
  const authority=scoreSourceAuthority(record,{freshnessRequirement:options.freshnessRequirement||'MEDIUM'});
  const item={...record,authority,sourceTier:sourceTier(record)};
  const persistence=options.persist===true?await persistWebEvidence(item):{persisted:false,reason:'not_requested'};
  return{version:UNIVERSAL_WEB_INTELLIGENCE_V2,item,citation:citationV2(item,0),persistence};
}
export async function researchWebV2(query,options={}){
  const started=Date.now(),q=clean(query,1500);METRICS.requests+=1;
  if(!q)throw Object.assign(new Error('web_query_required'),{status:400});
  const domain=options.domain||classifyResearchDomain(q),freshnessRequirement=options.freshnessRequirement||classifyFreshnessRequirement(q,domain);
  const queries=buildSpecialistQueries(q,domain),providerIds=Array.isArray(options.providers)?options.providers:undefined,limit=Math.max(3,Math.min(Number(options.limit)||14,30));
  const cacheKey=JSON.stringify([q.toLowerCase(),domain,freshnessRequirement,providerIds||'auto',limit,options.directRetrieval!==false]);
  if(options.cache!==false){const cached=cacheGet(cacheKey,freshnessRequirement);if(cached){METRICS.cacheHits+=1;return{...cached,requestId:options.requestId||crypto.randomUUID(),cacheHit:true,totalLatencyMs:Date.now()-started}}}
  const searchPromises=queries.map(searchQuery=>searchWebProviders(searchQuery,{providerIds,limit:Math.min(8,limit),fetchImpl:options.fetchImpl||fetch,timeoutMs:options.timeoutMs||9000}));
  const knowledgeEligible=options.includeKnowledge!==false&&['science','medicine'].includes(domain);
  const knowledgePromise=knowledgeEligible?searchKnowledge(q,{limit:Math.min(10,limit),perSource:4,fetchImpl:options.fetchImpl||fetch,indexFetchImpl:options.indexFetchImpl||fetch,includeGlobalIndex:options.includeGlobalIndex!==false}).catch(()=>null):Promise.resolve(null);
  const [searchBatches,knowledge]=await Promise.all([Promise.all(searchPromises),knowledgePromise]);
  if(knowledge)METRICS.knowledgeFederations+=1;
  const discovered=searchBatches.flatMap(x=>x.results||[]);
  if(knowledge?.records?.length)discovered.push(...knowledge.records.map(knowledgeEvidence));
  const deduped=deduplicateEvidence(discovered).map(item=>({...item,registrySource:item.registrySource||findSourceByUrl(item.url||'')||discoverSourceCandidateFromUrl(item.url||'')}));
  let ranked=rank(deduped,freshnessRequirement).slice(0,Math.max(limit,8));
  ranked=await directEnrich(ranked,q,options);
  ranked=rank(ranked,freshnessRequirement).slice(0,limit);
  const contradictions=detectEvidenceContradictions(ranked),citations=ranked.map(citationV2);
  const persistence=[];
  if(options.persist!==false&&String(process.env.WAE_WEB_PERSIST_EVIDENCE||'0')==='1'){
    const eligible=ranked.filter(x=>x.document?.finalUrl).slice(0,4);
    const persisted=await Promise.all(eligible.map(x=>persistWebEvidence(x).catch(error=>({persisted:false,reason:clean(error?.message||error,120)}))));
    persistence.push(...persisted);METRICS.persisted+=persisted.filter(x=>x.persisted).length;
  }
  const citationCoverage=ranked.length?citations.filter(x=>x.url&&x.excerpt).length/ranked.length:0;
  const sourceDiversity=new Set(ranked.map(x=>x.registrySource?.id||(()=>{try{return new URL(x.url).hostname}catch{return null}})()).filter(Boolean)).size;
  const result={
    version:UNIVERSAL_WEB_INTELLIGENCE_V2,requestId:options.requestId||crypto.randomUUID(),query:q,domain,freshnessRequirement,
    plan:{schema:'web-research-plan/v2',queries,domain,freshnessRequirement,specialist:specialistPack(domain),parallel:true,knowledgeFederation:knowledgeEligible},
    providers:aggregateProviderStatus(searchBatches),queriesExecuted:queries,knowledgeStatus:knowledge?{version:knowledge.version,documentsUsed:knowledge.documents_used,sourceStatus:knowledge.source_status}:null,
    discoveredCount:discovered.length,deduplicatedCount:deduped.length,evidence:ranked,citations,contradictions,persistence,
    sourceDiversity,citationCoverage,directRetrieval:{attempted:ranked.filter(x=>x.directRetrieval).length,succeeded:ranked.filter(x=>x.directRetrieval?.status==='healthy').length},
    researchLatencyMs:Date.now()-started,totalLatencyMs:Date.now()-started,cacheHit:false,generatedAt:new Date().toISOString()
  };
  METRICS.totalLatencyMs+=result.totalLatencyMs;METRICS.contradictions+=contradictions.length;METRICS.citationCoverageSum+=citationCoverage;METRICS.sourceDiversitySum+=sourceDiversity;
  cacheSet(cacheKey,{...result,requestId:null,persistence:[]});return result;
}
export function webIntelligenceMetricsV2(){
  const completed=Math.max(1,METRICS.requests-METRICS.cacheHits);
  return{version:UNIVERSAL_WEB_INTELLIGENCE_V2,...METRICS,cacheHitRate:METRICS.requests?Number((METRICS.cacheHits/METRICS.requests).toFixed(3)):0,averageLatencyMs:Number((METRICS.totalLatencyMs/completed).toFixed(1)),directSuccessRate:METRICS.directAttempts?Number((METRICS.directSuccess/METRICS.directAttempts).toFixed(3)):null,averageCitationCoverage:Number((METRICS.citationCoverageSum/completed).toFixed(3)),averageSourceDiversity:Number((METRICS.sourceDiversitySum/completed).toFixed(2)),hallucinationRate:'eval_derived',factualAccuracy:'eval_derived'};
}
export function webIntelligenceHealthV2(){
  return{version:UNIVERSAL_WEB_INTELLIGENCE_V2,status:'configured',registry:sourceRegistryHealth(),providers:providerConfiguration(),security:{legacy:webSecurityHealth(),direct:directRetrievalHealth()},specialists:{version:WEB_SPECIALISTS_VERSION,domains:['law','medicine','science','software','cybersecurity','finance','business']},persistence:webEvidencePersistenceState(),cacheEntries:CACHE.size,metrics:webIntelligenceMetricsV2(),capabilities:['parallel general+specialist discovery','scientific knowledge federation','direct robots-aware retrieval','HTML/JSON-LD/JSON/XML/RSS/Atom extraction','PDF page intelligence','optional PDF tables','authority/freshness ranking','deduplication','contradiction detection','page/section citations','governed evidence persistence']};
}
export function webSourceRegistryV2({category}={}){return{version:UNIVERSAL_WEB_INTELLIGENCE_V2,...sourceRegistryHealth(),sources:listSources({category})}}
