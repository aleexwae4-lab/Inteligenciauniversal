export const UNIVERSAL_CONTEXT_VERSION='universal-context/v52';

const CACHE=new Map();
const ttl=(key,value,ms)=>CACHE.set(key,{value,expires:Date.now()+ms});
const getCached=key=>{const hit=CACHE.get(key);if(!hit||hit.expires<Date.now()){CACHE.delete(key);return null}return hit.value};

function configured(){return !!process.env.SUPABASE_URL&&!!process.env.SUPABASE_PUBLISHABLE_KEY}
function endpoint(){return `${String(process.env.SUPABASE_URL||'').replace(/\/$/,'')}/rest/v1/rpc/wae_universal_core_context_v52`}

async function rpc(action,{query='',limit=8,timeoutMs=1800}={}){
  if(!configured())return null;
  try{
    const response=await fetch(endpoint(),{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        apikey:process.env.SUPABASE_PUBLISHABLE_KEY,
        'X-Client-Info':'wae-universal-core-v52'
      },
      body:JSON.stringify({p_action:action,p_query:String(query||'').slice(0,300),p_limit:Math.max(1,Math.min(Number(limit)||8,12))}),
      signal:AbortSignal.timeout(timeoutMs)
    });
    if(!response.ok)return null;
    const data=await response.json();
    return data&&data.ok===true?data:null;
  }catch{return null}
}

export async function getExecutiveManifest({fresh=false}={}){
  const key='agent_manifest';
  if(!fresh){const cached=getCached(key);if(cached)return cached}
  const data=await rpc('agent_manifest',{timeoutMs:1800});
  if(data)ttl(key,data,5*60_000);
  return data;
}

export async function getLibraryStats({fresh=false}={}){
  const key='library_stats';
  if(!fresh){const cached=getCached(key);if(cached)return cached}
  const data=await rpc('library_stats',{timeoutMs:1800});
  if(data)ttl(key,data,10*60_000);
  return data;
}

export async function getUniversalSelfDescription({fresh=false}={}){
  const key='self_description';
  if(!fresh){const cached=getCached(key);if(cached)return cached}
  const data=await rpc('self_description',{timeoutMs:1800});
  if(data)ttl(key,data,10*60_000);
  return data;
}

export async function searchLocalLibrary(query,limit=6){
  return rpc('library_local_search',{query,limit,timeoutMs:1600});
}

export function formatCoverage(value){
  const n=Number(value||0);
  if(!Number.isFinite(n)||n<=0)return null;
  if(n>=1_000_000)return `${(n/1_000_000).toFixed(n>=10_000_000?1:2).replace(/\.0$/,'')} millones`;
  return new Intl.NumberFormat('es-MX').format(Math.round(n));
}

export function buildLibraryCapabilityReply(stats){
  const library=stats?.library||stats||{};
  const coverage=Number(library?.federatedMetadataCoverageEstimate||0);
  const openFulltext=Number(library?.fulltextCoverageEstimate||0);
  const coverageText=formatCoverage(coverage);
  const fulltextText=formatCoverage(openFulltext);
  if(!coverageText){
    return 'Sí. Mi núcleo incluye una **biblioteca cognitiva federada** para consultar registros bibliográficos y colecciones abiertas. En este momento no pude verificar la cifra de cobertura, así que no voy a inventarla.';
  }
  return `Sí. Mi núcleo bibliográfico está conectado a una cobertura federada auditada de **más de ${coverageText} de registros de libros**${fulltextText?` y unas **${fulltextText} obras de colecciones abiertas o dominio público** identificadas por las fuentes`:''}. Puedo usar esos registros para localizar obras, autores, ediciones y temas y combinarlos con razonamiento para mis respuestas. Eso **no significa que tenga ${coverageText} de textos completos con copyright cargados**: el texto íntegro solo se usa cuando los derechos o la licencia lo permiten.`;
}

export function buildIdentityReply(stats){
  const roles=Number(stats?.executiveOrchestration?.executiveRoles||0);
  const instances=Number(stats?.executiveOrchestration?.activeAgentInstances||0);
  const coverage=Number(stats?.library?.federatedMetadataCoverageEstimate||0);
  const openFulltext=Number(stats?.library?.fulltextCoverageEstimate||0);
  const coverageText=formatCoverage(coverage);
  const fulltextText=formatCoverage(openFulltext);
  const agentText=roles?`un orquestador ejecutivo conectado a **${roles} roles especializados**${instances?` (${instances} instancias activas en la base)` : ''}`:'un orquestador ejecutivo multiagente';
  const libraryText=coverageText?`una biblioteca cognitiva federada con acceso a **más de ${coverageText} de registros de libros**${fulltextText?`, además de unas **${fulltextText} obras de colecciones abiertas/dominio público** identificadas por las fuentes`:''}`:'una biblioteca cognitiva federada';
  return `Soy **Universal Core**, el núcleo de inteligencia de WAE OS Enterprise. Como capas extra, mi núcleo integra ${agentText} y ${libraryText}. Puedo combinar esas fuentes con razonamiento, memoria, herramientas y modelos disponibles para producir análisis y respuestas de mayor nivel.`;
}

export function universalContextHealth(){
  return{version:UNIVERSAL_CONTEXT_VERSION,configured:configured(),cacheEntries:CACHE.size};
}
