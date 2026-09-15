import { AGENTS } from '../lib/agents.js';
import { capabilityDomain, capabilityPlan, capabilitySnapshot } from '../lib/capability-kernel.js';
import { evaluationPlaneCapabilities } from '../lib/evaluation-plane.js';
import { executionPlaneSnapshot } from '../lib/execution-plane.js';
import { auditLedgerSnapshot } from '../lib/audit-ledger.js';
import { toolFabricSnapshot } from '../lib/tool-fabric.js';
import { runtimeHealth } from '../lib/runtime.js';
import { ORCHESTRATOR_VERSION } from '../lib/orchestrator.js';
import { applyHeaders } from '../lib/security.js';

export default function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const health=runtimeHealth();
  const url=new URL(req.url||'/api/capabilities','http://localhost');
  const domainId=url.searchParams.get('domain');
  const planMessage=url.searchParams.get('plan');
  const kernel=capabilitySnapshot();
  const executionPlane=executionPlaneSnapshot();
  const auditLedger=auditLedgerSnapshot();
  const toolFabric=toolFabricSnapshot();

  if(domainId){
    const domain=capabilityDomain(domainId);
    if(!domain)return res.status(404).json({error:'capability_domain_not_found',kernel:kernel.version});
    const tools=toolFabric.tools.filter((tool)=>tool.capabilities.includes(domain.id));
    return res.status(200).json({success:true,kernel:kernel.version,executionPlane:executionPlane.version,auditLedger,toolFabric:toolFabric.version,domain,tools});
  }

  if(planMessage){
    return res.status(200).json({success:true,plan:capabilityPlan(planMessage),executionPlane,auditLedger,toolFabric});
  }

  return res.status(200).json({
    ...health,
    interface:'experience-v8-living-core',
    reasoningProfiles:['auto','deep'],
    orchestration:{schema:ORCHESTRATOR_VERSION,parallel:true,maxSpecialists:3,synthesis:'executive',endpoint:'/api/orchestrate'},
    evaluationPlane:{...evaluationPlaneCapabilities(),endpoint:'/api/evals'},
    executionPlane:{...executionPlane,auditLedger,endpoint:'/api/execute'},
    auditLedger,
    toolFabric,
    capabilityKernel:kernel,
    agents:Object.values(AGENTS).map(({id,name,description,tools})=>({id,name,description,tools}))
  });
}
