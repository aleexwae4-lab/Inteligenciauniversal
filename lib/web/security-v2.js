import { validatePublicUrl, resolvePublicHost } from './security-v1.js';
export const WEB_RETRIEVAL_SECURITY_V2='web-retrieval-security/v2.0.0';
const REDIRECTS=new Set([301,302,303,307,308]);
const safeHeaderValue=(v,max=500)=>String(v??'').replace(/[\r\n]+/g,' ').slice(0,max);
export async function readLimitedBody(response,maxBytes=2_000_000){
  const declared=Number(response.headers?.get?.('content-length')||0);
  if(declared>maxBytes)throw Object.assign(new Error('response_too_large'),{code:'WEB_RESPONSE_TOO_LARGE',declared,maxBytes});
  if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let total=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel().catch(()=>{});throw Object.assign(new Error('response_too_large'),{code:'WEB_RESPONSE_TOO_LARGE',maxBytes});}chunks.push(value)}
    }finally{reader.releaseLock?.()}
    const out=new Uint8Array(total);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength}return out;
  }
  const data=new Uint8Array(await response.arrayBuffer());if(data.byteLength>maxBytes)throw Object.assign(new Error('response_too_large'),{code:'WEB_RESPONSE_TOO_LARGE',maxBytes});return data;
}
export async function safeWebFetchV2(value,{timeoutMs=6500,maxRedirects=3,headers={},accept,enforceHttps=true,fetchImpl=fetch,resolveHostImpl=resolvePublicHost}={}){
  let current=String(value||'');
  for(let hop=0;hop<=maxRedirects;hop++){
    const validated=validatePublicUrl(current);if(!validated.ok)throw Object.assign(new Error(`web_url_blocked:${validated.reason}`),{code:'WEB_URL_BLOCKED'});
    if(enforceHttps&&validated.url.protocol!=='https:')throw Object.assign(new Error('https_required'),{code:'WEB_HTTPS_REQUIRED'});
    const resolved=await resolveHostImpl(validated.url.hostname);if(!resolved?.ok)throw Object.assign(new Error(`web_dns_blocked:${resolved?.reason||'private'}`),{code:'WEB_DNS_BLOCKED'});
    const response=await fetchImpl(validated.url,{method:'GET',headers:{Accept:accept||'text/html,application/xhtml+xml,application/ld+json,application/json,application/xml,text/xml,application/rss+xml,application/atom+xml,text/plain,application/pdf;q=0.9','User-Agent':'WAE-Universal-Web-Intelligence/2.0 (+research; robots-aware; evidence-only)',...headers},redirect:'manual',signal:AbortSignal.timeout(Math.max(500,Math.min(Number(timeoutMs)||6500,15000)))});
    if(REDIRECTS.has(response.status)){
      const location=response.headers.get('location');if(!location)throw Object.assign(new Error('redirect_without_location'),{code:'WEB_REDIRECT_INVALID'});
      if(hop===maxRedirects)throw Object.assign(new Error('too_many_redirects'),{code:'WEB_REDIRECT_LIMIT'});
      const next=new URL(location,validated.url).toString();
      const nextValidated=validatePublicUrl(next);if(!nextValidated.ok||(enforceHttps&&nextValidated.url.protocol!=='https:'))throw Object.assign(new Error('redirect_target_blocked'),{code:'WEB_REDIRECT_BLOCKED'});
      current=next;continue;
    }
    return{response,finalUrl:validated.url.toString(),resolvedAddresses:resolved.addresses||[],redirects:hop};
  }
  throw Object.assign(new Error('redirect_limit'),{code:'WEB_REDIRECT_LIMIT'});
}
export function responseSecurityMetadata(response={}){
  return{contentType:safeHeaderValue(response.headers?.get?.('content-type'),200),contentLength:Number(response.headers?.get?.('content-length')||0)||null,etag:safeHeaderValue(response.headers?.get?.('etag'),300)||null,lastModified:safeHeaderValue(response.headers?.get?.('last-modified'),120)||null,cacheControl:safeHeaderValue(response.headers?.get?.('cache-control'),300)||null};
}
