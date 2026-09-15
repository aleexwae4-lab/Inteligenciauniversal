export const RETRIEVAL_SECURITY_VERSION='retrieval-security-gateway/v1';

const PROMPT_INJECTION_RX=[
  /ignore (?:all |any )?(?:previous|prior|system|developer) instructions?/i,
  /disregard (?:the )?(?:system|developer|previous) (?:prompt|message|instructions?)/i,
  /(?:system|developer) prompt/i,
  /you are now/i,
  /follow these instructions/i,
  /execute (?:this|the following) (?:code|command|instructions?)/i,
  /reveal (?:your|the) (?:secret|system|prompt|credentials?)/i,
  /BEGIN[_ -]?(?:SYSTEM|PROMPT|INSTRUCTIONS?)/i,
];

const ALLOWED_HOSTS=new Set([
  'api.openalex.org','api.crossref.org','www.wikidata.org','en.wikipedia.org','es.wikipedia.org','eutils.ncbi.nlm.nih.gov','export.arxiv.org','openlibrary.org','zenodo.org'
]);

export function sanitizeRetrievedText(value='',max=12000){
  let text=String(value??'').replace(/\u0000/g,'').replace(/[\u2028\u2029]/g,' ').trim().slice(0,max);
  const detections=[];
  for(const rx of PROMPT_INJECTION_RX){if(rx.test(text))detections.push(rx.source)}
  if(detections.length){
    text=text.replace(/ignore (?:all |any )?(?:previous|prior|system|developer) instructions?/gi,'[untrusted-instruction-removed]')
      .replace(/disregard (?:the )?(?:system|developer|previous) (?:prompt|message|instructions?)/gi,'[untrusted-instruction-removed]')
      .replace(/follow these instructions/gi,'[untrusted-instruction-removed]')
      .replace(/execute (?:this|the following) (?:code|command|instructions?)/gi,'[untrusted-instruction-removed]');
  }
  return{text,injection_detected:detections.length>0,detection_count:detections.length};
}

export function validateConnectorUrl(value=''){
  try{
    const url=new URL(String(value));
    if(url.protocol!=='https:')return{ok:false,reason:'https_required'};
    if(!ALLOWED_HOSTS.has(url.hostname))return{ok:false,reason:'host_not_allowlisted'};
    if(url.username||url.password)return{ok:false,reason:'credentials_in_url'};
    return{ok:true,url};
  }catch{return{ok:false,reason:'invalid_url'}}
}

export async function safeConnectorFetch(url,options={},fetchImpl=fetch){
  const validated=validateConnectorUrl(url);
  if(!validated.ok)throw Object.assign(new Error(`retrieval_url_blocked:${validated.reason}`),{code:'RETRIEVAL_URL_BLOCKED'});
  const timeout=Math.max(500,Math.min(Number(options.timeoutMs)||5500,12000));
  const headers={Accept:'application/json, application/atom+xml;q=0.9, application/xml;q=0.8, text/plain;q=0.7','User-Agent':'WAE-Universal-Knowledge-Fabric/1.0',...(options.headers||{})};
  return fetchImpl(validated.url,{method:'GET',headers,signal:AbortSignal.timeout(timeout),redirect:'error'});
}

export function untrustedEvidenceFrame(record={}){
  const excerpt=sanitizeRetrievedText(record.abstract||record.excerpt||record.content||'',5000);
  return{
    type:'knowledge_evidence',trust:'retrieved_untrusted_data',disclosure:'public',source:String(record.source?.id||record.source_id||'unknown'),
    content:excerpt.text,injection_detected:excerpt.injection_detected,security_version:RETRIEVAL_SECURITY_VERSION
  };
}

export function retrievalSecurityHealth(){return{version:RETRIEVAL_SECURITY_VERSION,allowed_hosts:[...ALLOWED_HOSTS],prompt_injection_patterns:PROMPT_INJECTION_RX.length}}
