// Read-only public WAEWEB search; explicitly NOT the private Connect/v1 API.
// Fixed first-party Render origin prevents caller-directed SSRF. Nothing in the
// conversation, browser or URL supplies credentials or a backend host.
import {normalizeWaewebResults} from './waeweb-research-v125.js';
import {WaewebConnectError} from './waeweb-connect.js';
export const WAEWEB_PUBLIC_ORIGIN='https://waeweb.onrender.com';
const LIMIT=256*1024;
export const waewebPublicConfigured=(env=process.env)=>env.WAEWEB_PUBLIC_SEARCH_ENABLED==='true';
async function boundedJson(response){
 const contentType=response.headers?.get?.('content-type')||'';
 if(contentType&&!/application\/json/i.test(contentType))
  throw new WaewebConnectError('waeweb_public_invalid_content_type',502);
 if(!response.body){
  const text=await response.text();
  if(Buffer.byteLength(text)>LIMIT)throw new WaewebConnectError('waeweb_public_too_large',502);
  try{return JSON.parse(text)}catch{throw new WaewebConnectError('waeweb_public_invalid_json',502)}
 }
 const reader=response.body.getReader();const pieces=[];let bytes=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   bytes+=value.byteLength;
   if(bytes>LIMIT)throw new WaewebConnectError('waeweb_public_too_large',502);
   pieces.push(value);
  }
 }catch(error){await reader.cancel().catch(()=>{});throw error}
 const text=Buffer.concat(pieces.map(x=>Buffer.from(x))).toString('utf8');
 try{return JSON.parse(text)}catch{throw new WaewebConnectError('waeweb_public_invalid_json',502)}
}
export function normalizePublicSearch(payload,query){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||
   !Array.isArray(payload.results)||!Array.isArray(payload.sources)||
   !Array.isArray(payload.failedSources)||payload.error)
  throw new WaewebConnectError('waeweb_public_contract_invalid',502);
 const available=payload.sources.filter(x=>typeof x==='string'&&!x.endsWith(' no configurado'));
 if(!available.length)throw new WaewebConnectError('waeweb_public_sources_unavailable',503);
 const general=payload.webCoverage==='general-index'||
   ['Brave','Google','SearXNG'].some(x=>available.includes(x));
 // A partial search or specialized-only results cannot replace a broad web index.
 const partial=payload.failedSources.length>0||
   payload.sources.some(x=>typeof x==='string'&&x.endsWith(' no configurado'))||
   !general;
 const data=normalizeWaewebResults({
  contract:'waeweb-connect/v1',ok:true,status:partial?'partial':'complete',
  query,results:payload.results,sources:payload.sources,
  failedSources:payload.failedSources,fetchedAt:payload.fetchedAt
 },query);
 return {...data,transport:'waeweb-public-readonly/v1',generalIndex:general,
  limitation:general
   ?(partial?'Búsqueda web parcial: algunas fuentes no están disponibles. Los extractos requieren verificación en origen.':'Resultados públicos de WAEWEB; los extractos requieren verificación en origen.')
   :'Solo resultados especializados o enciclopédicos; no equivale a cobertura de la web general.'};
}
export async function searchWaewebPublic(query,{
 env=process.env,transport=fetch,timeoutMs=6500,fresh=true
}={}){
 if(!waewebPublicConfigured(env))throw new WaewebConnectError('waeweb_public_not_enabled',503);
 if(typeof query!=='string'||query!==query.trim()||query.length<2||query.length>180||
   /[\u0000-\u001f\u007f]/.test(query))
  throw new WaewebConnectError('waeweb_public_invalid_query',422);
 const url=new URL('/api/search',WAEWEB_PUBLIC_ORIGIN);
 url.searchParams.set('q',query);url.searchParams.set('type','all');
 url.searchParams.set('collection','web');
 if(fresh)url.searchParams.set('fresh','1');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.min(8000,Math.max(100,Number(timeoutMs)||6500)));
 try{
  const response=await transport(url.href,{
   method:'GET',headers:{accept:'application/json'},
   redirect:'error',cache:'no-store',signal:controller.signal
  });
  if(!response.ok)throw new WaewebConnectError('waeweb_public_http_'+response.status,503);
  return normalizePublicSearch(await boundedJson(response),query);
 }catch(error){
  if(error instanceof WaewebConnectError)throw error;
  throw new WaewebConnectError(controller.signal.aborted?'waeweb_public_timeout':'waeweb_public_unreachable',503);
 }finally{clearTimeout(timer)}
}
