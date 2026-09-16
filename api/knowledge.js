import { applyHeaders, originAllowed, allowRequest } from '../lib/security.js';
import { knowledgeSources, knowledgeHealth, existingKnowledgeArchitecture } from '../lib/knowledge/fabric-v1.js';
import { searchUniversalKnowledge, universalKnowledgeCapabilities, UNIVERSAL_KNOWLEDGE_MESH_VERSION } from '../lib/universal-knowledge-mesh-v89.js';
import { getKnowledgeSource } from '../lib/knowledge/source-registry-v1.js';

const int=(value,fallback,min,max)=>Math.max(min,Math.min(max,Number(value)||fallback));
const parseSources=value=>Array.isArray(value)?value:String(value||'').split(',').map(x=>x.trim()).filter(Boolean);

export default async function knowledgeHandler(req,res){
  applyHeaders(res);
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_KNOWLEDGE_RATE_LIMIT_PER_MINUTE||18)))return res.status(429).json({error:'rate_limited'});
  const url=new URL(req.url||'/api/knowledge/health','http://localhost');
  const path=url.pathname;
  res.setHeader('X-WAE-Knowledge-Fabric',UNIVERSAL_KNOWLEDGE_MESH_VERSION);

  if(path==='/api/knowledge/sources'){
    if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
    const live=url.searchParams.get('live')==='1';
    const sources=await knowledgeSources({live});
    return res.status(200).json({success:true,version:UNIVERSAL_KNOWLEDGE_MESH_VERSION,live_checked:live,capabilities:universalKnowledgeCapabilities(),sources});
  }

  if(path==='/api/knowledge/health'){
    if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
    const live=url.searchParams.get('live')==='1';
    const health=await knowledgeHealth({live});
    return res.status(200).json({success:true,version:UNIVERSAL_KNOWLEDGE_MESH_VERSION,...health,universal:universalKnowledgeCapabilities(),architecture:existingKnowledgeArchitecture()});
  }

  if(path.startsWith('/api/knowledge/source/')){
    if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
    const id=decodeURIComponent(path.slice('/api/knowledge/source/'.length)).toLowerCase();const source=getKnowledgeSource(id);
    if(!source)return res.status(404).json({error:'knowledge_source_not_found'});
    return res.status(200).json({success:true,version:UNIVERSAL_KNOWLEDGE_MESH_VERSION,source});
  }

  if(path==='/api/knowledge/search'||path==='/api/knowledge/research'||path==='/api/knowledge/universal'){
    if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
    const body=req.body&&typeof req.body==='object'?req.body:{};const query=String(body.query||body.message||'').trim();
    if(!query)return res.status(400).json({error:'query_required'});if(query.length>1500)return res.status(413).json({error:'query_too_large'});
    const research=path.endsWith('/research')||path.endsWith('/universal');
    try{
      const result=await searchUniversalKnowledge(query,{mode:research?'research':'search',language:body.language,sources:parseSources(body.sources),maxSources:int(body.max_sources,research?7:5,1,8),perSource:int(body.per_source,5,1,8),limit:int(body.limit,research?20:14,1,30),organizationId:null,requestId:undefined});
      return res.status(200).json({success:true,...result});
    }catch(error){
      return res.status(Number(error?.status)||503).json({success:false,error:'knowledge_retrieval_failed',message:String(error?.message||error).slice(0,180),version:UNIVERSAL_KNOWLEDGE_MESH_VERSION});
    }
  }

  return res.status(404).json({error:'knowledge_route_not_found'});
}
