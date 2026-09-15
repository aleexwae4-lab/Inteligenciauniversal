import { AGENTS } from '../lib/agents.js';
import { capabilityDomain, capabilityPlan, capabilitySnapshot } from '../lib/capability-kernel.js';
import { evaluationPlaneCapabilities } from '../lib/evaluation-plane.js';
import { executionPlaneSnapshot } from '../lib/execution-plane.js';
import { toolFabricSnapshot } from '../lib/tool-fabric.js';
import { runtimeHealth } from '../lib/runtime.js';
import { ORCHESTRATOR_VERSION } from '../lib/orchestrator.js';
import { EXECUTIVE_ORCHESTRATION_VERSION } from '../lib/executive-orchestration-v52.js';
import { LIBRARY_INTELLIGENCE_VERSION } from '../lib/library-intelligence-v52.js';
import { UNIVERSAL_CONTEXT_VERSION, getUniversalSelfDescription } from '../lib/universal-context-v52.js';
import { benchmarkSuiteManifest } from '../lib/supremacy-benchmark-v62.js';
import { continuousImprovementCapabilities, getContinuousImprovementStatus } from '../lib/continuous-improvement-v54.js';
import { answerIntelligenceCapabilities } from '../lib/answer-intelligence-v60.js';
import { qualityReliabilityCapabilities } from '../lib/quality-reliability-v61.js';
import { performanceRouterCapabilities, providerMeshSnapshot } from '../lib/provider-mesh-v63.js';
import { scaleControlCapabilities, scaleControlSnapshot } from '../lib/scale-control-v63.js';
import { capacityCertificationCapabilities } from '../lib/capacity-certification-v65.js';
import { applyHeaders } from '../lib/security.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const health=runtimeHealth();
  const url=new URL(req.url||'/api/capabilities','http://localhost');
  const domainId=url.searchParams.get('domain');
  const planMessage=url.searchParams.get('plan');
  const kernel=capabilitySnapshot();
  const executionPlane=executionPlaneSnapshot();
  const toolFabric=toolFabricSnapshot();

  if(domainId){
    const domain=capabilityDomain(domainId);
    if(!domain)return res.status(404).json({error:'capability_domain_not_found',kernel:kernel.version});
    const tools=toolFabric.tools.filter((tool)=>tool.capabilities.includes(domain.id));
    return res.status(200).json({success:true,kernel:kernel.version,executionPlane:executionPlane.version,toolFabric:toolFabric.version,domain,tools});
  }

  if(planMessage)return res.status(200).json({success:true,plan:capabilityPlan(planMessage),executionPlane,toolFabric});

  let coreContext=null;
  let improvementStatus=null;
  try{[coreContext,improvementStatus]=await Promise.all([getUniversalSelfDescription(),getContinuousImprovementStatus()])}catch{}
  const executive=coreContext?.executiveOrchestration||{};
  const library=coreContext?.library||{};
  const arena={...benchmarkSuiteManifest(),endpoint:'/api/evals',actions:['suite','certify','certify_and_record']};

  return res.status(200).json({
    ...health,
    interface:'experience-v8-living-core',
    reasoningProfiles:['auto','deep'],
    answerIntelligence:answerIntelligenceCapabilities(),
    qualityReliability:qualityReliabilityCapabilities(),
    scaleControl:{...scaleControlCapabilities(),snapshot:scaleControlSnapshot()},
    capacityCertification:{...capacityCertificationCapabilities(),endpoint:'/api/capacity-certification',actions:['evaluate','certify_and_record']},
    performanceRouter:{...performanceRouterCapabilities(),snapshot:providerMeshSnapshot()},
    orchestration:{
      schema:EXECUTIVE_ORCHESTRATION_VERSION,
      legacySchema:ORCHESTRATOR_VERSION,
      databaseBacked:true,
      parallel:true,
      maxSpecialists:3,
      synthesis:'Universal Core',
      endpoint:'/api/orchestrate',
      activeAgentInstances:Number(executive.activeAgentInstances||0),
      executiveRoles:Number(executive.executiveRoles||0),
      collaborationEdges:Number(executive.collaborationEdges||0)
    },
    libraryIntelligence:{
      version:LIBRARY_INTELLIGENCE_VERSION,
      contextVersion:UNIVERSAL_CONTEXT_VERSION,
      rightsAware:true,
      federatedMetadataCoverageEstimate:Number(library.federatedMetadataCoverageEstimate||0),
      fulltextCoverageEstimate:Number(library.fulltextCoverageEstimate||0),
      localBooks:Number(library.localBooks||0),
      localFulltextBooks:Number(library.localFulltextBooks||0),
      localChunks:Number(library.localChunks||0),
      claimPolicy:{allowed:'connected_to_millions_of_bibliographic_records_and_open_collections',forbidden:'millions_of_full_copyrighted_books_loaded'}
    },
    evaluationPlane:{...evaluationPlaneCapabilities(),endpoint:'/api/evals'},
    benchmarkArena:arena,
    supremacyBenchmark:arena,
    continuousImprovement:continuousImprovementCapabilities(improvementStatus||undefined),
    executionPlane:{...executionPlane,endpoint:'/api/execute'},
    toolFabric,
    capabilityKernel:kernel,
    agents:Object.values(AGENTS).map(({id,name,description,tools})=>({id,name,description,tools}))
  });
}
