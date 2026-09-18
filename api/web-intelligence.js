import { applyHeaders, originAllowed, allowRequest } from '../lib/security.js';
import { researchWeb, webIntelligenceHealth, webIntelligenceMetrics, webSourceRegistry, UNIVERSAL_WEB_INTELLIGENCE_VERSION } from '../lib/web/research-v1.js';
const int=(v,fallback,min,max)=>Math.max(min,Math.min(max,Number(v)||fallback));
export default async function webIntelligenceHandler(req,res){
  applyHeaders(res);
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_WEB_RATE_LIMIT_PER_MINUTE||20)))return res.status(429).json({error:'rate_limited'});
  const url=new URL(req.url||'/api/web/health','http://localhost');res.setHeader('X-WAE-Web-Intelligence',UNIVERSAL_WEB_INTELLIGENCE_VERSION);
  if(url.pathname==='/api/web/health'){if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});return res.status(200).json({success:true,...webIntelligenceHealth()})}
  if(url.pathname==='/api/web/metrics'){if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});return res.status(200).json({success:true,...webIntelligenceMetrics()})}
  if(url.pathname==='/api/web/sources'){if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});return res.status(200).json({success:true,...webSourceRegistry({category:url.searchParams.get('category')||undefined})})}
  if(url.pathname==='/api/web/search'||url.pathname==='/api/web/research'){if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});const body=req.body&&typeof req.body==='object'?req.body:{},query=String(body.query||body.message||'').trim();if(!query)return res.status(400).json({error:'query_required'});if(query.length>1500)return res.status(413).json({error:'query_too_large'});const providers=Array.isArray(body.providers)?body.providers.map(String):undefined;try{const result=await researchWeb(query,{providers,domain:body.domain,freshnessRequirement:body.freshness_requirement,limit:int(body.limit,url.pathname.endsWith('/research')?16:10,3,30),timeoutMs:int(body.timeout_ms,9000,1000,15000),cache:body.cache!==false});return res.status(200).json({success:true,...result})}catch(error){return res.status(Number(error?.status)||503).json({success:false,error:'web_research_failed',message:String(error?.message||error).slice(0,220),version:UNIVERSAL_WEB_INTELLIGENCE_VERSION})}}
  return res.status(404).json({error:'web_route_not_found'})
}
