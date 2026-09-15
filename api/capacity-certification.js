import { timingSafeEqual } from 'node:crypto';
import { applyHeaders } from '../lib/security.js';
import {
  capacityCertificationCapabilities,
  certifyCapacityEvidence,
  latestTrustedCapacityCertification,
  recordTrustedCapacityCertification
} from '../lib/capacity-certification-v65.js';

function safeEqual(a,b){
  const left=Buffer.from(String(a||''));
  const right=Buffer.from(String(b||''));
  return left.length===right.length&&left.length>0&&timingSafeEqual(left,right);
}

function trustedWorker(req){
  const expected=String(process.env.WAE_WORKER_TOKEN||'');
  const supplied=String(req.headers?.['x-wae-worker-token']||'');
  return Boolean(expected)&&safeEqual(expected,supplied);
}

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET'){
    const latest=await latestTrustedCapacityCertification().catch(()=>({ok:false,error:'capacity_bridge_unavailable'}));
    const certification=latest?.certification||null;
    return res.status(200).json({
      success:true,
      ...capacityCertificationCapabilities(),
      currentInfrastructureLoadCertified:certification?.currentInfrastructureLoadCertified===true,
      latestTrustedCertification:certification
    });
  }

  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const action=String(body.action||'evaluate').toLowerCase();
  if(!['evaluate','certify_and_record'].includes(action))return res.status(400).json({error:'unsupported_capacity_action'});
  const trusted=trustedWorker(req);
  const result=certifyCapacityEvidence(body.evidence||{}, {trusted});

  if(action==='evaluate')return res.status(200).json({success:true,result});
  if(!trusted)return res.status(403).json({error:'trusted_worker_required',result:{...result,claimEligible:false,currentInfrastructureLoadCertified:false,certificationVerdict:'NOT_CERTIFIED'}});
  if(!result.claimEligible)return res.status(422).json({error:'capacity_thresholds_not_met',result});
  const recorded=await recordTrustedCapacityCertification(result);
  if(recorded?.ok!==true)return res.status(503).json({error:recorded?.error||'capacity_record_failed',result,recorded});
  return res.status(200).json({success:true,result,recorded});
}
