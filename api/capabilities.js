import { AGENTS } from '../lib/agents.js';
import { evaluationPlaneCapabilities } from '../lib/evaluation-plane.js';
import { runtimeHealth } from '../lib/runtime.js';
import { ORCHESTRATOR_VERSION } from '../lib/orchestrator.js';
import { applyHeaders } from '../lib/security.js';

export default function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const health=runtimeHealth();
  return res.status(200).json({
    ...health,
    interface:'experience-v8-living-core',
    reasoningProfiles:['auto','deep'],
    orchestration:{schema:ORCHESTRATOR_VERSION,parallel:true,maxSpecialists:3,synthesis:'executive',endpoint:'/api/orchestrate'},
    evaluationPlane:{...evaluationPlaneCapabilities(),endpoint:'/api/evals'},
    agents:Object.values(AGENTS).map(({id,name,description,tools})=>({id,name,description,tools}))
  });
}
