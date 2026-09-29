import { applyHeaders } from '../lib/security.js';
import { runFrontierArenaV2,FRONTIER_ARENA_V2,ARENA_CASES } from '../lib/frontier-arena-v2.js';
export default async function handler(req,res){
 applyHeaders(res);
 if(req.method==='GET')return res.status(200).json({success:true,version:FRONTIER_ARENA_V2,cases:ARENA_CASES.map(({id,domain,prompt})=>({id,domain,prompt})),policy:{enabledByDefault:false,realRuntimeOnly:true}});
 if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
 if(process.env.WAE_FRONTIER_LIVE_EVAL_ENABLED!=='true')return res.status(503).json({success:false,error:'live_eval_disabled'});
 const body=req.body&&typeof req.body==='object'?req.body:{};
 const result=await runFrontierArenaV2({maxCases:body.maxCases,cases:ARENA_CASES});
 return res.status(200).json({success:true,version:FRONTIER_ARENA_V2,result});
}
