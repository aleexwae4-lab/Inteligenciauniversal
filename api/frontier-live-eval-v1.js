import { applyHeaders } from '../lib/security.js';
import { liveEvalContract, runLiveFrontierEvaluation, FRONTIER_LIVE_EVAL_VERSION } from '../lib/frontier-live-eval-v1.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json({success:true,...liveEvalContract()});
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
  if(process.env.WAE_FRONTIER_LIVE_EVAL_ENABLED!=='true'){
    return res.status(503).json({success:false,version:FRONTIER_LIVE_EVAL_VERSION,error:'live_eval_disabled',hint:'Set WAE_FRONTIER_LIVE_EVAL_ENABLED=true only for controlled evaluation windows.'});
  }
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const result=await runLiveFrontierEvaluation({maxCases:body.maxCases});
  return res.status(200).json({success:true,version:FRONTIER_LIVE_EVAL_VERSION,result});
}
