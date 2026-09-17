import * as stable from 'https://raw.githubusercontent.com/aleexwae4-lab/Inteligenciauniversal/3801e940150ea968f72164807669609ec60b5c7a/supabase/functions/wae-local-voice-demo-v61/router-v24.ts';
export * from 'https://raw.githubusercontent.com/aleexwae4-lab/Inteligenciauniversal/3801e940150ea968f72164807669609ec60b5c7a/supabase/functions/wae-local-voice-demo-v61/router-v24.ts';
import {deterministicArithmeticV107,DETERMINISTIC_ARITHMETIC_V107} from './deterministic-arithmetic-v107.ts';

export const EDGE_REGISTRY_GUARD_VERSION='wae-edge-registry-guard/v25-arithmetic-v107';
const REGISTRY_DEADLINE_MS=2500;
const MATH_PROVIDER='wae_deterministic_arithmetic';
const MATH_MODEL='wae-deterministic-arithmetic-v107';

function deterministicRescue(){
  return [{provider:'wae_deterministic_rescue',model_name:'wae-deterministic-rescue-v1',priority:4,registry_health:'healthy',circuit_state:'CLOSED',effective_health:'healthy',consecutive_failures:0,failure_debt:0,capabilities:{base_url:'https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-production-certification-v72/chat/completions',api_style:'openai_compatible_chat',reasoning:false,streaming:false,timeout_ms:8000,zero_token:true,api_key_env:'SUPABASE_SERVICE_ROLE_KEY',temperature:0,tool_calling:false,deterministic:true,endpoint_path:'/chat/completions',evidence_only:true,context_tokens:65536,text_generation:true,requires_api_key:true,max_output_tokens:4000,structured_output:true},cost_profile:{currency:'USD',free_endpoint:true,input_per_million:0,output_per_million:0},reasoning_capable:false,tools_capable:false,vision_capable:false,structured_output_capable:true,streaming_claimed:true,streaming_probe_count:0,streaming_verified:false,supports_sensitive_data:true,context_window:65536,max_output_tokens:4000,quality_score:60,reliability_score:80}];
}

function mathModel(){
  return {provider:MATH_PROVIDER,model_name:MATH_MODEL,priority:0,registry_health:'healthy',circuit_state:'CLOSED',effective_health:'healthy',consecutive_failures:0,failure_debt:0,capabilities:{runtime:'edge',deterministic:true,text_generation:true,streaming:true,zero_token:true,max_output_tokens:64},cost_profile:{currency:'USD',free_endpoint:true,input_per_million:0,output_per_million:0},reasoning_capable:false,tools_capable:false,vision_capable:false,structured_output_capable:false,streaming_claimed:true,streaming_probe_count:1,streaming_verified:true,supports_sensitive_data:true,context_window:8192,max_output_tokens:64,quality_score:100,reliability_score:100,ewma_latency_ms:1,ewma_ttft_ms:1,deterministic_math:true,version:DETERMINISTIC_ARITHMETIC_V107};
}

function userMessage(msgs:any[]=[]){return String([...msgs].reverse().find((x:any)=>x?.role==='user')?.content||'')}

export function classifyTask(q:string,mode='general',attachments:any[]=[]){
  const arithmetic=mode==='general'&&(!Array.isArray(attachments)||attachments.length===0)?deterministicArithmeticV107(q):null;
  if(arithmetic)return{category:'simple_chat',path:'FAST',risk:'low',complexity:'low',sensitiveData:false,deterministic_math:true,deterministic_math_version:DETERMINISTIC_ARITHMETIC_V107};
  return stable.classifyTask(q,mode,attachments);
}

export async function registry(db:any,task:any,q:string){
  if(task?.deterministic_math===true&&deterministicArithmeticV107(q))return [mathModel()];
  let timer:any=null;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'timeout'}),REGISTRY_DEADLINE_MS)});
  const lookup=stable.registry(db,task,q).then((rows:any[])=>({kind:'ok',rows})).catch((error:any)=>({kind:'error',error}));
  const result:any=await Promise.race([lookup,timeout]);
  if(timer)clearTimeout(timer);
  if(result?.kind==='ok'&&Array.isArray(result.rows)&&result.rows.length)return result.rows;
  console.warn('[Edge registry guard v25]',result?.kind==='timeout'?'registry_deadline':String(result?.error?.message||'registry_empty').slice(0,160));
  return deterministicRescue();
}

export function rank(reg:any[],task:any,req:any,variant='candidate'){
  const math=(Array.isArray(reg)?reg:[]).filter((row:any)=>row?.provider===MATH_PROVIDER);
  if(math.length)return math;
  return stable.rank(reg,task,req,variant);
}

export async function invoke(m:any,msgs:any[],opts:any={}){
  if(m?.provider===MATH_PROVIDER){
    const started=Date.now(),result=deterministicArithmeticV107(userMessage(msgs));
    if(!result){const e:any=new Error('deterministic_math_mismatch');e.deterministic=true;throw e}
    if(opts?.stream===true)opts.onDelta?.(result.reply,1);
    return{text:result.reply,ttft_ms:opts?.stream===true?1:null,latency_ms:Math.max(1,Date.now()-started),input_tokens:null,output_tokens:null,streamed:opts?.stream===true,provider_request_at:started,delta_count:opts?.stream===true?1:0,deterministic:true,calculation:{expression:result.expression,value:result.value??null,error:result.error||null,version:DETERMINISTIC_ARITHMETIC_V107}};
  }
  return stable.invoke(m,msgs,opts);
}

export async function markSuccess(db:any,m:any,latency:number,ttft:any,streamed=false){
  if(m?.provider===MATH_PROVIDER)return;
  return stable.markSuccess(db,m,latency,ttft,streamed);
}

export async function markFailure(db:any,m:any,e:any){
  if(m?.provider===MATH_PROVIDER)return 'deterministic';
  const cls=await stable.markFailure(db,m,e);
  if(cls!=='rate_limit')return cls;
  const failures=Math.max(1,Number(m?.consecutive_failures||0)+1);
  const cooldownSeconds=Math.min(180,75+failures*15);
  const openUntil=new Date(Date.now()+cooldownSeconds*1000).toISOString();
  await Promise.allSettled([
    db.from('wae_ai_models').update({circuit_open_until:openUntil}).eq('provider',m.provider).eq('model_name',m.model_name).is('organization_id',null),
    db.from('wae_provider_reliability_ledger_v1').update({open_until:openUntil,updated_at:new Date().toISOString()}).eq('provider',m.provider).eq('model',m.model_name)
  ]);
  return cls;
}
