import { applyHeaders } from '../lib/security.js';
import { competitiveContract, scoreCompetitiveRun, ASTRA_COMPETITIVE_VERSION } from '../lib/astra-supremacy-v1.js';
export default async function handler(req,res){
 applyHeaders(res);
 if(req.method==='GET') return res.status(200).json({success:true,...competitiveContract()});
 if(req.method!=='POST') return res.status(405).json({error:'method_not_allowed'});
 const body=req.body&&typeof req.body==='object'?req.body:{};
 const evidence=body.evidence&&typeof body.evidence==='object'?body.evidence:{};
 const scored=scoreCompetitiveRun(body.scores||{});
 const missing=competitiveContract().requiredEvidence.filter(key=>evidence[key]===undefined||evidence[key]===null||evidence[key]==='');
 const verdict=scored.complete&&missing.length===0?'evidence_complete':'evidence_incomplete';
 return res.status(200).json({success:true,version:ASTRA_COMPETITIVE_VERSION,verdict,...scored,missingEvidence:missing,evidenceAccepted:missing.length===0,nextAction:missing.length?'complete missing evidence':'persist run and compare against the same suite'});
}
