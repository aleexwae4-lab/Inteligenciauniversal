import {createClient as createSupabaseClient} from 'npm:@supabase/supabase-js@2.57.4';

export const EDGE_DB_TRANSPORT_VERSION='wae-edge-db-transport/v84-session-retry';

const SESSION_INSERT_ATTEMPTS=3;
const RETRYABLE_STATUS=new Set([502,503,504]);

function deadlineMs(){
  const raw=Number(Deno.env.get('WAE_EDGE_DB_TIMEOUT_MS')||5000);
  return Number.isFinite(raw)?Math.max(1500,Math.min(12000,Math.round(raw))):5000;
}

function mergedSignal(existing?:AbortSignal|null){
  const timeout=AbortSignal.timeout(deadlineMs());
  if(!existing)return timeout;
  if(existing.aborted)return existing;
  return AbortSignal.any([existing,timeout]);
}

function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms))}

function sourceUrl(input:RequestInfo|URL){
  if(input instanceof URL)return input.toString();
  if(typeof input==='string')return input;
  return input.url;
}

function prepareIdempotentSessionInsert(input:RequestInfo|URL,init:RequestInit){
  const method=String(init.method||((typeof Request!=='undefined'&&input instanceof Request)?input.method:'GET')).toUpperCase();
  if(method!=='POST')return null;
  let url:URL;
  try{url=new URL(sourceUrl(input))}catch{return null}
  if(!/\/rest\/v1\/iu_sessions\/?$/.test(url.pathname))return null;
  if(typeof init.body!=='string'||!init.body.trim())return null;

  let parsed:any;
  try{parsed=JSON.parse(init.body)}catch{return null}
  const rows=Array.isArray(parsed)?parsed:[parsed];
  if(rows.length!==1||!rows[0]||typeof rows[0]!=='object'||Array.isArray(rows[0]))return null;

  const row={...rows[0],id:String(rows[0].id||crypto.randomUUID())};
  url.searchParams.set('on_conflict','id');
  const headers=new Headers(init.headers||{});
  const prefer=headers.get('Prefer')||'';
  if(!/resolution=merge-duplicates/i.test(prefer))headers.set('Prefer',prefer?`${prefer},resolution=merge-duplicates`:'resolution=merge-duplicates');

  return{
    input:url,
    init:{...init,headers,body:JSON.stringify(Array.isArray(parsed)?[row]:row)},
    sessionId:row.id
  };
}

function retryableTransportError(error:any,external?:AbortSignal|null){
  if(external?.aborted)return false;
  return error?.name==='TimeoutError'||error?.name==='AbortError'||error instanceof TypeError;
}

async function boundedFetch(input:RequestInfo|URL,init:RequestInit={}){
  const sessionInsert=prepareIdempotentSessionInsert(input,init);
  const requestInput=sessionInsert?.input||input;
  const requestInit=sessionInsert?.init||init;
  const attempts=sessionInsert?SESSION_INSERT_ATTEMPTS:1;
  let lastError:any=null;

  for(let attempt=0;attempt<attempts;attempt++){
    const started=Date.now();
    try{
      const response=await fetch(requestInput,{...requestInit,signal:mergedSignal(init.signal)});
      if(sessionInsert&&RETRYABLE_STATUS.has(response.status)&&attempt<attempts-1){
        console.warn('[Edge DB transport v84] retry session bootstrap response',{attempt:attempt+1,status:response.status});
        await sleep(120*(attempt+1));
        continue;
      }
      return response;
    }catch(error:any){
      lastError=error;
      const elapsed=Date.now()-started;
      if(sessionInsert&&retryableTransportError(error,init.signal)&&attempt<attempts-1){
        console.warn('[Edge DB transport v84] retry session bootstrap transport',{attempt:attempt+1,elapsed_ms:elapsed,error:String(error?.name||'transport').slice(0,60)});
        await sleep(120*(attempt+1));
        continue;
      }
      if(error?.name==='TimeoutError'||error?.name==='AbortError'){
        const wrapped:any=new Error(`edge_db_transport_timeout:${elapsed}ms`);
        wrapped.name='EdgeDbTransportTimeout';
        wrapped.status=503;
        wrapped.recoverable=true;
        wrapped.cause=error;
        throw wrapped;
      }
      throw error;
    }
  }

  if(lastError)throw lastError;
  throw new Error('edge_db_transport_exhausted');
}

export function createClient(url:string,key:string,options:any={}){
  const existingGlobal=options?.global&&typeof options.global==='object'?options.global:{};
  return createSupabaseClient(url,key,{...options,global:{...existingGlobal,fetch:boundedFetch}});
}
