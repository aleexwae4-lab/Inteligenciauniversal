import {analyzeVisual} from '../lib/vision.js';
import {allowRequest,originAllowed,applyHeaders} from '../lib/security.js';
export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req))return res.status(429).json({error:'rate_limited'});
  try{
    const result=await analyzeVisual(req.body||{});
    return res.status(200).json(result);
  }catch(error){
    return res.status(error.statusCode||502).json({error:error.code||'vision_error',message:String(error.message||'vision_error')});
  }
}
