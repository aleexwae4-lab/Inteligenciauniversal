import { applyHeaders, originAllowed, allowRequest } from '../lib/security.js';
import { researchWebV2, retrieveUrlV2, webIntelligenceHealthV2, webIntelligenceMetricsV2, webSourceRegistryV2, UNIVERSAL_WEB_INTELLIGENCE_V2 } from '../lib/web/research-v2.js';
const int=(v,fallback,min,max)=>Math.max(min,Math.min(max,Number(v)||fallback));
const bool=(v,fallback=false)=>v===undefined?fallback:v===true;
export default async function webIntelligenceHandler(req,res){
  applyHeaders(res);
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_WEB_RATE_LIMIT_PER_MINUTE||20)))return res.status(429).json({error:'rate_limited'});
  const url=new URL(req.url||'/api/web/health','http://localhost');
  res.setHeader('X-WAE-Web-Intelligence',UNIVERSAL_WEB_INTELLIGENCE_V2);
  if(url.pathname==='/api/web/health'){
    if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
    return res.status(200).json({success:true,...webIntelligenceHealthV2()});
  }
  if(url.pathname==='/api/web/metrics'){
    if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
    return res.status(200).json({success:true,...webIntelligenceMetricsV2()});
  }
  if(url.pathname==='/api/web/sources'){
    if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
    return res.status(200).json({success:true,...webSourceRegistryV2({category:url.searchParams.get('category')||undefined})});
  }
  if(url.pathname==='/api/web/retrieve'){
    if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
    const body=req.body&&typeof req.body==='object'?req.body:{};
    const target=String(body.url||'').trim();
    if(!target)return res.status(400).json({error:'url_required'});
    if(target.length>2048)return res.status(413).json({error:'url_too_large'});
    try{
      const result=await retrieveUrlV2(target,{
        query:String(body.query||'').slice(0,1500),
        timeoutMs:int(body.timeout_ms,6500,1000,15000),
        extractTables:body.extract_pdf_tables===true,
        respectRobots:body.respect_robots!==false,
        persist:body.persist===true,
        freshnessRequirement:body.freshness_requirement||'MEDIUM'
      });
      return res.status(200).json({success:true,...result});
    }catch(error){
      return res.status(Number(error?.status)||503).json({success:false,error:String(error?.code||'web_retrieve_failed'),message:String(error?.message||error).slice(0,220),version:UNIVERSAL_WEB_INTELLIGENCE_V2});
    }
  }
  if(url.pathname==='/api/web/search'||url.pathname==='/api/web/research'){
    if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
    const body=req.body&&typeof req.body==='object'?req.body:{},query=String(body.query||body.message||'').trim();
    if(!query)return res.status(400).json({error:'query_required'});
    if(query.length>1500)return res.status(413).json({error:'query_too_large'});
    const providers=Array.isArray(body.providers)?body.providers.map(String):undefined;
    try{
      const result=await researchWebV2(query,{
        providers,
        domain:body.domain,
        freshnessRequirement:body.freshness_requirement,
        limit:int(body.limit,url.pathname.endsWith('/research')?16:10,3,30),
        timeoutMs:int(body.timeout_ms,9000,1000,15000),
        directTimeoutMs:int(body.direct_timeout_ms,Number(process.env.WAE_WEB_DIRECT_TIMEOUT_MS||6500),1000,15000),
        directLimit:int(body.direct_limit,Number(process.env.WAE_WEB_DIRECT_LIMIT||4),0,8),
        directRetrieval:body.direct_retrieval!==false,
        respectRobots:body.respect_robots!==false,
        extractPdfTables:body.extract_pdf_tables===true,
        includeKnowledge:body.include_knowledge!==false,
        includeGlobalIndex:body.include_global_index!==false,
        persist:body.persist!==false,
        cache:body.cache!==false
      });
      return res.status(200).json({success:true,...result});
    }catch(error){
      return res.status(Number(error?.status)||503).json({success:false,error:'web_research_failed',message:String(error?.message||error).slice(0,220),version:UNIVERSAL_WEB_INTELLIGENCE_V2});
    }
  }
  return res.status(404).json({error:'web_route_not_found'});
}
