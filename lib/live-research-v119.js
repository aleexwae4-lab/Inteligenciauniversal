export const LIVE_RESEARCH_VERSION='wae-live-research/v119';
const clip=(v,n=300)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname?u.href:null}catch{return null}};
const record=(provider,value)=>({provider,title:clip(value.title,260),url:safeUrl(value.url),snippet:clip(value.snippet,1500),publishedAt:value.publishedAt||null,retrievedAt:new Date().toISOString(),scope:value.scope||'public-source'});
const fail=(code)=>Object.assign(new Error(code),{code,statusCode:code==='research_bad_query'?400:503});
const timedFetch=async(url,options={},ms=7000)=>{
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(ms),headers:{'Accept':'application/json','User-Agent':'WAEUniversalCore/1.0 public research (support@wae.example)',...(options.headers||{})}});
  if(!r.ok)throw fail('research_provider_http_'+r.status);
  return r.json();
};
export function researchCapabilities(){
  return {version:LIVE_RESEARCH_VERSION,generalWeb:{provider:'tavily',configured:!!process.env.TAVILY_API_KEY,verified:false},
    academic:{provider:'openalex',configured:true,verified:false,description:'Índice público académico; no es una búsqueda de noticias en vivo'},
    encyclopedia:{provider:'wikimedia',configured:true,verified:false,description:'Referencia de contexto; no garantiza actualidad'},
    googleWorkspace:{connected:false,requiresOAuth:true},secretsExposed:false};
}
function verifiedRecords(provider,values){return(values||[]).map(v=>record(provider,v)).filter(v=>v.url&&v.title).slice(0,6)}
export async function retrieveResearch(query,{mode='auto'}={}){
  query=clip(query,280);if(query.length<3)throw fail('research_bad_query');
  if(!['auto','web','academic','encyclopedia'].includes(mode))throw fail('research_bad_query');
  let channel=mode==='auto'?(process.env.TAVILY_API_KEY?'web':/\b(?:cientific|ciencia|research|estudio|paper|articulo|academic|investigacion|epidem|salud publica|laboratorio|medic|scientif)/i.test(query)?'academic':'encyclopedia'):mode;
  if(channel==='web'&&!process.env.TAVILY_API_KEY)return {ok:false,code:'general_web_not_configured',channel:'web',results:[],checkedAt:new Date().toISOString()};
  if(channel==='web'){
    const data=await timedFetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:process.env.TAVILY_API_KEY,query,search_depth:'basic',max_results:6,include_answer:false})},11000);
    return {ok:true,channel:'web',provider:'tavily',results:verifiedRecords('tavily',(data.results||[]).map(x=>({title:x.title,url:x.url,snippet:x.content,publishedAt:x.published_date||null,scope:'indexed-web-result'}))),checkedAt:new Date().toISOString()};
  }
  if(channel==='academic'){
    const url=new URL('https://api.openalex.org/works');url.searchParams.set('search',query);url.searchParams.set('per_page','5');url.searchParams.set('select','id,title,doi,publication_date,primary_location,authorships');
    const data=await timedFetch(url,{},8500);
    const works=(data.results||[]).map(x=>({title:x.title,url:safeUrl(x.doi)||safeUrl(x.primary_location?.landing_page_url)||safeUrl(x.id),snippet:'Obra indexada. Valida el contenido del estudio antes de usarlo como evidencia.',publishedAt:x.publication_date||null,scope:'academic-index-metadata'}));
    return {ok:true,channel:'academic',provider:'openalex',results:verifiedRecords('openalex',works),checkedAt:new Date().toISOString(),limitation:'Metadatos académicos, no prueba de hallazgos ni cobertura de noticias recientes'};
  }
  const url=new URL('https://en.wikipedia.org/w/api.php');url.searchParams.set('action','query');url.searchParams.set('list','search');url.searchParams.set('srsearch',query);url.searchParams.set('srlimit','5');url.searchParams.set('format','json');
  const data=await timedFetch(url,{},7500);const rows=(data.query?.search||[]).map(x=>({title:x.title,url:'https://en.wikipedia.org/?curid='+Number(x.pageid),snippet:clip(x.snippet.replace(/<[^>]*>/g,''),900),publishedAt:x.timestamp||null,scope:'encyclopedia-reference'}));
  return {ok:true,channel:'encyclopedia',provider:'wikimedia',results:verifiedRecords('wikimedia',rows),checkedAt:new Date().toISOString(),limitation:'Contenido enciclopédico: no confirma eventos, leyes, precios o titulares actuales'};
}
