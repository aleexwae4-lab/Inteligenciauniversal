// Universal Core -> WAEWEB Connect/v1 public evidence, server-side only.
// A disconnected/partial upstream is never interpreted as "no results on the web".
import {requestWaeweb,waewebSettings,WaewebConnectError} from './waeweb-connect.js';
export const waewebConfigured=(env=process.env)=>Boolean(waewebSettings(env));
const clean=(value,max=1200)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const safeUrl=value=>{
  if(typeof value!=='string'||value.length>1800)return null;
  try{
    const url=new URL(value);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname)return null;
    return url.href;
  }catch{return null}
};
export function normalizeWaewebResults(payload,query=''){
 if(!payload||payload.ok!==true||payload.contract!=='waeweb-connect/v1'||
    !['complete','partial'].includes(payload.status)||
    !Array.isArray(payload.results)||!Array.isArray(payload.sources)||
    !Array.isArray(payload.failedSources))
   throw new WaewebConnectError('waeweb_search_contract_invalid',502);
 const result=[];
 const seen=new Set();
 for(const hit of payload.results.slice(0,25)){
  if(!hit||typeof hit!=='object')continue;
  const url=safeUrl(hit.url),title=clean(hit.title,260);
  if(!url||!title||seen.has(url))continue;
  seen.add(url);
  const snippet=clean(hit.snippet,1050),source=clean(hit.source,100)||'fuente externa';
  result.push({
   title,url,snippet,content:snippet,source:'WAEWEB · '+source,
   publishedAt:clean(hit.date,40)||null,
   retrievedAt:typeof payload.fetchedAt==='string'&&!Number.isNaN(Date.parse(payload.fetchedAt))
      ?payload.fetchedAt:new Date().toISOString(),
   scope:payload.status==='partial'?'waeweb-partial-external-source':'waeweb-external-source'
  });
  if(result.length>=8)break;
 }
 return {
  query:clean(query,180),status:payload.status,results:result,
  sources:payload.sources.map(x=>clean(x,110)).filter(Boolean).slice(0,20),
  failedSources:payload.failedSources.map(x=>clean(x,110)).filter(Boolean).slice(0,20),
  fetchedAt:typeof payload.fetchedAt==='string'?payload.fetchedAt:null,
  limitation:payload.status==='partial'
   ?'Cobertura parcial de WAEWEB; al menos una fuente falló. No es una búsqueda exhaustiva ni prueba hechos por sí sola.'
   :'Resultados de fuentes públicas de WAEWEB; el resumen y las fechas externas no equivalen a verificación independiente.'
 };
}
export async function searchWaewebEvidence(query,{fresh=true,timeoutMs=9000,transport=fetch,env=process.env}={}){
 if(!waewebConfigured(env))throw new WaewebConnectError('waeweb_connect_not_configured',503);
 const input=clean(query,200);
 // Do not silently discard the last words of a question or transmit attachments,
 // session tokens, project instructions, conversation history or private context.
 if(input.length<2||input.length>180)throw new WaewebConnectError('waeweb_query_out_of_range',422);
 const payload=await requestWaeweb('search',{query:input,type:'all',fresh},
  {env,transport,timeoutMs});
 return normalizeWaewebResults(payload,input);
}
