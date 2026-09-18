import { createHash } from 'node:crypto';
import { parseHtmlDocument, parseJsonDocument, parseXmlDocument, parseTextDocument } from './structured-data-v2.js';
import { parsePdfBuffer } from './pdf-intelligence-v2.js';
import { safeWebFetchV2, readLimitedBody, responseSecurityMetadata } from './security-v2.js';

export const DIRECT_RETRIEVAL_VERSION='direct-retrieval/v2.0.0';
const ROBOTS_CACHE=new Map();
const clean=(v,max=180000)=>String(v??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const bytesToText=bytes=>new TextDecoder('utf-8',{fatal:false}).decode(bytes);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function parseRobotsGroups(raw=''){
  const groups=[];let current={agents:[],rules:[],crawlDelay:null};
  const flush=()=>{if(current.agents.length||current.rules.length){groups.push(current);current={agents:[],rules:[],crawlDelay:null}}};
  for(const rawLine of String(raw||'').split(/\r?\n/)){
    const line=rawLine.replace(/#.*$/,'').trim();if(!line)continue;
    const i=line.indexOf(':');if(i<0)continue;
    const key=line.slice(0,i).trim().toLowerCase(),value=line.slice(i+1).trim();
    if(key==='user-agent'){
      if(current.rules.length)flush();
      current.agents.push(value.toLowerCase());
    }else if(key==='allow'||key==='disallow'){
      current.rules.push({type:key,path:value});
    }else if(key==='crawl-delay'){
      const n=Number(value);if(Number.isFinite(n))current.crawlDelay=n;
    }
  }
  flush();return groups;
}
export function evaluateRobots(raw='',targetUrl='',userAgent='wae-universal-web-intelligence'){
  const url=new URL(targetUrl),path=`${url.pathname||'/'}${url.search||''}`;
  const groups=parseRobotsGroups(raw);
  const exact=groups.filter(g=>g.agents.some(a=>userAgent.toLowerCase().includes(a)||a===userAgent.toLowerCase()));
  const candidates=exact.length?exact:groups.filter(g=>g.agents.includes('*'));
  if(!candidates.length)return{allowed:true,matchedRule:null,crawlDelayMs:null};
  const robotsMatch=(rulePath,target)=>{
    if(!rulePath)return false;
    const anchored=rulePath.endsWith('
  const delay=candidates.map(g=>g.crawlDelay).filter(Number.isFinite).sort((a,b)=>b-a)[0];
  return{allowed:!top||top.type==='allow',matchedRule:top,crawlDelayMs:Number.isFinite(delay)?Math.min(60000,Math.max(0,delay*1000)):null};
}
async function robotsPolicy(targetUrl,{fetchImpl=fetch,resolveHostImpl,timeoutMs=2500}={}){
  const url=new URL(targetUrl);const key=url.origin;
  const cached=ROBOTS_CACHE.get(key);if(cached&&Date.now()-cached.at<30*60*1000)return cached.value;
  const robotsUrl=new URL('/robots.txt',url).toString();
  try{
    const {response}=await safeWebFetchV2(robotsUrl,{fetchImpl,resolveHostImpl,timeoutMs,maxRedirects:1,enforceHttps:true,accept:'text/plain'});
    if(response.status===404){const value={allowed:true,status:'not_found',crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value}
    if(!response.ok){const value={allowed:true,status:`http_${response.status}`,crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value}
    const bytes=await readLimitedBody(response,256000);const raw=bytesToText(bytes);
    const evald=evaluateRobots(raw,targetUrl);
    const value={...evald,status:'parsed',hash:createHash('sha256').update(raw).digest('hex')};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value;
  }catch(error){
    const value={allowed:true,status:'unavailable',error:String(error?.code||error?.message||error).slice(0,120),crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value;
  }
}
function relevantExcerpt(text='',query='',max=2800){
  const body=clean(text,180000);if(!body)return'';
  const terms=[...new Set(clean(query,1200).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2))].slice(0,20);
  if(!terms.length)return body.slice(0,max);
  const lower=body.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let best=-1;for(const t of terms){const i=lower.indexOf(t);if(i>=0&&(best<0||i<best))best=i}
  if(best<0)return body.slice(0,max);
  const start=Math.max(0,best-Math.floor(max*.25));return body.slice(start,start+max);
}
function typeOf(contentType='',bytes){
  const ct=String(contentType||'').toLowerCase();
  if(ct.includes('pdf')||(bytes?.[0]===0x25&&bytes?.[1]===0x50&&bytes?.[2]===0x44&&bytes?.[3]===0x46))return'pdf';
  if(ct.includes('json'))return'json';
  if(ct.includes('rss')||ct.includes('atom')||ct.includes('xml'))return'xml';
  if(ct.includes('html')||ct.includes('xhtml')||!ct)return'html';
  if(ct.startsWith('text/'))return'text';
  return'unsupported';
}
export async function retrieveWebDocument(url,{query='',fetchImpl=fetch,resolveHostImpl,timeoutMs=6500,maxHtmlBytes=2_500_000,maxPdfBytes=14_000_000,respectRobots=true,extractTables=false}={}){
  const started=Date.now(),policy=respectRobots?await robotsPolicy(url,{fetchImpl,resolveHostImpl,timeoutMs:Math.min(timeoutMs,2500)}):{allowed:true,status:'disabled'};
  if(policy.allowed===false)throw Object.assign(new Error('robots_disallowed'),{code:'ROBOTS_DISALLOWED',policy});
  const {response,finalUrl,redirects}=await safeWebFetchV2(url,{fetchImpl,resolveHostImpl,timeoutMs,maxRedirects:3,enforceHttps:true});
  if(!response.ok)throw Object.assign(new Error(`web_http_${response.status}`),{code:'WEB_HTTP_ERROR',status:response.status});
  const meta=responseSecurityMetadata(response),kindHint=String(meta.contentType||'').toLowerCase().includes('pdf')?'pdf':'other';
  const bytes=await readLimitedBody(response,kindHint==='pdf'?maxPdfBytes:maxHtmlBytes);
  const kind=typeOf(meta.contentType,bytes);
  if(kind==='unsupported')throw Object.assign(new Error(`unsupported_content_type:${meta.contentType||'unknown'}`),{code:'WEB_CONTENT_TYPE_UNSUPPORTED'});
  let parsed;
  if(kind==='pdf')parsed=await parsePdfBuffer(bytes,{query,extractTables,maxPages:80});
  else{
    const raw=bytesToText(bytes);
    if(kind==='json')parsed=parseJsonDocument(raw,finalUrl);
    else if(kind==='xml')parsed=parseXmlDocument(raw,finalUrl);
    else if(kind==='text')parsed=parseTextDocument(raw,finalUrl);
    else parsed=parseHtmlDocument(raw,finalUrl);
  }
  const text=clean(parsed.text,180000),excerpt=relevantExcerpt(text,query,3200);
  const relevantPage=kind==='pdf'&&Array.isArray(parsed.pages)&&parsed.pages.length?parsed.pages[0]:null;
  return{
    version:DIRECT_RETRIEVAL_VERSION,url:String(url),finalUrl,redirects,httpStatus:response.status,contentType:meta.contentType||'',contentHash:hash(bytes),bytes:bytes.byteLength,
    title:parsed.title||'',description:parsed.description||'',author:parsed.author||null,publishedAt:parsed.publishedAt||null,modifiedAt:parsed.modifiedAt||null,
    text,excerpt,wordCount:text?text.split(/\s+/).length:0,linkCount:Number(parsed.linkCount||0),kind:parsed.kind||kind,structured:parsed.structured||{},
    headings:parsed.headings||[],canonical:parsed.canonical||finalUrl,promptInjectionDetected:parsed.promptInjectionDetected===true,robots:policy,
    citation:{page:relevantPage?.page||null,section:parsed.headings?.[0]?.text||null},ocrRequired:parsed.ocrRequired===true,totalPages:parsed.totalPages||null,
    headers:meta,retrievalLatencyMs:Date.now()-started
  };
}
export function directRetrievalHealth(){return{version:DIRECT_RETRIEVAL_VERSION,robotsAware:true,httpsOnly:true,redirectValidation:true,boundedBody:true,supported:['html','json','json-ld','xml','rss','atom','text','pdf'],pdf:{pageText:true,pageRanking:true,tables:'optional',ocr:'detection_only'}}}
),core=anchored?rulePath.slice(0,-1):rulePath;
    const escaped=core.replace(/[.+?^{}()|[\\]\\\\]/g,'\\\\  const rules=candidates.flatMap(g=>g.rules).filter(r=>r.path&&path.startsWith(r.path)).sort((a,b)=>b.path.length-a.path.length);
  const top=rules[0]||null;').replace(/\\*/g,'.*');
    try{return new RegExp('^'+escaped+(anchored?'
  const delay=candidates.map(g=>g.crawlDelay).filter(Number.isFinite).sort((a,b)=>b-a)[0];
  return{allowed:!top||top.type==='allow',matchedRule:top,crawlDelayMs:Number.isFinite(delay)?Math.min(60000,Math.max(0,delay*1000)):null};
}
async function robotsPolicy(targetUrl,{fetchImpl=fetch,resolveHostImpl,timeoutMs=2500}={}){
  const url=new URL(targetUrl);const key=url.origin;
  const cached=ROBOTS_CACHE.get(key);if(cached&&Date.now()-cached.at<30*60*1000)return cached.value;
  const robotsUrl=new URL('/robots.txt',url).toString();
  try{
    const {response}=await safeWebFetchV2(robotsUrl,{fetchImpl,resolveHostImpl,timeoutMs,maxRedirects:1,enforceHttps:true,accept:'text/plain'});
    if(response.status===404){const value={allowed:true,status:'not_found',crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value}
    if(!response.ok){const value={allowed:true,status:`http_${response.status}`,crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value}
    const bytes=await readLimitedBody(response,256000);const raw=bytesToText(bytes);
    const evald=evaluateRobots(raw,targetUrl);
    const value={...evald,status:'parsed',hash:createHash('sha256').update(raw).digest('hex')};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value;
  }catch(error){
    const value={allowed:true,status:'unavailable',error:String(error?.code||error?.message||error).slice(0,120),crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value;
  }
}
function relevantExcerpt(text='',query='',max=2800){
  const body=clean(text,180000);if(!body)return'';
  const terms=[...new Set(clean(query,1200).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2))].slice(0,20);
  if(!terms.length)return body.slice(0,max);
  const lower=body.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let best=-1;for(const t of terms){const i=lower.indexOf(t);if(i>=0&&(best<0||i<best))best=i}
  if(best<0)return body.slice(0,max);
  const start=Math.max(0,best-Math.floor(max*.25));return body.slice(start,start+max);
}
function typeOf(contentType='',bytes){
  const ct=String(contentType||'').toLowerCase();
  if(ct.includes('pdf')||(bytes?.[0]===0x25&&bytes?.[1]===0x50&&bytes?.[2]===0x44&&bytes?.[3]===0x46))return'pdf';
  if(ct.includes('json'))return'json';
  if(ct.includes('rss')||ct.includes('atom')||ct.includes('xml'))return'xml';
  if(ct.includes('html')||ct.includes('xhtml')||!ct)return'html';
  if(ct.startsWith('text/'))return'text';
  return'unsupported';
}
export async function retrieveWebDocument(url,{query='',fetchImpl=fetch,resolveHostImpl,timeoutMs=6500,maxHtmlBytes=2_500_000,maxPdfBytes=14_000_000,respectRobots=true,extractTables=false}={}){
  const started=Date.now(),policy=respectRobots?await robotsPolicy(url,{fetchImpl,resolveHostImpl,timeoutMs:Math.min(timeoutMs,2500)}):{allowed:true,status:'disabled'};
  if(policy.allowed===false)throw Object.assign(new Error('robots_disallowed'),{code:'ROBOTS_DISALLOWED',policy});
  const {response,finalUrl,redirects}=await safeWebFetchV2(url,{fetchImpl,resolveHostImpl,timeoutMs,maxRedirects:3,enforceHttps:true});
  if(!response.ok)throw Object.assign(new Error(`web_http_${response.status}`),{code:'WEB_HTTP_ERROR',status:response.status});
  const meta=responseSecurityMetadata(response),kindHint=String(meta.contentType||'').toLowerCase().includes('pdf')?'pdf':'other';
  const bytes=await readLimitedBody(response,kindHint==='pdf'?maxPdfBytes:maxHtmlBytes);
  const kind=typeOf(meta.contentType,bytes);
  if(kind==='unsupported')throw Object.assign(new Error(`unsupported_content_type:${meta.contentType||'unknown'}`),{code:'WEB_CONTENT_TYPE_UNSUPPORTED'});
  let parsed;
  if(kind==='pdf')parsed=await parsePdfBuffer(bytes,{query,extractTables,maxPages:80});
  else{
    const raw=bytesToText(bytes);
    if(kind==='json')parsed=parseJsonDocument(raw,finalUrl);
    else if(kind==='xml')parsed=parseXmlDocument(raw,finalUrl);
    else if(kind==='text')parsed=parseTextDocument(raw,finalUrl);
    else parsed=parseHtmlDocument(raw,finalUrl);
  }
  const text=clean(parsed.text,180000),excerpt=relevantExcerpt(text,query,3200);
  const relevantPage=kind==='pdf'&&Array.isArray(parsed.pages)&&parsed.pages.length?parsed.pages[0]:null;
  return{
    version:DIRECT_RETRIEVAL_VERSION,url:String(url),finalUrl,redirects,httpStatus:response.status,contentType:meta.contentType||'',contentHash:hash(bytes),bytes:bytes.byteLength,
    title:parsed.title||'',description:parsed.description||'',author:parsed.author||null,publishedAt:parsed.publishedAt||null,modifiedAt:parsed.modifiedAt||null,
    text,excerpt,wordCount:text?text.split(/\s+/).length:0,linkCount:Number(parsed.linkCount||0),kind:parsed.kind||kind,structured:parsed.structured||{},
    headings:parsed.headings||[],canonical:parsed.canonical||finalUrl,promptInjectionDetected:parsed.promptInjectionDetected===true,robots:policy,
    citation:{page:relevantPage?.page||null,section:parsed.headings?.[0]?.text||null},ocrRequired:parsed.ocrRequired===true,totalPages:parsed.totalPages||null,
    headers:meta,retrievalLatencyMs:Date.now()-started
  };
}
export function directRetrievalHealth(){return{version:DIRECT_RETRIEVAL_VERSION,robotsAware:true,httpsOnly:true,redirectValidation:true,boundedBody:true,supported:['html','json','json-ld','xml','rss','atom','text','pdf'],pdf:{pageText:true,pageRanking:true,tables:'optional',ocr:'detection_only'}}}
:'')).test(target)}catch{return target.startsWith(core)}
  };
  const specificity=rule=>String(rule.path||'').replace(/[*$]/g,'').length;
  const rules=candidates.flatMap(g=>g.rules).filter(r=>r.path&&robotsMatch(r.path,path)).sort((a,b)=>specificity(b)-specificity(a)||(a.type==='allow'?-1:1));
  const top=rules[0]||null;
  const delay=candidates.map(g=>g.crawlDelay).filter(Number.isFinite).sort((a,b)=>b-a)[0];
  return{allowed:!top||top.type==='allow',matchedRule:top,crawlDelayMs:Number.isFinite(delay)?Math.min(60000,Math.max(0,delay*1000)):null};
}
async function robotsPolicy(targetUrl,{fetchImpl=fetch,resolveHostImpl,timeoutMs=2500}={}){
  const url=new URL(targetUrl);const key=url.origin;
  const cached=ROBOTS_CACHE.get(key);if(cached&&Date.now()-cached.at<30*60*1000)return cached.value;
  const robotsUrl=new URL('/robots.txt',url).toString();
  try{
    const {response}=await safeWebFetchV2(robotsUrl,{fetchImpl,resolveHostImpl,timeoutMs,maxRedirects:1,enforceHttps:true,accept:'text/plain'});
    if(response.status===404){const value={allowed:true,status:'not_found',crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value}
    if(!response.ok){const value={allowed:true,status:`http_${response.status}`,crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value}
    const bytes=await readLimitedBody(response,256000);const raw=bytesToText(bytes);
    const evald=evaluateRobots(raw,targetUrl);
    const value={...evald,status:'parsed',hash:createHash('sha256').update(raw).digest('hex')};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value;
  }catch(error){
    const value={allowed:true,status:'unavailable',error:String(error?.code||error?.message||error).slice(0,120),crawlDelayMs:null};ROBOTS_CACHE.set(key,{at:Date.now(),value});return value;
  }
}
function relevantExcerpt(text='',query='',max=2800){
  const body=clean(text,180000);if(!body)return'';
  const terms=[...new Set(clean(query,1200).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2))].slice(0,20);
  if(!terms.length)return body.slice(0,max);
  const lower=body.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let best=-1;for(const t of terms){const i=lower.indexOf(t);if(i>=0&&(best<0||i<best))best=i}
  if(best<0)return body.slice(0,max);
  const start=Math.max(0,best-Math.floor(max*.25));return body.slice(start,start+max);
}
function typeOf(contentType='',bytes){
  const ct=String(contentType||'').toLowerCase();
  if(ct.includes('pdf')||(bytes?.[0]===0x25&&bytes?.[1]===0x50&&bytes?.[2]===0x44&&bytes?.[3]===0x46))return'pdf';
  if(ct.includes('json'))return'json';
  if(ct.includes('rss')||ct.includes('atom')||ct.includes('xml'))return'xml';
  if(ct.includes('html')||ct.includes('xhtml')||!ct)return'html';
  if(ct.startsWith('text/'))return'text';
  return'unsupported';
}
export async function retrieveWebDocument(url,{query='',fetchImpl=fetch,resolveHostImpl,timeoutMs=6500,maxHtmlBytes=2_500_000,maxPdfBytes=14_000_000,respectRobots=true,extractTables=false}={}){
  const started=Date.now(),policy=respectRobots?await robotsPolicy(url,{fetchImpl,resolveHostImpl,timeoutMs:Math.min(timeoutMs,2500)}):{allowed:true,status:'disabled'};
  if(policy.allowed===false)throw Object.assign(new Error('robots_disallowed'),{code:'ROBOTS_DISALLOWED',policy});
  const {response,finalUrl,redirects}=await safeWebFetchV2(url,{fetchImpl,resolveHostImpl,timeoutMs,maxRedirects:3,enforceHttps:true});
  if(!response.ok)throw Object.assign(new Error(`web_http_${response.status}`),{code:'WEB_HTTP_ERROR',status:response.status});
  const meta=responseSecurityMetadata(response),kindHint=String(meta.contentType||'').toLowerCase().includes('pdf')?'pdf':'other';
  const bytes=await readLimitedBody(response,kindHint==='pdf'?maxPdfBytes:maxHtmlBytes);
  const kind=typeOf(meta.contentType,bytes);
  if(kind==='unsupported')throw Object.assign(new Error(`unsupported_content_type:${meta.contentType||'unknown'}`),{code:'WEB_CONTENT_TYPE_UNSUPPORTED'});
  let parsed;
  if(kind==='pdf')parsed=await parsePdfBuffer(bytes,{query,extractTables,maxPages:80});
  else{
    const raw=bytesToText(bytes);
    if(kind==='json')parsed=parseJsonDocument(raw,finalUrl);
    else if(kind==='xml')parsed=parseXmlDocument(raw,finalUrl);
    else if(kind==='text')parsed=parseTextDocument(raw,finalUrl);
    else parsed=parseHtmlDocument(raw,finalUrl);
  }
  const text=clean(parsed.text,180000),excerpt=relevantExcerpt(text,query,3200);
  const relevantPage=kind==='pdf'&&Array.isArray(parsed.pages)&&parsed.pages.length?parsed.pages[0]:null;
  return{
    version:DIRECT_RETRIEVAL_VERSION,url:String(url),finalUrl,redirects,httpStatus:response.status,contentType:meta.contentType||'',contentHash:hash(bytes),bytes:bytes.byteLength,
    title:parsed.title||'',description:parsed.description||'',author:parsed.author||null,publishedAt:parsed.publishedAt||null,modifiedAt:parsed.modifiedAt||null,
    text,excerpt,wordCount:text?text.split(/\s+/).length:0,linkCount:Number(parsed.linkCount||0),kind:parsed.kind||kind,structured:parsed.structured||{},
    headings:parsed.headings||[],canonical:parsed.canonical||finalUrl,promptInjectionDetected:parsed.promptInjectionDetected===true,robots:policy,
    citation:{page:relevantPage?.page||null,section:parsed.headings?.[0]?.text||null},ocrRequired:parsed.ocrRequired===true,totalPages:parsed.totalPages||null,
    headers:meta,retrievalLatencyMs:Date.now()-started
  };
}
export function directRetrievalHealth(){return{version:DIRECT_RETRIEVAL_VERSION,robotsAware:true,httpsOnly:true,redirectValidation:true,boundedBody:true,supported:['html','json','json-ld','xml','rss','atom','text','pdf'],pdf:{pageText:true,pageRanking:true,tables:'optional',ocr:'detection_only'}}}
