import { createHash } from 'node:crypto';

export const ADAPTIVE_LEARNING_LOOP_VERSION='adaptive-learning-loop/v1';
const TABLE='wae_adaptive_learning_v1';
const TTL_MS=30_000;
const cache=new Map();
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const text=(v,max)=>String(v??'').replace(/[\u0000\r\n\t]+/g,' ').trim().slice(0,max);
const configured=()=>Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
const normalizeCategory=v=>text(v,64).toLowerCase().replace(/[- ]+/g,'_')||'default';
const normalizeStrategy=v=>text(v,80).toLowerCase().replace(/[^a-z0-9_+-]+/g,'_')||'standard_quality';
function normalizeRow(row={}){
 const attempts=Math.max(0,Number(row.attempts)||0), successes=Math.max(0,Number(row.successes)||0), failures=Math.max(0,Number(row.failures)||0);
 const qualitySum=Math.max(0,Number(row.quality_sum)||0), latencySum=Math.max(0,Number(row.latency_sum_ms)||0);
 return {category:normalizeCategory(row.category),strategy:normalizeStrategy(row.strategy),attempts,successes:Math.min(successes,attempts),failures:Math.min(failures,attempts),qualitySum,latencySum,successRate:attempts?Number((successes/attempts).toFixed(4)):null,meanQuality:attempts?Number((qualitySum/attempts).toFixed(4)):null,meanLatencyMs:attempts?Math.round(latencySum/attempts):null,sampleCount:attempts,lastObservedAt:row.last_observed_at||null};
}
function score(row){const n=normalizeRow(row);if(n.attempts<3)return 0.5;const reliability=n.successRate??0,quality=n.meanQuality??0,latency=n.meanLatencyMs?1/(1+Math.log10(Math.max(10,n.meanLatencyMs))/10):0.5;return Number((0.45*reliability+0.45*quality+0.10*latency).toFixed(4));}
export function buildLearningSnapshot(rows=[]){
 const byCategory={};
 for(const row of (Array.isArray(rows)?rows:[]).map(normalizeRow)){(byCategory[row.category]??=[]).push({...row,selectionScore:score(row)});}
 for(const category of Object.keys(byCategory))byCategory[category].sort((a,b)=>b.selectionScore-a.selectionScore||b.sampleCount-a.sampleCount||a.strategy.localeCompare(b.strategy));
 return {version:ADAPTIVE_LEARNING_LOOP_VERSION,categories:byCategory,policy:{minSamplesForPreference:3,explorationRate:0.20,boundedUpdates:true,aggregateOnly:true,rawAnswersPersisted:false,clientFeedbackTrusted:false,competitorDataPersisted:false,baseModelWeightsChanged:false}};
}
export async function readAdaptiveLearning({category='default',fetchImpl=globalThis.fetch,env=process.env}={}){
 const c=normalizeCategory(category),cached=cache.get(c),now=Date.now();
 if(cached&&cached.expiresAt>now)return cached.value;
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||typeof fetchImpl!=='function')return null;
 try{const base=String(env.SUPABASE_URL).replace(/\/$/,'');const url=base+'/rest/v1/'+TABLE+'?category=eq.'+encodeURIComponent(c)+'&select=category,strategy,attempts,successes,failures,quality_sum,latency_sum_ms,last_observed_at&limit=32';const res=await fetchImpl(url,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},signal:AbortSignal.timeout(2500)});if(!res.ok)return null;const rows=await res.json();const value=buildLearningSnapshot(rows).categories[c]||[];cache.set(c,{value,expiresAt:now+TTL_MS});return value;}catch{return null}
}
export async function recordAdaptiveOutcome({category='default',strategy='standard_quality',qualityScore=0,qualityPass=false,degraded=false,critical=false,latencyMs=0,verified=false,fetchImpl=globalThis.fetch,env=process.env}={}){
 const c=normalizeCategory(category),s=normalizeStrategy(strategy),q=clamp(qualityScore,0,1),lat=Math.round(clamp(latencyMs,0,86400000)),success=Boolean(verified&&qualityPass&&!degraded&&!critical);
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||typeof fetchImpl!=='function')return {persisted:false,version:ADAPTIVE_LEARNING_LOOP_VERSION,reason:'persistence_unconfigured',success};
 const row={category:c,strategy:s,attempts:1,successes:success?1:0,failures:success?0:1,quality_sum:q,latency_sum_ms:lat,last_observed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 try{const url=String(env.SUPABASE_URL).replace(/\/$/,'')+'/rest/v1/'+TABLE;const res=await fetchImpl(url,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row),signal:AbortSignal.timeout(2500)});if(!res.ok)return {persisted:false,version:ADAPTIVE_LEARNING_LOOP_VERSION,reason:'learning_http_'+res.status,success};cache.delete(c);return {persisted:true,version:ADAPTIVE_LEARNING_LOOP_VERSION,success};}catch(error){return {persisted:false,version:ADAPTIVE_LEARNING_LOOP_VERSION,reason:text(error?.message||'learning_transport_failure',180),success};}
}
export function adaptiveLearningCapabilities(){return {version:ADAPTIVE_LEARNING_LOOP_VERSION,enabled:true,persistence:configured()?'supabase:aggregate-learning':'unconfigured',signal:'verified_runtime_outcome',minSamplesForPreference:3,explorationRate:0.20,rawAnswersPersisted:false,rawCompetitorAnswersPersisted:false,clientFeedbackTrusted:false,baseModelWeightsChanged:false};}
export function __resetAdaptiveLearningForTests(){cache.clear()}
