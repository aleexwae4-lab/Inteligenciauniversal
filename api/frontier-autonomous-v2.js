import { applyHeaders } from '../lib/security.js';
import { buildFrontierQueue, orchestrateFrontierCycle, FRONTIER_AUTONOMOUS_VERSION } from '../lib/frontier-autonomous-loop-v2.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET'){
    return res.status(200).json({
      success:true,version:FRONTIER_AUTONOMOUS_VERSION,
      contract:{
        input:['measured','evaluation','maxItems'],
        output:['evidence','queue','decision','next'],
        guarantee:'never fabricates benchmark scores'
      }
    });
  }
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const result=orchestrateFrontierCycle(body);
  return res.status(200).json({success:true,version:FRONTIER_AUTONOMOUS_VERSION,result});
}
