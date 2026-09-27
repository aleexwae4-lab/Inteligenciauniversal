import { applyHeaders } from '../lib/security.js';
import { frontierSupremacyManifest, scoreFrontierDomains, frontierGap, FRONTIER_SUPREMACY_VERSION } from '../lib/frontier-supremacy-v2.js';
export default async function handler(req,res){
 applyHeaders(res);
 if(req.method==='GET') return res.status(200).json({success:true,...frontierSupremacyManifest()});
 if(req.method!=='POST') return res.status(405).json({success:false,error:'method_not_allowed'});
 const body=req.body&&typeof req.body==='object'?req.body:{};
 const result=scoreFrontierDomains(body.scores||{});
 const gap=frontierGap({actual:body.targetsActual||{},target:body.targets||{}});
 return res.status(200).json({success:true,version:FRONTIER_SUPREMACY_VERSION,score:result,gap,claimPolicy:'No global superiority claim is emitted; benchmark-scoped claims require executed, versioned, independently reproducible evidence.'});
}
