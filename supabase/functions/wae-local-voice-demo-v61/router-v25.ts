import * as stable from 'https://raw.githubusercontent.com/aleexwae4-lab/Inteligenciauniversal/3801e940150ea968f72164807669609ec60b5c7a/supabase/functions/wae-local-voice-demo-v61/router-v24.ts';
export * from 'https://raw.githubusercontent.com/aleexwae4-lab/Inteligenciauniversal/3801e940150ea968f72164807669609ec60b5c7a/supabase/functions/wae-local-voice-demo-v61/router-v24.ts';

export const EDGE_REGISTRY_GUARD_VERSION='wae-edge-registry-guard/v25';
const REGISTRY_DEADLINE_MS=2500;

function deterministicRescue(){
  return [{
    provider:'wae_deterministic_rescue',
    model_name:'wae-deterministic-rescue-v1',
    priority:4,
    registry_health:'healthy',
    circuit_state:'CLOSED',
    effective_health:'healthy',
    consecutive_failures:0,
    failure_debt:0,
    capabilities:{
      base_url:'https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-production-certification-v72/chat/completions',
      api_style:'openai_compatible_chat',
      reasoning:false,
      streaming:false,
      timeout_ms:8000,
      zero_token:true,
      api_key_env:'SUPABASE_SERVICE_ROLE_KEY',
      temperature:0,
      tool_calling:false,
      deterministic:true,
      endpoint_path:'/chat/completions',
      evidence_only:true,
      context_tokens:65536,
      text_generation:true,
      requires_api_key:true,
      max_output_tokens:4000,
      structured_output:true
    },
    cost_profile:{currency:'USD',free_endpoint:true,input_per_million:0,output_per_million:0},
    reasoning_capable:false,
    tools_capable:false,
    vision_capable:false,
    structured_output_capable:true,
    streaming_claimed:true,
    streaming_probe_count:0,
    streaming_verified:false,
    supports_sensitive_data:true,
    context_window:65536,
    max_output_tokens:4000,
    quality_score:60,
    reliability_score:80
  }];
}

export async function registry(db:any,task:any,q:string){
  let timer:any=null;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'timeout'}),REGISTRY_DEADLINE_MS)});
  const lookup=stable.registry(db,task,q)
    .then((rows:any[])=>({kind:'ok',rows}))
    .catch((error:any)=>({kind:'error',error}));
  const result:any=await Promise.race([lookup,timeout]);
  if(timer)clearTimeout(timer);
  if(result?.kind==='ok'&&Array.isArray(result.rows)&&result.rows.length)return result.rows;
  console.warn('[Edge registry guard v25]',result?.kind==='timeout'?'registry_deadline':String(result?.error?.message||'registry_empty').slice(0,160));
  return deterministicRescue();
}
