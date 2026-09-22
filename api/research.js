import {retrieveResearch,researchCapabilities} from '../lib/live-research-v119.js';
import {allowRequest,originAllowed,applyHeaders} from '../lib/security.js';

// Public-only research. This route never accepts arbitrary URLs, headers or credentials.
export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json({ok:true,...researchCapabilities()});
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,12))return res.status(429).json({error:'rate_limited'});
  const query=req.body?.query,mode=req.body?.mode||'auto';
  try{
    const output=await retrieveResearch(query,{mode});
    return res.status(output.ok?200:503).json(output);
  }catch(error){return res.status(error.statusCode||502).json({ok:false,error:error.code||'research_unavailable',results:[]})}
}
