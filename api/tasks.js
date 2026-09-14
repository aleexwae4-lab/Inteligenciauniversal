import { executeMission } from '../lib/runtime.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_TASK_RATE_LIMIT_PER_MINUTE||12)))return res.status(429).json({error:'rate_limited'});
  try{
    const body=req.body||{};
    const result=await executeMission({
      ...body,
      message:body.task||body.message,
      mode:body.agent||body.mode||'executive',
      userKey:body.userKey||body.sessionId||getClientIp(req)
    });
    return res.status(200).json({ status:'completed', taskId:crypto.randomUUID(), ...result });
  }catch(error){
    return res.status(error.statusCode||502).json({error:error.code||'task_failed',message:String(error.message||error),failures:error.failures||undefined});
  }
}
