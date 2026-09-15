import { applyHeaders, originAllowed, allowRequest } from '../lib/security.js';
import { retrieveLiveData, publicLiveDataMetadata, LIVE_DATA_MESH_VERSION } from '../lib/live-data-mesh-v58.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(!['GET','POST'].includes(req.method||''))return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_LIVE_DATA_RATE_LIMIT_PER_MINUTE||20)))return res.status(429).json({error:'rate_limited'});

  const url=new URL(req.url||'/api/live-data','http://localhost');
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const query=String(body.query||body.message||url.searchParams.get('q')||url.searchParams.get('query')||'').trim();
  if(!query)return res.status(400).json({error:'query_required'});
  if(query.length>1200)return res.status(413).json({error:'query_too_large'});

  try{
    const live=await retrieveLiveData({message:query,mode:'research',webEnabled:true,force:true,maxResults:8});
    res.setHeader('X-WAE-Live-Data',LIVE_DATA_MESH_VERSION);
    return res.status(200).json({success:true,live_data:publicLiveDataMetadata(live),sources:live.sources||[]});
  }catch(error){
    return res.status(503).json({success:false,error:'live_data_unavailable',message:String(error?.message||error).slice(0,180),live_data:{version:LIVE_DATA_MESH_VERSION,used:true,evidence_ready:false,fail_closed:true}});
  }
}
