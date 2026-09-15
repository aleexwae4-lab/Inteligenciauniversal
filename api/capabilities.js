import { AGENTS } from '../lib/agents.js';
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
    verification:{
      enabled:true,
      version:'cognitive-verification/v34',
      requirementSchema:'universal-requirements/v1',
      coverageSchema:'universal-requirement-coverage/v1',
      failClosedOnHardRequirements:true,
      repairAware:true,
      verifiedConstraints:['list_count','table','json','code','sources','citations','comparison','risks','steps','pros_cons','word_limit','exact_phrase']
    },
    agents:Object.values(AGENTS).map(({id,name,description,tools})=>({id,name,description,tools}))
  });
}
