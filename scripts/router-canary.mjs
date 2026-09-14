import {writeFile} from 'node:fs/promises';
const EDGE=process.env.EDGE_URL||'https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61';
const BASELINE=10019;
const post=async body=>{const r=await fetch(EDGE,{method:'POST',headers:{'content-type':'application/json','x-client-info':'wae-ci-canary/1.0'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${body.action||'chat'}_${r.status}_${d.error||'error'}`);return d};
const boot=await post({action:'bootstrap'});const auth={session_id:boot.session_id,session_secret:boot.session_secret};
if(boot.version!=='1.6.0-adaptive-router-stream-v1')throw new Error(`unexpected_runtime_${boot.version}`);
const preview=await post({action:'route_preview',...auth,message:'Hola',mode:'general',routing_variant:'candidate'});
if(preview.task?.path!=='FAST')throw new Error('simple_not_fast');
if((preview.candidates||[]).some(x=>x.provider==='wae_cognitive_fusion'))throw new Error('offline_provider_not_excluded');
if(preview.candidates?.[0]?.circuit==='OPEN')throw new Error('open_circuit_selected');
const deep=await post({action:'route_preview',...auth,message:'Investiga con fuentes verificables un riesgo legal crítico y contrasta evidencia.',mode:'research',web_enabled:true,routing_variant:'candidate'});
if(deep.task?.path!=='DEEP')throw new Error('research_not_deep');

function eventBlock(raw){let event='message',data='';for(const line of raw.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data+=(data?'\n':'')+line.slice(5).trim()}if(!data)return null;try{return{event,data:JSON.parse(data)}}catch{return null}}
async function streamOne(message,variant='candidate',mode='general'){
  const started=performance.now(),firstAt=new Date();let first=null,complete=null,buffer='',events=new Set(),deltaChars=0;
  const r=await fetch(EDGE,{method:'POST',headers:{'content-type':'application/json','x-client-info':'wae-ci-canary/1.0'},body:JSON.stringify({action:'chat',...auth,message,mode,web_enabled:mode==='research',stream:true,routing_variant:variant})});
  if(!r.ok||!r.body)throw new Error(`stream_http_${r.status}`);const reader=r.body.getReader(),dec=new TextDecoder();
  while(true){const{done,value}=await reader.read();if(done)break;buffer+=dec.decode(value,{stream:true});let i;while((i=buffer.indexOf('\n\n'))>=0){const b=buffer.slice(0,i);buffer=buffer.slice(i+2);const e=eventBlock(b);if(!e)continue;events.add(e.event);if(e.event==='content.delta'){deltaChars+=String(e.data?.text||'').length;if(first===null)first=performance.now()-started}else if(e.event==='response.complete')complete=e.data;else if(e.event==='response.error')throw new Error(`stream_event_${e.data?.error||'error'}`)}}
  const total=performance.now()-started;if(first===null||!complete)throw new Error('incomplete_stream');
  for(const required of ['response.start','content.delta','response.complete'])if(!events.has(required))throw new Error(`missing_${required}`);
  if(complete.response?.schema!=='assistant-response/v1')throw new Error('schema_regression');
  if(!complete.provider||!complete.model)throw new Error('missing_provider');
  await post({action:'client_metric',...auth,request_id:complete.request_id,client_ttft_ms:Math.round(first),client_first_token_at:new Date(firstAt.getTime()+first).toISOString()}).catch(()=>{});
  return{variant,provider:complete.provider,model:complete.model,path:complete.routing_path,task:complete.task_category,client_ttft_ms:Math.round(first),provider_ttft_ms:Number(complete.ttft_ms)||null,total_ms:Math.round(total),server_total_ms:Number(complete.latency_ms)||null,router_overhead_ms:Number(complete.router_overhead_ms)||null,cost_microunits:complete.cost_microunits??null,delta_chars:deltaChars,events:[...events]};
}
const candidatePrompts=['Hola','Responde solamente: OK','¿Qué es una API?','Resume en una frase qué significa SaaS.','Dime cuánto es 7 por 8.'];
const candidate=[];for(const q of candidatePrompts)candidate.push(await streamOne(q,'candidate','general'));
const control=[];for(const q of ['Hola','Responde solamente: OK'])control.push(await streamOne(q,'control','general'));
const pct=(arr,p)=>{const a=[...arr].sort((x,y)=>x-y);if(!a.length)return null;return a[Math.min(a.length-1,Math.max(0,Math.ceil(p*a.length)-1))]};
const summarize=rows=>({samples:rows.length,p50_ttft_ms:pct(rows.map(x=>x.client_ttft_ms),.5),p95_ttft_ms:pct(rows.map(x=>x.client_ttft_ms),.95),p50_total_ms:pct(rows.map(x=>x.total_ms),.5),p95_total_ms:pct(rows.map(x=>x.total_ms),.95),providers:[...new Set(rows.map(x=>`${x.provider}/${x.model}`))]});
const result={runtime:boot.version,router:preview.router,baseline_total_ms:BASELINE,selected_fast:preview.candidates?.[0]||null,candidate:summarize(candidate),control:summarize(control),candidate_rows:candidate,control_rows:control};
result.promotion_gate={offline_excluded:!(preview.candidates||[]).some(x=>x.provider==='wae_cognitive_fusion'),streaming_real:candidate.every(x=>x.events.includes('content.delta')),assistant_response_v1:true,error_rate:0,p50_beats_baseline:result.candidate.p50_total_ms<BASELINE,p95_ttft_below_baseline:result.candidate.p95_ttft_ms<BASELINE,pass:false};
result.promotion_gate.pass=Object.values(result.promotion_gate).every(v=>v===true||v===0);
console.log(JSON.stringify(result,null,2));await writeFile('router-canary-metrics.json',JSON.stringify(result,null,2));if(!result.promotion_gate.pass)process.exitCode=1;
