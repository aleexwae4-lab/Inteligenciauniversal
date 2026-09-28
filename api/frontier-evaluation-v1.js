import { applyHeaders } from '../lib/security.js';
import { evaluateRun, FRONTIER_EVALUATION_VERSION } from '../lib/frontier-evaluation-fabric-v1.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET'){
    return res.status(200).json({
      success:true,
      version:FRONTIER_EVALUATION_VERSION,
      contract:{
        required:['model','harness','graderVersion','datasetVersion','commit'],
        evidence:['runId','startedAt','measurements','baselines'],
        promotion:['reproducibility','regressionCheck','referenceComparison']
      }
    });
  }
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const result=evaluateRun(body);
  return res.status(result.valid?200:400).json({success:result.valid,version:FRONTIER_EVALUATION_VERSION,result});
}
