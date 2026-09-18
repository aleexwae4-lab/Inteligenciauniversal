import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
type J=Record<string,unknown>;
const V='73.1.0-free-mesh';
const H={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-model-probe':V};
const obj=(v:unknown):J=>typeof v==='object'&&v!==null&&!Array.isArray(v)?v as J:{};
const str=(v:unknown,n=1000)=>String(v??'').trim().slice(0,n);
const num=(v:unknown,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const json=(status:number,b:unknown)=>new Response(JSON.stringify(b),{status,headers:H});
function secret(){const modern=Deno.env.get('SUPABASE_SECRET_KEYS');if(modern){try{const p=JSON.parse(modern);if(p.default)return p.default}catch{}}return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}
function retryAfter(r:Response){const h=r.headers.get('retry-after');if(!h)return 60;const n=Number(h);if(Number.isFinite(n))return Math.max(15,Math.min(3600,Math.trunc(n)));const d=Date.parse(h);return Number.isFinite(d)?Math.max(15,Math.min(3600,Math.ceil((d-Date.now())/1000))):60}
function contentOf(p:any){const v=p?.choices?.[0]?.message?.content;if(typeof v==='string')return v.trim();if(Array.isArray(v))return v.map((x:any)=>typeof x==='string'?x:typeof x?.text==='string'?x.text:'').filter(Boolean).join('\n').trim();return''}
function promotable(m:any){const meta=obj(m?.metadata);return m?.discovery_managed===true&&String(m?.access_tier||'')==='FREE'&&String(m?.provider||'')==='openrouter'&&String(m?.model_name||'').endsWith(':free')&&num(meta.quality_score,0)>=80&&!/(safety|guard)/i.test(String(m?.model_name||''))}

function publicKey(){return Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||Deno.env.get('SUPABASE_ANON_KEY')||''}
function allowedStatelessOrigin(origin:string|null){
  if(!origin)return false;
  try{
    const host=new URL(origin).hostname;
    return (host.endsWith('.onrender.com')&&host.includes('wae-inteligencia-universal'))||(host.endsWith('.vercel.app')&&host.includes('inteligenciauniversal'));
  }catch{return false}
}
function statelessAuthorized(req:Request){
  const key=publicKey(),sent=req.headers.get('apikey')||'';
  return !!key&&sent===key&&allowedStatelessOrigin(req.headers.get('origin'));
}
function normalizedChatMessages(body:J){
  const out:{role:string;content:string}[]=[];
  const system=str(body.system,24000);if(system)out.push({role:'system',content:system});
  const raw=Array.isArray(body.messages)?body.messages:[];
  for(const item of raw.slice(-12)){
    const x=obj(item),role=str(x.role,20).toLowerCase(),content=str(x.content,12000);
    if(['user','assistant','system'].includes(role)&&content)out.push({role,content});
  }
  const message=str(body.message,24000);
  if(message&&!out.some((x,i)=>i===out.length-1&&x.role==='user'&&x.content===message))out.push({role:'user',content:message});
  return out.slice(-14);
}
async function statelessGroq(body:J){
  const apiKey=Deno.env.get('GROQ_API_KEY')||'',model=Deno.env.get('GROQ_STATELESS_MODEL')||'groq/compound';
  if(!apiKey)return json(503,{success:false,error:'stateless_provider_unconfigured',provider:'groq',version:V});
  const messages=normalizedChatMessages(body);
  if(!messages.some(m=>m.role==='user'))return json(422,{success:false,error:'message_required',version:V});
  const started=Date.now();
  try{
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
      body:JSON.stringify({model,messages,temperature:.18,max_tokens:Math.max(256,Math.min(3200,num(body.max_tokens,1800)))}),
      signal:AbortSignal.timeout(Math.max(8000,Math.min(35000,num(body.timeout_ms,26000))))
    });
    const raw=await r.text();let p:any={};try{p=JSON.parse(raw)}catch{}
    if(!r.ok)return json(r.status===429?429:502,{success:false,error:'stateless_provider_failed',provider:'groq',model,http_status:r.status,detail:str(p?.error?.message||raw,280),latency_ms:Date.now()-started,version:V});
    const reply=contentOf(p);
    if(!reply)return json(502,{success:false,error:'stateless_empty_reply',provider:'groq',model,latency_ms:Date.now()-started,version:V});
    return json(200,{success:true,reply,provider:'groq',model,stateless:true,degraded:false,latency_ms:Date.now()-started,usage:p?.usage??null,version:V});
  }catch(e){
    return json(503,{success:false,error:'stateless_transport_failure',provider:'groq',model,detail:e instanceof Error?str(e.message,220):'unknown',latency_ms:Date.now()-started,version:V});
  }
}

