import {a,o,s,nowIso,cleanOutput,CANARY_PCT} from './common.ts';

const simpleRx=/^\s*(hola|hey|buen(?:os|as)?\s+(?:d[ií]as|tardes|noches)|gracias|ok|vale|perfecto|listo|qu[eé] tal)[!?.\s]*$/i;
const riskRx=/\b(m[eé]dic|medical|diagn[oó]stic|tratamiento|dosis|legal|jur[ií]dic|penal|delito|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude|seguridad cr[ií]tica|alto riesgo|high[- ]risk)\b/i;
const codeRx=/```|\b(c[oó]digo|programa(?:r|ci[oó]n)?|typescript|javascript|python|sql|api|debug|bug|refactor|funci[oó]n|clase|github|deploy)\b/i;
const researchRx=/\b(investiga|investigaci[oó]n|fuentes?|citas?|buscar en (?:la )?web|web research|latest|actualizado|verifica|evidencia)\b/i;
const analysisRx=/\b(analiza|an[aá]lisis|compara|eval[uú]a|diagn[oó]stico|riesgo|trade[- ]?off|causa|estrategia|plan)\b/i;
const structuredRx=/\b(json|csv|tabla|estructur|extrae|clasifica|columnas?|filas?|dataset|datos)\b/i;
const creativeRx=/\b(crea|dise[nñ]a|copy|historia|guion|slogan|marca|branding|creativo)\b/i;
const enterpriseRx=/\b(empresa|negocio|saas|finanzas|ventas|operaciones|kpi|ebitda|cfo|ceo|cto|rrhh|recursos humanos|compliance|auditor[ií]a)\b/i;
const factualRx=/^\s*(qu[eé]|qui[eé]n|cu[aá]l|cu[aá]nto|d[oó]nde|cu[aá]ndo|define|explica)\b/i;
const RESCUE_PROVIDER='wae_deterministic_rescue';

export function classifyTask(q:string,mode='general',attachments:any[]=[]){
  q=String(q||'').trim();const files=a(attachments).length>0;let category='analysis';
  if(riskRx.test(q))category='high_risk';else if(files)category='document_analysis';else if(mode==='research'||researchRx.test(q))category='web_research';else if(mode==='code'||codeRx.test(q))category='coding';else if(structuredRx.test(q))category='structured_data';else if(creativeRx.test(q)||mode==='design')category='creative';else if(enterpriseRx.test(q)||mode==='executive')category='enterprise';else if(simpleRx.test(q)||q.length<=24)category='simple_chat';else if(factualRx.test(q)&&q.length<180)category='factual';else if(analysisRx.test(q)||mode==='analysis')category='analysis';else if(q.length>900)category='reasoning';else category='factual';
  const path=['simple_chat','factual'].includes(category)?'FAST':['high_risk','web_research','reasoning'].includes(category)?'DEEP':'STANDARD';
  return{category,path,risk:category==='high_risk'?'high':path==='DEEP'?'medium':'low',complexity:path==='FAST'?'low':path==='STANDARD'?'medium':'high'};
}

export function requirements(task:any,mode='general',webEnabled=false,attachments:any[]=[],streamRequested=false){
  const files=a(attachments).length>0;
  return{reasoning:task.path==='DEEP'?'high':task.path==='STANDARD'?'medium':'low',web:webEnabled===true||mode==='research'||task.category==='web_research',tools:task.category==='tool_execution',vision:task.category==='multimodal',files:files||task.category==='document_analysis',rag:files||task.category==='document_analysis',structured_output:['structured_data','coding','enterprise','analysis','high_risk'].includes(task.category),context_window:files?32768:task.path==='DEEP'?32768:8192,latency_priority:task.path==='FAST'?'high':task.path==='STANDARD'?'medium':'low',risk:task.risk,streaming:streamRequested===true};
}

function evalCapability(task:any,q:string){if(task.category==='coding')return'code';if(task.category==='web_research')return'research';if(task.category==='enterprise')return/ventas|sales/i.test(q)?'sales':/legal|jur/i.test(q)?'legal_reasoning':'strategy';if(task.category==='high_risk'&&/legal|jur/i.test(q))return'legal_reasoning';return'general_reasoning'}
function n(v:any,f=50){const x=Number(v);return Number.isFinite(x)?x:f}
const latScore=(ms:any)=>Number.isFinite(Number(ms))?Math.max(0,100-Math.min(100,Number(ms)/120)):50;
const ttftScore=(ms:any)=>Number.isFinite(Number(ms))?Math.max(0,100-Math.min(100,Number(ms)/40)):50;
function weights(path:string){if(path==='FAST')return{q:.18,r:.30,l:.23,t:.17,c:.07,m:.05};if(path==='DEEP')return{q:.40,r:.25,l:.07,t:.04,c:.04,m:.20};return{q:.30,r:.25,l:.16,t:.09,c:.05,m:.15}}
function costScore(m:any){const cp=o(m.cost_profile),i=Number(cp.input_per_million),x=Number(cp.output_per_million);if(i===0&&x===0)return 100;if(!Number.isFinite(i)||!Number.isFinite(x))return 55;return Math.max(0,100-Math.min(100,(i+x)*12))}
function failureDebt(m:any){const x=Number(m.consecutive_failures);return Number.isFinite(x)?Math.max(0,x):0}
function failurePenalty(m:any){return Math.min(32,Math.log2(failureDebt(m)+1)*5)}

export function streamEligible(m:any){
  if(!m.streaming_claimed)return false;
  if(m.streaming_verified)return true;
  const probes=Number(m.streaming_probe_count||0),lastFail=Date.parse(String(m.last_stream_failure_at||''));
  if(probes===0||!Number.isFinite(lastFail))return true;
  const health=String(m.effective_health||m.registry_health||'unknown').toLowerCase();
  const cooldownMs=health==='healthy'?20*60000:health==='unknown'?60*60000:120*60000;
  return Date.now()-lastFail>cooldownMs;
}
function capabilityMatch(m:any,req:any){if(req.risk==='high'&&m.supports_sensitive_data!==true)return 0;if(req.vision&&!m.vision_capable)return 0;if(req.tools&&!m.tools_capable)return 0;if(req.streaming&&!streamEligible(m))return 0;if(req.context_window&&Number(m.context_window||0)<Number(req.context_window))return 0;let z=100;if(req.reasoning==='high'&&!m.reasoning_capable)z-=25;if(req.structured_output&&!m.structured_output_capable)z-=8;if(req.streaming&&m.streaming_verified)z+=8;return Math.max(0,Math.min(108,z))}
function scoreModel(m:any,task:any,req:any,specific:any){const cap=capabilityMatch(m,req);if(cap<=0)return{...m,eligible:false,score:-999};const quality=n(specific?.quality_score??m.eval_score??m.quality_score??m.reputation_score,70),reliability=n(m.reliability_score??specific?.reliability_score??m.reputation_reliability_score,60),w=weights(task.path);let score=quality*w.q+reliability*w.r+latScore(m.ewma_latency_ms)*w.l+ttftScore(m.ewma_ttft_ms)*w.t+costScore(m)*w.c+cap*w.m;const health=String(m.effective_health||m.registry_health||'unknown').toLowerCase();if(health==='degraded')score-=12;if(health==='unknown')score-=5;if(m.circuit_state==='HALF_OPEN')score-=25;score-=failurePenalty(m);const minimum=task.path==='FAST'?65:task.path==='DEEP'?78:70,sufficient=quality>=minimum&&reliability>=45;if(!sufficient)score-=20;return{...m,eligible:true,quality,reliability,sufficient,failure_debt:failureDebt(m),score:Number(score.toFixed(3))}}
function canInvoke(m:any){const c=o(m.capabilities),base=s(c.base_url)||s(Deno.env.get(s(c.base_url_env)||'WAE_AI_BASE_URL')),key=s(Deno.env.get(s(c.api_key_env)||'WAE_AI_API_KEY'));if(c.runtime==='browser')return false;return!!base&&!!m.model_name&&(c.requires_api_key===false||!!key)}
function placeRescueLast(primary:any[],rescue:any[]){if(!rescue.length)return primary;const fallback={...rescue[0],score:-1,rescue_only:true};return[...primary.slice(0,5),fallback,...primary.slice(5)]}

export async function registry(db:any,task:any,q:string){const cap=evalCapability(task,q);const[{data:models},{data:rep}]=await Promise.all([db.from('iu_adaptive_model_registry_v2').select('*').eq('enabled',true).in('access_tier',['FREE','TRIAL','LOCAL']),db.from('wae_provider_capability_reputation_v1').select('provider,model,quality_score,reliability_score,reputation_score,confidence_score,samples').eq('capability',cap)]);const map=new Map((rep||[]).map((x:any)=>[`${x.provider}::${x.model}`,x]));return(models||[]).filter(canInvoke).map((m:any)=>({...m,specific:map.get(`${m.provider}::${m.model_name}`)||null}))}

export function rank(reg:any[],task:any,req:any,variant='candidate'){
  let list=reg.filter((m:any)=>m.circuit_state!=='OPEN'&&m.effective_health!=='offline'&&capabilityMatch(m,req)>0);
  if(req.streaming)list=list.filter(streamEligible);
  const rescue=list.filter((m:any)=>m.provider===RESCUE_PROVIDER),primary=list.filter((m:any)=>m.provider!==RESCUE_PROVIDER);
  if(variant==='control'){
    const ordered=primary.sort((x:any,y:any)=>Number(x.priority)-Number(y.priority)).map((x:any)=>({...x,score:null}));
    return placeRescueLast(ordered,rescue);
  }
  const ranked=primary.map((m:any)=>scoreModel(m,task,req,m.specific)).filter((x:any)=>x.eligible).sort((x:any,y:any)=>y.score-x.score);
  const preferred=ranked.filter((x:any)=>x.sufficient&&x.circuit_state==='CLOSED');
  const preferredSet=new Set(preferred);
  const closedFallbacks=ranked.filter((x:any)=>x.circuit_state==='CLOSED'&&!preferredSet.has(x));
  const halfOpenFallbacks=ranked.filter((x:any)=>x.circuit_state==='HALF_OPEN');
  const known=new Set([...preferred,...closedFallbacks,...halfOpenFallbacks]);
  const remaining=ranked.filter((x:any)=>!known.has(x));
  return placeRescueLast([...preferred,...closedFallbacks,...halfOpenFallbacks,...remaining],rescue);
}

function hashPct(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return Math.abs(h)%100}
export function variant(body:any,sid:string){const forced=s(body.routing_variant,20).toLowerCase();if(['candidate','control'].includes(forced))return forced;return hashPct(sid)<CANARY_PCT?'candidate':'control'}
export function actualModel(m:any){const c=o(m.capabilities);return String(m.model_name||'').startsWith('env:')?s(Deno.env.get(s(c.model_env)||'WAE_AI_MODEL')):s(m.model_name)}
function modelUrl(m:any){const c=o(m.capabilities),base=s(c.base_url)||s(Deno.env.get(s(c.base_url_env)||'WAE_AI_BASE_URL')),path=s(c.endpoint_path)||'/chat/completions';return base.endsWith('/chat/completions')?base:`${base.replace(/\/$/,'')}${path}`}
function headers(m:any){const c=o(m.capabilities),key=s(Deno.env.get(s(c.api_key_env)||'WAE_AI_API_KEY')),h:any={'content-type':'application/json'};if(key)h.authorization=`Bearer ${key}`;return h}
function outputText(p:any,raw:string){return cleanOutput(typeof p?.choices?.[0]?.message?.content==='string'?p.choices[0].message.content:typeof p?.output_text==='string'?p.output_text:raw)}
function transportError(code:string,status=0){const e:any=new Error(code);e.status=status;e.transportOnly=true;e.transportCode=code;return e}

export async function invoke(m:any,msgs:any[],opts:any={}){const started=Date.now(),body:any={model:actualModel(m),messages:msgs,temperature:.15,max_tokens:Math.min(3200,Number(m.max_output_tokens)||2200)};if(opts.stream)body.stream=true;const timeout=AbortSignal.timeout(Math.min(45000,Number(o(m.capabilities).timeout_ms)||35000)),signal=opts.signal?AbortSignal.any([opts.signal,timeout]):timeout,r=await fetch(modelUrl(m),{method:'POST',headers:headers(m),body:JSON.stringify(body),signal});if(!r.ok){const raw=await r.text().catch(()=>''),e:any=new Error(`http_${r.status}:${raw.slice(0,180)}`);e.status=r.status;throw e}const ct=(r.headers.get('content-type')||'').toLowerCase();if(!opts.stream){const raw=await r.text(),p=(()=>{try{return JSON.parse(raw)}catch{return{}}})(),text=outputText(p,raw);if(!text)throw new Error('unsafe_or_empty');const u=o(p.usage),lat=Date.now()-started;return{text,ttft_ms:null,latency_ms:lat,input_tokens:Number(u.prompt_tokens??u.input_tokens)||null,output_tokens:Number(u.completion_tokens??u.output_tokens)||null,streamed:false,provider_request_at:started}}if(!ct.includes('text/event-stream')||!r.body)throw transportError('stream_unsupported');const reader=r.body.getReader(),dec=new TextDecoder();let buf='',text='',first:number|null=null,usage:any=null,internal=false,deltaCount=0;while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let idx;while((idx=buf.indexOf('\n'))>=0){const line=buf.slice(0,idx).trim();buf=buf.slice(idx+1);if(!line.startsWith('data:'))continue;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')continue;let p:any;try{p=JSON.parse(raw)}catch{continue}usage=p?.usage||usage;let delta=p?.choices?.[0]?.delta?.content;if(Array.isArray(delta))delta=delta.map((x:any)=>typeof x==='string'?x:(x?.text||'')).join('');if(typeof delta!=='string'||!delta)continue;if(/<(?:analysis|reasoning|thoughts?)\b/i.test(delta))internal=true;if(internal){if(/<\/(?:analysis|reasoning|thoughts?)>/i.test(delta))internal=false;continue}if(!first)first=Date.now();deltaCount++;text+=delta;opts.onDelta?.(delta,first-started)}}if(!first||deltaCount<1)throw transportError('stream_no_deltas');const final=cleanOutput(text);if(!final)throw new Error('unsafe_or_empty');return{text:final,ttft_ms:first-started,latency_ms:Date.now()-started,input_tokens:Number(usage?.prompt_tokens??usage?.input_tokens)||null,output_tokens:Number(usage?.completion_tokens??usage?.output_tokens)||null,streamed:true,provider_request_at:started,delta_count:deltaCount}}

function errorClass(status:number,msg:string){if(status===401||status===403)return'auth';if(status===429)return'rate_limit';if(status>=500)return'server';if(/timeout|timed out|abort/i.test(msg))return'timeout';return'other'}
async function markTransportFailure(db:any,m:any,reason:string){const now=nowIso(),probes=Number(m.streaming_probe_count||0)+1,fails=Number(m.streaming_failure_count||0)+1;await db.from('iu_model_transport_capabilities_v1').upsert({provider:m.provider,model_name:m.model_name,streaming_verified:false,probe_count:probes,streaming_failure_count:fails,streaming_success_count:Number(m.streaming_success_count||0),last_probe_at:now,last_stream_failure_at:now,last_failure_reason:s(reason,160),metadata:{source:'adaptive-router-v22'},updated_at:now},{onConflict:'provider,model_name'})}
export async function markFailure(db:any,m:any,e:any){if(e?.transportOnly){await markTransportFailure(db,m,e.transportCode||e.message||'stream_transport_failure');return'stream_transport'}const status=Number(e?.status)||Number(String(e?.message||'').match(/http_(\d+)/)?.[1])||0,cls=errorClass(status,String(e?.message||e)),fails=Math.min(32767,Number(m.consecutive_failures||0)+1);let mins=0;if(cls==='auth')mins=60;else if(cls==='rate_limit')mins=10;else if(['timeout','server'].includes(cls)&&fails>=3)mins=10;const open=mins?new Date(Date.now()+mins*60000).toISOString():null;await Promise.allSettled([db.from('wae_ai_models').update({consecutive_failures:fails,last_failure_at:nowIso(),health_status:'degraded',circuit_open_until:open}).eq('provider',m.provider).eq('model_name',m.model_name).is('organization_id',null),db.from('wae_provider_reliability_ledger_v1').upsert({provider:m.provider,model:m.model_name,consecutive_failures:fails,consecutive_successes:0,open_until:open,last_failure_at:nowIso(),last_error_class:cls,score_snapshot:Math.max(0,Number(m.reliability_score||60)-10),health_snapshot:'degraded',updated_at:nowIso(),expires_at:new Date(Date.now()+86400000).toISOString()},{onConflict:'provider,model'})]);return cls}
export async function markSuccess(db:any,m:any,latency:number,ttft:any,streamed=false){
  const oldL=Number(m.ewma_latency_ms),ewmaL=Number.isFinite(oldL)?Math.round(oldL*.8+latency*.2):latency;
  const ledger:any={provider:m.provider,model:m.model_name,consecutive_failures:0,consecutive_successes:Math.min(32767,Number(m.consecutive_successes||0)+1),ewma_latency_ms:ewmaL,open_until:null,last_success_at:nowIso(),last_error_class:'',score_snapshot:Math.min(100,Math.max(60,Number(m.reliability_score||80)+2)),health_snapshot:'healthy',updated_at:nowIso(),expires_at:new Date(Date.now()+86400000).toISOString()};
  if(streamed&&Number.isFinite(Number(ttft))){const oldT=Number(m.ewma_ttft_ms),last=Date.parse(String(m.last_stream_success_at||'')),freshBaseline=Number.isFinite(last)&&Date.now()-last<30*60000;ledger.ewma_ttft_ms=freshBaseline&&Number.isFinite(oldT)?Math.round(oldT*.65+Number(ttft)*.35):Number(ttft)}
  const ops:any[]=[db.from('wae_ai_models').update({consecutive_failures:0,last_success_at:nowIso(),health_status:'healthy',circuit_open_until:null}).eq('provider',m.provider).eq('model_name',m.model_name).is('organization_id',null),db.from('wae_provider_reliability_ledger_v1').upsert(ledger,{onConflict:'provider,model'})];
  if(streamed){const now=nowIso();ops.push(db.from('iu_model_transport_capabilities_v1').upsert({provider:m.provider,model_name:m.model_name,streaming_verified:true,probe_count:Number(m.streaming_probe_count||0)+1,streaming_success_count:Number(m.streaming_success_count||0)+1,streaming_failure_count:Number(m.streaming_failure_count||0),ewma_ttft_ms:ledger.ewma_ttft_ms??Number(ttft),last_ttft_ms:Number(ttft),last_probe_at:now,last_stream_success_at:now,last_failure_reason:null,metadata:{source:'adaptive-router-v22',delta_verified:true,fresh_ttft:true},updated_at:now},{onConflict:'provider,model_name'}))}
  await Promise.allSettled(ops)
}
export function estimateCost(m:any,inputTokens:any,outputTokens:any){const cp=o(m?.cost_profile),ir=Number(cp.input_per_million),or=Number(cp.output_per_million);if(!Number.isFinite(ir)||!Number.isFinite(or))return null;return Math.round((((Number(inputTokens)||0)/1e6)*ir+((Number(outputTokens)||0)/1e6)*or)*1e6)}
