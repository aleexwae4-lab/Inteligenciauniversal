// Server-only, opt-in WAEWEB Connect client for both Universal Core deployments.
// Never put machine credentials in NEXT_PUBLIC_* or return them to the browser.
const CLIENTS=new Set(["inteligenciauniversal","universal-core-vt3h"]);
const TYPES=new Set(["all","research","books","news","videos","images"]);
export function waewebSettings(env=process.env) {
  if(env.WAEWEB_CONNECT_ENABLED!=="true" || !CLIENTS.has(env.WAEWEB_CONNECT_CLIENT_ID) ||
     typeof env.WAEWEB_CONNECT_TOKEN!=="string" ||
     !/^[\x21-\x7e]{32,256}$/.test(env.WAEWEB_CONNECT_TOKEN))return null;
  let base;
  try{base=new URL(env.WAEWEB_CONNECT_BASE_URL);}catch{return null;}
  if(base.protocol!=="https:" || !base.hostname.includes(".") || base.username ||
     base.password || base.search || base.hash || base.pathname!=="/" ||
     /\.(local|localhost|internal|test|invalid)$/.test(base.hostname) ||
     base.port && base.port!=="443")return null;
  return {base:base.origin,id:env.WAEWEB_CONNECT_CLIENT_ID,token:env.WAEWEB_CONNECT_TOKEN};
}
export class WaewebConnectError extends Error {
  constructor(code,status=502){super(code);this.code=code;this.status=status;}
}
export function validateWaewebRequest(body,kind) {
  if(kind==="status")return null;
  if(!body||typeof body!=="object"||Array.isArray(body))throw new WaewebConnectError("invalid_body",400);
  if(kind==="retrieve"){
    if(typeof body.url!=="string"||body.url.length<12||body.url.length>1800)
      throw new WaewebConnectError("invalid_url",422);
    return {url:body.url};
  }
  const query=body.query;
  if(typeof query!=="string"||query!==query.trim()||query.length<2||
     query.length>180||/[\u0000-\u001f\u007f]/.test(query))
    throw new WaewebConnectError("invalid_query",422);
  const type=body.type||"all";
  if(!TYPES.has(type))throw new WaewebConnectError("invalid_type",422);
  if(body.fresh!==undefined&&typeof body.fresh!=="boolean")
    throw new WaewebConnectError("invalid_fresh",422);
  return {query,type,fresh:body.fresh===true};
}
const MAX_STREAM_BYTES=128*1024;
// The transport timeout MUST remain active after SSE response headers arrive.
export function boundedWaewebStream(upstream,controller,timer) {
  const reader=upstream.body.getReader();
  let total=0,ended=false,sawDone=false,tail="";
  const decoder=new TextDecoder();
  let downstream;
  const finish=()=>{if(!ended){ended=true;clearTimeout(timer);}};
  const output=new ReadableStream({
    start(target){downstream=target;},
    async pull(target){
      if(ended)return;
      try{
        const next=await reader.read();
        if(ended)return;
        if(next.done){
          finish();
          if(!sawDone){
            target.enqueue(new TextEncoder().encode('event: error\ndata: {"error":"waeweb_stream_incomplete"}\n\n'));
            target.enqueue(new TextEncoder().encode('event: done\ndata: {"ok":false}\n\n'));
          }
          target.close();return;
        }
        tail=(tail+decoder.decode(next.value,{stream:true})).slice(-512);
        if(/(?:^|\n)event:\s*done\r?\n/.test(tail))sawDone=true;
        total+=next.value?.byteLength||0;
        if(total>MAX_STREAM_BYTES){
          finish();
          controller.abort();
          await reader.cancel("waeweb_stream_too_large").catch(()=>{});
          target.error(new WaewebConnectError("waeweb_stream_too_large",502));
          return;
        }
        target.enqueue(next.value);
      }catch(error){
        if(ended)return;
        finish();
        target.error(new WaewebConnectError(controller.signal.aborted?
          "waeweb_stream_timeout":"waeweb_stream_interrupted",503));
      }
    },
    async cancel(reason){finish();controller.abort();await reader.cancel(reason).catch(()=>{});}
  });
  return {stream:output,stop:()=>{
    if(ended)return;
    finish();controller.abort();
    reader.cancel("waeweb_stream_timeout").catch(()=>{});
    // Error the consumer even if a pending reader.read() resolves as done on cancellation.
    downstream.error(new WaewebConnectError("waeweb_stream_timeout",503));
  }};
}
export async function requestWaeweb(kind,payload,{
  env=process.env,transport=fetch,timeoutMs=16000
}={}) {
  const cfg=waewebSettings(env);
  if(!cfg)throw new WaewebConnectError("waeweb_connect_not_configured",503);
  if(!["status","search","stream","retrieve"].includes(kind))
    throw new WaewebConnectError("invalid_operation",400);
  const data=validateWaewebRequest(payload,kind);
  const controller=new AbortController();
  const budget=Math.max(10,Math.min(Number(timeoutMs)||16000,16000));
  let streamLease;
  const timer=setTimeout(()=>{
    if(streamLease)streamLease.stop();
    else controller.abort();
  },kind==="stream"?budget:Math.min(budget,14000));
  try{
    const result=await transport(cfg.base+"/api/connect/v1/"+kind,{
      method:kind==="status"?"GET":"POST",
      headers:{authorization:"Bearer "+cfg.token,"x-waeweb-client":cfg.id,
        ...(kind==="status"?{}:{"content-type":"application/json"})},
      ...(kind==="status"?{}:{body:JSON.stringify(data)}),
      signal:controller.signal,redirect:"error",cache:"no-store"
    });
    if(!result.ok)throw new WaewebConnectError("waeweb_upstream_"+result.status,
      result.status===401||result.status===403?503:result.status===429?429:502);
    if(kind==="stream") {
      if(!result.headers.get("content-type")?.startsWith("text/event-stream")||!result.body)
        throw new WaewebConnectError("waeweb_stream_contract_invalid");
      streamLease=boundedWaewebStream(result,controller,timer);
      return new Response(streamLease.stream,{
        status:result.status,headers:result.headers
      });
    }
    const body=await result.json().catch(()=>null);
    if(!body||body.contract!=="waeweb-connect/v1"||body.ok!==true)
      throw new WaewebConnectError("waeweb_contract_invalid");
    return body;
  }catch(e){
    if(e instanceof WaewebConnectError)throw e;
    throw new WaewebConnectError(controller.signal.aborted?"waeweb_timeout":"waeweb_unreachable",503);
  }finally{if(!streamLease)clearTimeout(timer);}
}
