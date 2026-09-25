import { AGENTS } from '../lib/agents.js';
import { runtimeHealth } from '../lib/runtime.js';
import { capabilitySnapshot } from '../lib/core-self-description.js';
import { applyHeaders } from '../lib/security.js';

export default function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const health=runtimeHealth();
  return res.status(200).json({
    ...health,
    capabilityMatrix:capabilitySnapshot(),
    agents:Object.values(AGENTS).map(({id,name,description,tools})=>({id,name,description,tools}))
  });
}
