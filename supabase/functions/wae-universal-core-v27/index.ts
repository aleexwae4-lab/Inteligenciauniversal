import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION='2.0.0-universal-core-cognitive-v27';
const QUALITY_SCHEMA='universal-quality/v1';
const UPSTREAM_NAME='wae-local-voice-demo-v61';
const SUPABASE_URL=String(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const UPSTREAM=`${SUPABASE_URL}/functions/v1/${UPSTREAM_NAME}`;
const SERVICE_KEY=String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');

function bundle(key:string){try{return Object.values(JSON.parse(Deno.env.get(key)||'{}')).filter(v=>typeof v==='string'&&v.trim()) as string[]}catch{return[]}}
function publishableKey(){return bundle('SUPABASE_PUBLISHABLE_KEYS').find(x=>x.startsWith('sb_publishable_'))||String(Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'')||bundle('SUPABASE_PUBLISHABLE_KEYS')[0]||String(Deno.env.get('SUPABASE_ANON_KEY')||'')}
function allowedOrigin(origin:string|null){if(!origin)return true;try{const host=new URL(origin).hostname;return host==='localhost'||host==='127.0.0.1'||(host.endsWith('.onrender.com')&&host.includes('wae-inteligencia-universal'))||(host.endsWith('.vercel.app')&&host.includes('inteligenciauniversal'))}catch{return false}}
function cors(origin:string|null){return origin&&allowedOrigin(origin)?{'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type,apikey,x-client-info,authorization','access-control-expose-headers':'x-iu-runtime,x-iu-quality-schema,x-iu-upstream','vary':'Origin'}:{}}
function json(code:number,data:any,origin:string|null){return new Response(JSON.stringify(data),{status:code,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-iu-runtime':VERSION,'x-iu-quality-schema':QUALITY_SCHEMA,'x-iu-upstream':UPSTREAM_NAME,...cors(origin)}})}
function obj(v:any){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function text(v:any,max=50000){return typeof v==='string'?v.trim().slice(0,max):''}

const CURRENT_RX=/\b(hoy|ahora|actual(?:es|idad|izado|izada)?|reciente|últim[oa]s?|latest|today|current|news|noticias|precio|cotización|jurisprudencia|reforma|ley vigente|verifica|fuentes?|evidencia|web)\b/i;
const RESEARCH_RX=/\b(investiga|investigación|compara fuentes|mercado|competidor|benchmark|tendencia|estadística)\b/i;
const CODE_RX=/```|\b(código|programa(?:r|ción)?|typescript|javascript|python|sql|api|backend|frontend|debug|bug|refactor|github|deploy|supabase|render|vercel)\b/i;
const DESIGN_RX=/\b(diseñ|ux|ui|interfaz|experiencia|flujo|pantalla|responsive|móvil|branding|producto visual)\b/i;
const ANALYSIS_RX=/\b(analiza|análisis|audita|diagnóstico|estrategia|riesgo|finanzas|roi|prioridad|decisión|compara|arquitectura)\b/i;

function inferMode(message:string,requested:string){const m=String(requested||'general').toLowerCase();if(['research','code','analysis','design','executive'].includes(m))return m;if(RESEARCH_RX.test(message)||CURRENT_RX.test(message))return'research';if(CODE_RX.test(message))return'code';if(DESIGN_RX.test(message))return'design';if(ANALYSIS_RX.test(message))return'analysis';return'general'}
function shouldResearch(message:string,mode:string,explicit:boolean){return explicit||mode==='research'||CURRENT_RX.test(message)||RESEARCH_RX.test(message)}

const STOP=new Set('que qué como cómo para por con sin una uno unos unas del las los el la y o de en es son ser se su sus al un ya más mas muy este esta estos estas esto esa ese esos esas mi mis tu tus lo le les nos me te a e u si no pero sobre entre desde hasta where what how why when who which the and or for with without from into this that these those your you our are is be was were'.split(/\s+/));
function words(value:string){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(w=>!STOP.has(w))||[]}
function unique<T>(xs:T[]){return[...new Set(xs)]}
function sentenceRepeat(answer:string){const parts=answer.split(/[.!?]\s+/).map(x=>x.trim().toLowerCase()).filter(x=>x.length>35);if(parts.length<3)return 0;return 1-(new Set(parts).size/parts.length)}
function requestedCount(q:string){const m=q.match(/\b(\d{1,2})\s+(?:puntos|pasos|ideas|opciones|claves|razones|recomendaciones)\b/i);if(m)return Math.min(10,Math.max(1,Number(m[1])));const named:{[k:string]:number}={dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};for(const[k,v]of Object.entries(named))if(new RegExp(`\\b${k}\\s+(?:puntos|pasos|ideas|opciones|claves|razones|recomendaciones)\\b`,'i').test(q))return v;return 0}
function qualityGate(question:string,answer:string,meta:any={}){
  const q=String(question||'').trim(),a=String(answer||'').trim(),reasons:string[]=[];
  const failure=/no pude completar|vuelve a intentarlo|no puedo responder|all_models_unavailable|continuity_pass_through|runtime unavailable|generation failed|respuesta no llegó completa/i.test(a);
  const leak=/Language Policy|RELEVANT MEMORY|system_guidance|Role:\s*Advanced|chain[- ]of[- ]thought|hidden reasoning/i.test(a);
  if(failure)reasons.push('failure_phrase');if(leak)reasons.push('internal_leak');if(!a)reasons.push('empty');
  const qWords=unique(words(q)).slice(0,18),aWords=new Set(words(a));
  const overlap=qWords.length?Math.min(1,qWords.filter(w=>aWords.has(w)).length/Math.min(6,qWords.length)):1;
  const shortQuestion=q.length<55;
  const relevance=shortQuestion?Math.max(.72,overlap):Math.max(.25,overlap);
  const target=q.length>700?650:q.length>240?420:q.length>90?260:90;
  const lengthScore=Math.min(1,a.length/target);
  const wanted=requestedCount(q),listCount=(a.match(/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+/g)||[]).length;
  let structure=.86;if(wanted)structure=Math.min(1,listCount/Math.max(1,wanted));else if(/\b(tabla|table)\b/i.test(q))structure=/\|.+\|/.test(a)?1:.35;else if(CODE_RX.test(q))structure=/```[\s\S]+```/.test(a)?1:.55;
  let evidence=.9;const research=meta.research===true||meta.mode==='research';const sources=Array.isArray(meta.sources)?meta.sources:[];if(research){if(sources.length){const cited=/\[W\d+\]/i.test(a);evidence=cited?1:.68}else evidence=.58}
  const repeat=sentenceRepeat(a);if(repeat>.34)reasons.push('repetition');
  let score=.32*relevance+.26*lengthScore+.18*structure+.14*evidence+.10*(1-Math.min(1,repeat));
  if(failure)score=Math.min(score,.08);if(leak)score=0;if(!a)score=0;
  score=Math.max(0,Math.min(1,score));
  if(relevance<.45)reasons.push('low_relevance');if(lengthScore<.45)reasons.push('too_short');if(structure<.6)reasons.push('requested_structure_missing');if(research&&evidence<.65)reasons.push('insufficient_evidence');
  return{schema:QUALITY_SCHEMA,score:Number(score.toFixed(3)),pass:score>=.68,critical:score<.42,reasons,signals:{relevance:Number(relevance.toFixed(3)),length:Number(lengthScore.toFixed(3)),structure:Number(structure.toFixed(3)),evidence:Number(evidence.toFixed(3)),repetition:Number(repeat.toFixed(3))}};
}

function upstreamHeaders(req:Request,origin:string|null){const key=publishableKey();return{'content-type':'application/json','apikey':key,'origin':origin||'https://wae-inteligencia-universal.onrender.com','x-client-info':`wae-universal-core-v27/${VERSION}`,'user-agent':req.headers.get('user-agent')||'WAE-Universal-Core-v27'}}
async function callUpstream(req:Request,body:any,origin:string|null,timeoutMs=60000){const response=await fetch(UPSTREAM,{method:'POST',headers:upstreamHeaders(req,origin),body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs)});const raw=await response.text();let payload:any={};try{payload=raw?JSON.parse(raw):{}}catch{payload={success:false,error:'upstream_non_json',raw:raw.slice(0,1000)}}return{status:response.status,payload,headers:response.headers}}
function needsRetry(status:number,p:any){if(status>=500)return true;if(p?.success===false&&/all_models_unavailable|verified_stream_unavailable|timeout|provider|circuit|runtime/i.test(String(p?.error||p?.message||'')))return true;return false}

async function recordQuality(sessionId:string,requestId:string,quality:any,extra:any){if(!SERVICE_KEY||!sessionId||!requestId)return;try{const db=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});const current=(await db.from('iu_request_traces').select('metadata').eq('request_id',requestId).eq('session_id',sessionId).maybeSingle()).data;if(!current)return;await db.from('iu_request_traces').update({metadata:{...obj(current.metadata),quality_gate:quality,cognitive_runtime:VERSION,...extra}}).eq('request_id',requestId).eq('session_id',sessionId)}catch(e){console.error('quality_trace',e)}}

async function proxyStream(req:Request,body:any,origin:string|null){const mode=inferMode(text(body.message,24000),text(body.mode,20)||'general');const enhanced={...body,mode,web_enabled:shouldResearch(text(body.message,24000),mode,body.web_enabled===true),routing_variant:body.routing_variant||'candidate'};const upstream=await fetch(UPSTREAM,{method:'POST',headers:upstreamHeaders(req,origin),body:JSON.stringify(enhanced),signal:req.signal});const h=new Headers(upstream.headers);h.set('x-iu-runtime',VERSION);h.set('x-iu-quality-schema',QUALITY_SCHEMA);h.set('x-iu-upstream',UPSTREAM_NAME);for(const[k,v]of Object.entries(cors(origin)))h.set(k,v);return new Response(upstream.body,{status:upstream.status,headers:h})}

Deno.serve(async(req:Request)=>{
  const origin=req.headers.get('origin');
  if(req.method==='OPTIONS')return allowedOrigin(origin)?new Response(null,{status:204,headers:cors(origin)}):json(403,{success:false,error:'origin_denied'},origin);
  if(req.method!=='POST'||!allowedOrigin(origin))return json(403,{success:false,error:'denied'},origin);
  const key=publishableKey(),supplied=String(req.headers.get('apikey')||'');
  if(!key||supplied!==key)return json(401,{success:false,error:'invalid_application_key'},origin);
  const body=obj(await req.json().catch(()=>({}))),action=text(body.action,30).toLowerCase()||'chat';
  try{
    if(action==='chat'&&body.stream===true)return proxyStream(req,body,origin);
    const q=text(body.message,24000),mode=inferMode(q,text(body.mode,20)||'general'),research=shouldResearch(q,mode,body.web_enabled===true);
    const enhanced=action==='chat'?{...body,mode,web_enabled:research,routing_variant:body.routing_variant||'candidate'}:body;
    let first=await callUpstream(req,enhanced,origin,action==='chat'?60000:30000),attempt=1;
    if(action==='chat'&&needsRetry(first.status,first.payload)){
      const alternate={...enhanced,routing_variant:enhanced.routing_variant==='control'?'candidate':'control'};
      first=await callUpstream(req,alternate,origin,60000);attempt=2;
    }
    if(action==='capabilities'||action==='health'){
      return json(first.status,{...first.payload,cognitive_runtime:VERSION,quality_schema:QUALITY_SCHEMA,cognitive_quality_gate:true,automatic_research:true,adaptive_failover:true,adaptive_candidate_default:true,quality_rejection_threshold:.42},origin)
    }
    if(action!=='chat')return json(first.status,first.payload,origin);
    const reply=text(first.payload?.reply||first.payload?.response?.content,50000),quality=qualityGate(q,reply,{research,mode,sources:first.payload?.web_sources||first.payload?.response?.sources||[]});
    const requestId=text(first.payload?.request_id||first.payload?.response?.metadata?.requestId,80),sid=text(body.session_id,80);
    await recordQuality(sid,requestId,quality,{auto_research:research,inferred_mode:mode,retry_count:attempt-1});
    const response=first.payload?.response&&typeof first.payload.response==='object'?{...first.payload.response,metadata:{...obj(first.payload.response.metadata),cognitiveRuntime:VERSION,qualityGate:quality,autoResearch:research,retryCount:attempt-1}}:first.payload?.response;
    const output={...first.payload,response,runtime:VERSION,cognitive_quality:quality,smart_routing:{mode,auto_research:research,retry_count:attempt-1,variant:enhanced.routing_variant||'candidate'}};
    if(quality.critical&&first.status<500)return json(503,{success:false,error:'quality_gate_rejected',message:'La respuesta no alcanzó el estándar mínimo de calidad y fue bloqueada antes de mostrarse.',recoverable:true,request_id:requestId,cognitive_quality:quality},origin);
    return json(first.status,output,origin)
  }catch(e:any){console.error('v27',e);return json(503,{success:false,error:'cognitive_runtime_unavailable',message:'El núcleo cognitivo no completó esta ruta; el cliente puede usar la ruta redundante.',recoverable:true},origin)}
});
