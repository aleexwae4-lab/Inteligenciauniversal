import {createClient as createSupabaseClient} from 'npm:@supabase/supabase-js@2.57.4';

export const EDGE_DB_TRANSPORT_VERSION='wae-edge-db-transport/v81';

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

async function boundedFetch(input:RequestInfo|URL,init:RequestInit={}){
  const started=Date.now();
  try{
    return await fetch(input,{...init,signal:mergedSignal(init.signal)});
  }catch(error:any){
    const elapsed=Date.now()-started;
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

export function createClient(url:string,key:string,options:any={}){
  const existingGlobal=options?.global&&typeof options.global==='object'?options.global:{};
  return createSupabaseClient(url,key,{
    ...options,
    global:{...existingGlobal,fetch:boundedFetch}
  });
}
