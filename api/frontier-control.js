import { applyHeaders } from '../lib/security.js';
import { frontierControlSnapshot } from '../lib/frontier-control-v1.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({success:false,error:'method_not_allowed'});
  return res.status(200).json(frontierControlSnapshot());
}
