import { applyHeaders } from '../lib/security.js';
import { runnerContract, runFrontierSuite, compareRunnerScores, FRONTIER_RUNNER_VERSION } from '../lib/frontier-benchmark-runner-v3.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json({success:true,...runnerContract()});
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const result=runFrontierSuite(body);
  if(body.baseline&&result.status==='MEASURED'){
    result.regression=compareRunnerScores({score:result.score,regressionThreshold:body.regressionThreshold},{score:body.baseline.score});
    if(result.regression.regression)result.promotion='BLOCKED';
  }
  return res.status(200).json({success:true,version:FRONTIER_RUNNER_VERSION,result});
}
