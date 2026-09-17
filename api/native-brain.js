import { nativeBrainReply, nativeBrainStatus, NATIVE_BRAIN_VERSION } from '../lib/native-brain-v5.js';
import { applyHeaders, originAllowed, allowRequest } from '../lib/security.js';

export default async function nativeBrainHandler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json(nativeBrainStatus());
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req))return res.status(429).json({error:'rate_limited'});
  try{
    const result=await nativeBrainReply(req.body||{});
    res.setHeader('X-WAE-Native-Brain',NATIVE_BRAIN_VERSION);
    res.setHeader('X-WAE-Native-Path',String(result.native_path||'unknown'));
    res.setHeader('X-WAE-Quality-Score',String(result?.quality?.score??'unknown'));
    res.setHeader('X-WAE-Quality-Strategy',String(result?.selection?.strategy||'none'));
    return res.status(200).json(result);
  }catch(error){
    const status=Number(error?.statusCode)||500;
    return res.status(status).json({error:String(error?.message||'native_brain_error'),recoverable:status>=500,native_brain:NATIVE_BRAIN_VERSION});
  }
}
