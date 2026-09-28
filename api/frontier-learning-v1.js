import { applyHeaders } from '../lib/security.js';
import { frontierLearningTargets,frontierLearningSnapshot,frontierTrainingPlan,FRONTIER_LEARNING_VERSION } from '../lib/frontier-learning-v1.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET'){
    const url=new URL(req.url||'/api/frontier/learning','http://localhost');
    const domain=url.searchParams.get('domain')||'collect_measurements';
    return res.status(200).json({success:true,...frontierLearningTargets(),trainingPlan:frontierTrainingPlan(domain)});
  }
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  return res.status(200).json({success:true,version:FRONTIER_LEARNING_VERSION,snapshot:frontierLearningSnapshot(body.measured||{})});
}
