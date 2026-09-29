import { applyHeaders } from '../lib/security.js';
import { runFrontierControlLoop, FRONTIER_CONTROL_LOOP_VERSION } from '../lib/frontier-control-loop-v1.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET'){
    return res.status(200).json({
      success:true,version:FRONTIER_CONTROL_LOOP_VERSION,
      policy:{enabledByDefault:false,baselineRequired:true,regressionBlocksPromotion:true}
    });
  }
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
  if(process.env.WAE_FRONTIER_LIVE_EVAL_ENABLED!=='true'){
    return res.status(503).json({success:false,version:FRONTIER_CONTROL_LOOP_VERSION,error:'live_eval_disabled'});
  }
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const result=await runFrontierControlLoop({
    baselineScore:body.baselineScore,
    regressionThreshold:body.regressionThreshold,
    maxCases:body.maxCases
  });
  return res.status(200).json({success:true,version:FRONTIER_CONTROL_LOOP_VERSION,result});
}
