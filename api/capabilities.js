import { AGENTS } from '../lib/agents.js';
import { runtimeHealth } from '../lib/runtime.js';
import { capabilitySnapshot } from '../lib/core-self-description.js';
import { capabilityProofSnapshot } from '../lib/capability-proof-v153.js';
import { applyHeaders } from '../lib/security.js';

export default function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const health=runtimeHealth();
  const capabilityMatrix=capabilitySnapshot();
  const capabilityProof=capabilityProofSnapshot({capabilityMatrix});
  const path=new URL(req.url||'/api/capabilities','http://localhost').pathname;
  if(path==='/api/capabilities/proof')return res.status(200).json({ok:true,capabilityMatrixVersion:capabilityMatrix.version,capabilityProof});
  return res.status(200).json({
    ...health,
    capabilityMatrix,
    capabilityProof,
    agents:Object.values(AGENTS).map(({id,name,description,tools})=>({id,name,description,tools}))
  });
}
