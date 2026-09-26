export const LIVE_RESEARCH_VERSION='wae-live-research/v119';
import {searchWaeweb,waewebConfigured,waewebSearchConfigured} from './waeweb-research-v125.js';
import {waewebPublicConfigured} from './waeweb-public-v126.js';
const clip=(v,n=300)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname?u.href:null}catch{return null}};
const record=(provider,value)=>({provider,title:clip(value.title,260),url:safeUrl(value.url),snippet:clip(value.snippet,1500),publishedAt:value.publishedAt||null,retrievedAt:new Date().toISOString(),scope:value.scope||'public-source'});
const fail=(code)=>Object.assign(new Error(code),{code,statusCode:code==='research_bad_query'?400:503});
const timedFetch=async(url,options={},ms=7000)=>{
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(ms),headers:{'Accept':'application/json','User-Agent':'WAEUniversalCore/1.0 (https://inteligenciauniversal.onrender.com/; research-index)',...(options.headers||{})}});
  if(!r.ok)throw fail('research_provider_http_'+r.status);
  return r.json();
};
export function researchCapabilities(){
  return {version:LIVE_RESEARCH_VERSION,generalWeb:{provider:waewebConfigured()?'waeweb-connect/v1':waewebPublicConfigured()?'waeweb-public-readonly/v1':'tavily',configured:waewebSearchConfigured()||!!process.env.TAVILY_API_KEY,verified:false},
    waewebConnect:{contract:'waeweb-connect/v1',configured:waewebConfigured(),liveVerified:false,serverSide:true},
    waewebPublic:{contract:'waeweb-public-readonly/v1',configured:waewebPublicConfigured(),liveVerified:false,serverSide:true,privateConnect:false},
    academic:{provider:process.env.OPENALEX_API_KEY?'openalex':'crossref',configured:true,verified:false,description:'Metadatos científicos; Crossref público sin clave u OpenAlex con clave gratuita; no noticias en vivo'},
    encyclopedia:{provider:'wikimedia',configured:true,verified:false,description:'Referencia de contexto; no garantiza actualidad'},
    recentNews:{provider:'gdelt',configured:true,verified:false,description:'Titulares indexados de cobertura reciente; no confirma la veracidad de noticias'}, 
    googleWorkspace:{connected:false,requiresOAuth:true},secretsExposed:false};
}
function verifiedRecords(provider,values){return(values||[]).map(v=>record(provider,v)).filter(v=>v.url&&v.title).slice(0,6)}
export async function retrieveResearch(query,{mode='auto'}={}){
  query=clip(query,280);if(query.length<3)throw fail('research_bad_query');
  if(!['auto','web','news','academic','encyclopedia'].includes(mode))throw fail('research_bad_query');
  const freshness=/\b(?:hoy|ahora|actual(?:es|izad[oa]s?)?|ultim[oa]s?|reciente[s]?|en vivo|tiempo real|precios?|cotizaciones?|tasas? de interes|noticias|202[5-9])\b/i.test(query);
  // Recent-news indexing stays distinct from general web coverage; it never substitutes for verified facts.
  const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const current=/\b(?:hoy|ahora|noticias|reciente|actualizad|ultimo|ultimos|cotizacion|precio actual|vigente|tiempo real|en vivo|latest|today)\b/i.test(normalized);
  const scholarly=/\b(?:cientific\w*|ciencia|research|estudio(?:s)?|paper|articulo|academic\w*|investigacion|epidem\w*|salud publica|laboratorio|medic\w*|scientif\w*)\b/i.test(normalized);
  let channel=mode==='auto'?(waewebSearchConfigured()||process.env.TAVILY_API_KEY?'web':(current||freshness)?'news':scholarly?'academic':'encyclopedia'):mode;
  if(channel==='web'&&waewebSearchConfigured()&&query.length<=180){
    try{
      const evidence=await searchWaeweb(query);
      const provider=evidence.transport||'waeweb-connect/v1';
      const sources=verifiedRecords(provider,evidence.results.map(x=>({
        title:x.title,url:x.url,snippet:x.snippet,publishedAt:x.publishedAt,scope:x.scope
      })));
      if(sources.length||!process.env.TAVILY_API_KEY)return {ok:true,channel:'web',provider,
        results:sources,checkedAt:evidence.fetchedAt||new Date().toISOString(),
        status:evidence.status,failedSources:evidence.failedSources,
        limitation:evidence.limitation};
    }catch{/* WAEWEB unavailable; retain existing Tavily and public research routes. */}
  }
  if(channel==='web'&&!process.env.TAVILY_API_KEY)return {ok:false,
    code:'general_web_not_configured',channel:'web',results:[],checkedAt:new Date().toISOString()};
  if(channel==='web'){
    const data=await timedFetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:process.env.TAVILY_API_KEY,query,search_depth:'basic',max_results:6,include_answer:false})},11000);
    return {ok:true,channel:'web',provider:'tavily',results:verifiedRecords('tavily',(data.results||[]).map(x=>({title:x.title,url:x.url,snippet:x.content,publishedAt:x.published_date||null,scope:'indexed-web-result'}))),checkedAt:new Date().toISOString()};
  }
  if(channel==='news'){
    const url=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.searchParams.set('query',query);url.searchParams.set('mode','ArtList');url.searchParams.set('format','json');url.searchParams.set('maxrecords','6');url.searchParams.set('timespan','1d');url.searchParams.set('sort','DateDesc');
    const data=await timedFetch(url,{},10500);
    const news=(data.articles||[]).map(x=>({title:x.title,url:x.url,snippet:'Titular indexado; verifica la nota y sus fuentes antes de darlo por cierto.',publishedAt:/^\d{8}T\d{6}Z$/.test(x.seendate||'')?x.seendate.slice(0,4)+'-'+x.seendate.slice(4,6)+'-'+x.seendate.slice(6,8)+'T'+x.seendate.slice(9,11)+':'+x.seendate.slice(11,13)+':'+x.seendate.slice(13,15)+'Z':null,scope:'recent-news-index'}));
    return {ok:true,channel:'news',provider:'gdelt',results:verifiedRecords('gdelt',news),checkedAt:new Date().toISOString(),limitation:'GDELT indexa cobertura periodística reciente, no certifica hechos ni garantiza cobertura completa o disponibilidad'};
  }
  if(channel==='academic'&&!process.env.OPENALEX_API_KEY){
    const url=new URL('https://api.crossref.org/works');url.searchParams.set('query.bibliographic',query);url.searchParams.set('rows','5');url.searchParams.set('select','DOI,title,published,URL,type');
    const data=await timedFetch(url,{},8000);
    const works=(data.message?.items||[]).map(x=>({title:x.title?.[0],url:safeUrl(x.DOI?'https://doi.org/'+x.DOI:x.URL),snippet:'Ficha bibliográfica registrada. Examina el trabajo antes de citar conclusiones.',publishedAt:x.published?.['date-parts']?.[0]?.join('-')||null,scope:'academic-index-metadata'}));
    return {ok:true,channel:'academic',provider:'crossref',results:verifiedRecords('crossref',works),checkedAt:new Date().toISOString(),limitation:'Índice bibliográfico: no prueba hallazgos ni es noticia actual'};
  }
  if(channel==='academic'){
    const url=new URL('https://api.openalex.org/works');url.searchParams.set('search',query);url.searchParams.set('per_page','5');url.searchParams.set('select','id,title,doi,publication_date,primary_location');url.searchParams.set('api_key',process.env.OPENALEX_API_KEY);
    const data=await timedFetch(url,{},8500);
    const works=(data.results||[]).map(x=>({title:x.title,url:safeUrl(x.doi)||safeUrl(x.primary_location?.landing_page_url)||safeUrl(x.id),snippet:'Obra indexada. Valida el contenido del estudio antes de usarlo como evidencia.',publishedAt:x.publication_date||null,scope:'academic-index-metadata'}));
    return {ok:true,channel:'academic',provider:'openalex',results:verifiedRecords('openalex',works),checkedAt:new Date().toISOString(),limitation:'Metadatos académicos, no prueba de hallazgos ni cobertura de noticias recientes'};
  }
  const url=new URL('https://en.wikipedia.org/w/api.php');url.searchParams.set('action','query');url.searchParams.set('list','search');url.searchParams.set('srsearch',query);url.searchParams.set('srlimit','5');url.searchParams.set('format','json');
  const data=await timedFetch(url,{},7500);const rows=(data.query?.search||[]).map(x=>({title:x.title,url:'https://en.wikipedia.org/?curid='+Number(x.pageid),snippet:clip(x.snippet.replace(/<[^>]*>/g,''),900),publishedAt:null,scope:'encyclopedia-reference'}));
  return {ok:true,channel:'encyclopedia',provider:'wikimedia',results:verifiedRecords('wikimedia',rows),checkedAt:new Date().toISOString(),limitation:'Contenido enciclopédico: no confirma eventos, leyes, precios o titulares actuales'};
}
