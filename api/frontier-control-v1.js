import { applyHeaders } from '../lib/security.js';
import { frontierControlSnapshot, frontierControlPlan, FRONTIER_CONTROL_VERSION } from '../lib/frontier-control-v1.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET'){
    const url=new URL(req.url||'/api/frontier/control','http://localhost');
    return res.status(200).json({success:true,version:FRONTIER_CONTROL_VERSION,plan:frontierControlPlan(url.searchParams.get('domain')||'collect_measurements')});
  }
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  return res.status(200).json({success:true,version:FRONTIER_CONTROL_VERSION,snapshot:frontierControlSnapshot(body.measurements||[])});
}
