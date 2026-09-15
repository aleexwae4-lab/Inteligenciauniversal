const DEFAULT_TTL_MS=15*60*1000;
const MAX_ENTRIES=240;
const SENSITIVE_RX=/\b(m[eé]dic|salud|diagn[oó]stic|tratamiento|dosis|farmacol|legal|jur[ií]dic|penal|delito|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude|contrase[nñ]a|password|token|api[_ -]?key|secreto|secret|privad[oa]|confidencial|alto riesgo|high[- ]risk)\b/i;
const RESEARCH_RX=/\b(hoy|actual|reciente|latest|today|current|noticias|news|precio|cotizaci[oó]n|jurisprudencia|reforma|ley vigente|fuentes?|evidencia|investiga|investigaci[oó]n|web)\b/i;
const STOP=new Set('que qué como cómo para por con sin una uno unos unas del las los el la y o de en es son ser se su sus al un ya más mas muy este esta estos estas esto esa ese esos esas mi mis tu tus lo le les nos me te a e u si no pero sobre entre desde hasta where what how why when who which the and or for with without from into this that these those your you our are is be was were'.split(/\s+/));
const cache=new Map();

function normalized(value=''){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function tokens(value=''){
  return [...new Set((normalized(value).match(/[a-z0-9]{3,}/g)||[]).filter(x=>!STOP.has(x)))];
}
function similarity(a='',b=''){
  const A=new Set(tokens(a)),B=new Set(tokens(b));
  if(!A.size||!B.size)return normalized(a)===normalized(b)?1:0;
  let intersection=0;for(const x of A)if(B.has(x))intersection++;
  const union=A.size+B.size-intersection;
  return union?intersection/union:0;
}
function now(){return Date.now()}
function prune(ts=now()){
  for(const [key,item] of cache){if(!item||item.expiresAt<=ts)cache.delete(key)}
  if(cache.size<=MAX_ENTRIES)return;
  const ordered=[...cache.entries()].sort((a,b)=>(a[1]?.lastHitAt||a[1]?.createdAt||0)-(b[1]?.lastHitAt||b[1]?.createdAt||0));
  for(let i=0;i<ordered.length-MAX_ENTRIES;i++)cache.delete(ordered[i][0]);
}
function scopeKey({userKey='',mode='general',provider='auto'}={}){
  return `${String(userKey||'anonymous').slice(0,160)}::${String(mode||'general')}::${String(provider||'auto')}`;
}
function poisonedCacheItem(item){
  if(!item)return true;
  if(['web_recovery','continuity_core','universal_continuity_core'].includes(String(item.provider||'')))return true;
  if(Array.isArray(item.sources)&&item.sources.length>0)return true;
  if(item.quality?.critical===true||item.quality?.pass===false)return true;
  if(Array.isArray(item.quality?.reasons)&&item.quality.reasons.includes('low_relevance'))return true;
  return false;
}

export function semanticCacheEligible({message='',mode='general',provider='auto',history=[],attachments=[],tools=[],memoryConfigured=false}={}){
  const q=String(message||'').trim();
  if(!q||q.length>1800)return false;
  if(memoryConfigured)return false;
  if(Array.isArray(history)&&history.length)return false;
  if(Array.isArray(attachments)&&attachments.length)return false;
  if(Array.isArray(tools)&&tools.length)return false;
  if(String(mode||'general')==='research'||RESEARCH_RX.test(q)||SENSITIVE_RX.test(q))return false;
  if(String(provider||'auto')!=='auto')return false;
  return true;
}

export function semanticCacheLookup({message,userKey,mode='general',provider='auto',threshold=.94}={}){
  prune();
  const scope=scopeKey({userKey,mode,provider}),exact=normalized(message);
  let best=null;
  for(const [key,item] of cache){
    if(!item||item.scope!==scope)continue;
    if(poisonedCacheItem(item)){cache.delete(key);continue}
    const sim=item.normalized===exact?1:similarity(message,item.message);
    if(sim<threshold)continue;
    if(!best||sim>best.similarity||(sim===best.similarity&&item.createdAt>best.item.createdAt))best={key,item,similarity:sim};
  }
  if(!best)return null;
  best.item.hits=(best.item.hits||0)+1;best.item.lastHitAt=now();
  return {text:best.item.text,provider:best.item.provider,model:best.item.model,quality:best.item.quality,sources:best.item.sources||[],similarity:Number(best.similarity.toFixed(3)),ageMs:Math.max(0,now()-best.item.createdAt),hits:best.item.hits};
}

export function semanticCacheStore({message,userKey,mode='general',provider='auto',text,model,actualProvider,quality,sources=[],ttlMs=DEFAULT_TTL_MS}={}){
  if(!String(text||'').trim())return false;
  if(['web_recovery','continuity_core','universal_continuity_core'].includes(String(actualProvider||'')))return false;
  if(Array.isArray(sources)&&sources.length>0)return false;
  if(quality?.critical===true||quality?.pass!==true)return false;
  if(Array.isArray(quality?.reasons)&&quality.reasons.includes('low_relevance'))return false;
  const createdAt=now(),scope=scopeKey({userKey,mode,provider}),key=`${scope}::${normalized(message)}`;
  cache.set(key,{scope,message:String(message||''),normalized:normalized(message),text:String(text||''),provider:String(actualProvider||'universal_core'),model:String(model||'unknown'),quality:quality||null,sources:[],createdAt,lastHitAt:createdAt,hits:0,expiresAt:createdAt+Math.max(60_000,Number(ttlMs)||DEFAULT_TTL_MS)});
  prune(createdAt);
  return true;
}

export function shouldRunChallenger({message='',mode='general',quality={},degraded=false,requestedProvider='auto'}={}){
  const score=Number(quality?.score);
  if(degraded||!Number.isFinite(score)||quality?.pass===true)return false;
  if(['continuity_core','universal_continuity_core'].includes(String(requestedProvider)))return false;
  if(String(message||'').length<70)return false;
  if(SENSITIVE_RX.test(message))return score<.42;
  if(String(mode)==='research')return score<.5;
  return ['analysis','code','design','executive','general'].includes(String(mode))&&score<.68;
}

export function challengerInstruction(quality={}){
  const reasons=Array.isArray(quality?.reasons)&&quality.reasons.length?quality.reasons.join(', '):'quality_below_target';
  return `\n\nSUPREMACY CHALLENGER: el primer borrador quedó por debajo del estándar (${reasons}). Genera una alternativa claramente superior. Responde la solicitud completa, elimina relleno, preserva hechos verificables, corrige estructura y precisión, y entrega sólo la respuesta final.`;
}

export function selectBestCandidate(candidates=[]){
  const valid=(Array.isArray(candidates)?candidates:[]).filter(x=>x&&typeof x.text==='string'&&x.text.trim()&&x.quality&&Number.isFinite(Number(x.quality.score)));
  if(!valid.length)return null;
  const score=x=>Number(x.quality.score)+(x.degraded?-.05:0)+Math.min(.025,(Array.isArray(x.sources)?x.sources.length:0)*.005);
  valid.sort((a,b)=>score(b)-score(a));
  return valid[0];
}

export function supremacyStats(){
  prune();
  const entries=[...cache.values()].filter(x=>!poisonedCacheItem(x));
  return {contract:'universal-core-supremacy/v1',semanticCache:{enabled:true,scope:'user',entries:entries.length,hits:entries.reduce((n,x)=>n+(x.hits||0),0),ttlMs:DEFAULT_TTL_MS,sensitiveCaching:false,sourcedRecoveryCaching:false},selectiveTournament:{enabled:true,maxCandidates:2,qualityTriggered:true},reranker:{enabled:true,engine:'deterministic-quality-v1'}};
}

export function __resetSupremacyCacheForTests(){cache.clear()}