Deno.serve(async req=>{try{
 if(req.method!=='POST')return json(405,{success:false,error:'method_not_allowed',version:V});
 const body=obj(await req.json().catch(()=>({}))),action=str(body.action,40).toLowerCase();
 if(action==='stateless_health'||action==='stateless_chat'){
   if(!statelessAuthorized(req))return json(403,{success:false,error:'stateless_denied',version:V});
   if(action==='stateless_health')return json(200,{success:true,ready:Boolean(Deno.env.get('GROQ_API_KEY')),provider:'groq',model:Deno.env.get('GROQ_STATELESS_MODEL')||'groq/compound',stateless:true,version:V});
   return await statelessGroq(body);
 }
 const base=Deno.env.get('SUPABASE_URL')||'',key=secret(),workerToken=req.headers.get('x-wae-worker-token')||'';
 if(!base||!key)return json(500,{success:false,error:'configuration_missing',version:V});
 if(!workerToken)return json(401,{success:false,error:'worker_token_required',version:V});
 const db=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const validRes=await db.rpc('wae_validate_worker_token',{p_token:workerToken});if(validRes.error||validRes.data!==true)return json(403,{success:false,error:'invalid_worker_token',version:V});
 const requested=str(body.model_id);
 let modelRes:any;
 if(requested){let q:any=db.from('wae_ai_models').select('*').eq('id',requested).in('status',['active','pending_configuration']);if(body.force!==true)q=q.eq('enabled',true);modelRes=await q.maybeSingle()}
 else modelRes=await db.from('wae_ai_models').select('*').eq('enabled',true).in('status',['active','pending_configuration']).neq('provider','browser_webllm').order('last_health_check_at',{ascending:true,nullsFirst:true}).order('priority',{ascending:true}).limit(1).maybeSingle();
 if(modelRes.error)throw new Error(`model_query_failed:${modelRes.error.message}`);const m:any=modelRes.data;if(!m)return json(200,{success:true,probed:false,reason:'no_probe_candidate',version:V});
 const memberships=await db.from('organization_members').select('organization_id,user_id,roles(name)').is('deleted_at',null).limit(100);if(memberships.error)throw new Error(`identity_membership_failed:${memberships.error.message}`);
 let org='',user='',agent='';for(const r of memberships.data||[]){const role=str((r as any).roles?.name).toLowerCase();if(!['owner','admin','org_admin'].includes(role))continue;const ar=await db.from('agents').select('id').eq('organization_id',(r as any).organization_id).eq('template_key','auditoria').eq('status','active').is('deleted_at',null).limit(1).maybeSingle();if(ar.data?.id){org=(r as any).organization_id;user=(r as any).user_id;agent=ar.data.id;break}}
 if(!org||!user||!agent)return json(500,{success:false,error:'probe_identity_unavailable',version:V});
 const probeId=crypto.randomUUID();const ins=await db.from('wae_ai_model_probes').insert({id:probeId,organization_id:org,model_id:m.id,user_id:user,agent_id:agent,status:'queued',result:{harness:'wae-model-probe-v73',version:V,isolated:true,production_traffic:false}});if(ins.error)throw new Error(`probe_insert_failed:${ins.error.message}`);
 const c=obj(m.capabilities),direct=str(c.base_url),baseEnv=str(c.base_url_env),keyEnv=str(c.api_key_env),modelEnv=str(c.model_env),requires=c.requires_api_key!==false;
 const providerBase=direct||(baseEnv?(Deno.env.get(baseEnv)||''):'');const apiKey=keyEnv?(Deno.env.get(keyEnv)||''):'';const resolvedModel=str(m.model_name).startsWith('env:')?(modelEnv?(Deno.env.get(modelEnv)||''):''):str(m.model_name);const endpointPath=str(c.endpoint_path)||'/chat/completions';
 async function finish(status:string,result:J,attempt:J,health?:J){const attemptIns=await db.from('wae_ai_provider_attempts').insert({organization_id:org,model_id:m.id,provider:m.provider,model_name:m.model_name,access_tier:m.access_tier,attempt_status:str(attempt.attempt_status)||status,http_status:attempt.http_status??null,error_code:attempt.error_code??null,error_message:attempt.error_message??null,latency_ms:attempt.latency_ms??null,input_tokens:num(attempt.input_tokens),output_tokens:num(attempt.output_tokens),estimated_cost:0,metadata:{harness:'wae-model-probe-v73',version:V,probe_id:probeId,isolated:true,production_traffic:false,resolved_model:resolvedModel}});if(attemptIns.error)console.error('probe attempt insert',attemptIns.error.message);if(health){const h=await db.from('wae_ai_models').update(health).eq('id',m.id);if(h.error)console.error('probe health update',h.error.message)}const p=await db.from('wae_ai_model_probes').update({status,result:{...result,harness:'wae-model-probe-v73',version:V,isolated:true,production_traffic:false,provider:m.provider,model_name:m.model_name},completed_at:new Date().toISOString()}).eq('id',probeId);if(p.error)console.error('probe update',p.error.message);const au=await db.from('wae_audit_events').insert({organization_id:org,actor_type:'system',action:status==='passed'&&promotable(m)?'ai.free_model.promoted':'ai.model_probe.v73.completed',resource_type:'ai_model_probe',resource_id:probeId,severity:status==='passed'?'info':'warning',after_state:{model_id:m.id,provider:m.provider,model_name:m.model_name,status,free_mesh_promotable:promotable(m),...result,isolated:true}});if(au.error)console.error('probe audit',au.error.message);return json(200,{success:true,probed:true,probe_id:probeId,status,provider:m.provider,model_name:m.model_name,promoted:status==='passed'&&promotable(m),result,version:V})}
 if(!providerBase||!resolvedModel||(requires&&!apiKey))return await finish('configuration_missing',{error_code:'provider_not_configured'},{attempt_status:'configuration_missing',error_code:'provider_not_configured',error_message:'Provider configuration missing'},{health_status:'unknown',status:'pending_configuration',last_health_check_at:new Date().toISOString()});
 if(m.circuit_open_until&&Date.parse(m.circuit_open_until)>Date.now()&&body.force!==true)return await finish('circuit_open',{error_code:'circuit_open',circuit_open_until:m.circuit_open_until},{attempt_status:'circuit_open',error_code:'circuit_open'},{last_health_check_at:new Date().toISOString()});
 const endpoint=providerBase.endsWith('/chat/completions')?providerBase:`${providerBase.replace(/\/$/,'')}${endpointPath.startsWith('/')?endpointPath:`/${endpointPath}`}`,started=Date.now();
 try{const headers:Record<string,string>={'content-type':'application/json'};if(requires&&apiKey)headers.authorization=`Bearer ${apiKey}`;const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({model:resolvedModel,messages:[{role:'system',content:'Health probe. Return only a concise Spanish paragraph. Do not call tools or perform external actions.'},{role:'user',content:'Explica en 2 o 3 frases por qué un router empresarial de IA necesita health checks, failover, límites y observabilidad.'}],temperature:0,max_tokens:220}),signal:AbortSignal.timeout(Math.max(5000,Math.min(45000,num(c.timeout_ms,20000))))});const latency=Date.now()-started,raw=await r.text();let p:any={};try{p=JSON.parse(raw)}catch{}const usage=p?.usage||{};
 if(!r.ok){const code=r.status===429?'provider_rate_limited':r.status===401||r.status===403?'provider_auth_error':r.status===402?'provider_payment_required':r.status>=500?'provider_unavailable':'provider_request_rejected',failures=Math.max(0,num(m.consecutive_failures))+1,open=[401,402,403].includes(r.status)||failures>=3,until=open?new Date(Date.now()+Math.max(300,retryAfter(r))*1000).toISOString():null;return await finish('provider_failed',{http_status:r.status,error_code:code,retry_after_seconds:retryAfter(r)},{attempt_status:r.status===429?'rate_limited':'provider_error',http_status:r.status,error_code:code,error_message:str(p?.error?.message||raw,700),latency_ms:latency,input_tokens:num(usage.prompt_tokens),output_tokens:num(usage.completion_tokens)},{health_status:open?'offline':'degraded',consecutive_failures:failures,circuit_open_until:until,last_failure_at:new Date().toISOString(),last_health_check_at:new Date().toISOString()})}
 const text=contentOf(p);if(text.length<80){const failures=Math.max(0,num(m.consecutive_failures))+1;return await finish('provider_failed',{http_status:r.status,error_code:'probe_response_too_short',response_chars:text.length},{attempt_status:'empty_response',http_status:r.status,error_code:'probe_response_too_short',latency_ms:latency,input_tokens:num(usage.prompt_tokens),output_tokens:num(usage.completion_tokens)},{health_status:failures>=3?'offline':'degraded',consecutive_failures:failures,last_failure_at:new Date().toISOString(),last_health_check_at:new Date().toISOString()})}
 const promotion=promotable(m),meta=obj(m.metadata);const health:any={health_status:'healthy',consecutive_failures:0,circuit_open_until:null,last_success_at:new Date().toISOString(),last_health_check_at:new Date().toISOString(),status:'active'};if(promotion){health.enabled=true;health.metadata={...meta,requires_probe:false,free_mesh_promoted:true,free_mesh_promoted_at:new Date().toISOString(),free_mesh_probe_version:V,free_mesh_probe_latency_ms:latency}}return await finish('passed',{http_status:r.status,latency_ms:latency,response_chars:text.length,free_mesh_promotion:promotion},{attempt_status:'success',http_status:r.status,latency_ms:latency,input_tokens:num(usage.prompt_tokens),output_tokens:num(usage.completion_tokens)},health)
 }catch(e){const failures=Math.max(0,num(m.consecutive_failures))+1;return await finish('provider_failed',{error_code:'probe_transport_failure'},{attempt_status:'provider_error',error_code:'probe_transport_failure',error_message:e instanceof Error?e.message:'unknown',latency_ms:Date.now()-started},{health_status:failures>=3?'offline':'degraded',consecutive_failures:failures,last_failure_at:new Date().toISOString(),last_health_check_at:new Date().toISOString()})}
 }catch(e){console.error('[wae-model-probe-v73]',e);return json(500,{success:false,error:'probe_harness_internal_error',detail:e instanceof Error?e.message:'unknown',version:V})}});
