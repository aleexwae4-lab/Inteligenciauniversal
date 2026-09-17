import { buildContextIntelligenceV102, CONTEXT_INTELLIGENCE_V102 } from './context-intelligence-v102.js';
import { buildProfessionalOrganizationGraphV102, PROFESSIONAL_ORG_GRAPH_V102 } from './professional-organization-graph-v102.js';
import { routeAdaptiveCapabilitiesV102, ADAPTIVE_CAPABILITY_ROUTER_V102 } from './adaptive-capability-router-v102.js';
import { planMemoryFabricV102, publicMemoryFabricV102, memoryInstructionV102, MEMORY_FABRIC_V102 } from './memory-fabric-v102.js';
import { compileAssetV102, assetSystemInstructionV102, ASSET_COMPILER_V102 } from './asset-compiler-v102.js';

export const ADAPTIVE_ASSET_INTELLIGENCE_V102='adaptive-asset-intelligence/v102';
const MARKER='[WAE ADAPTIVE ASSET INTELLIGENCE v102';

function preferredMode(context={}){const domain=context.task?.workingDomain;const intent=context.task?.intent;if(context.task?.current===true||intent==='research')return'research';if(domain==='software'&&['build','debug'].includes(intent))return'code';if(domain==='executive'&&['plan','decide','analyze'].includes(intent))return'executive';if(['legal','forensic','engineering','finance','government','health'].includes(domain)&&['analyze','draft','decide','plan'].includes(intent))return'analysis';return null}

export function buildAdaptiveAssetIntelligenceV102(body={}){const context=buildContextIntelligenceV102(body);const graph=buildProfessionalOrganizationGraphV102(context);const routing=routeAdaptiveCapabilitiesV102(context,graph);const memory=planMemoryFabricV102(body,context);const asset=compileAssetV102({context,graph,routing});const instruction=`${assetSystemInstructionV102({context,graph,routing,memory,asset})}\n${memoryInstructionV102(memory)}`;return{version:ADAPTIVE_ASSET_INTELLIGENCE_V102,context,graph,routing,memory,asset,instruction}}

export function publicAdaptiveAssetContextV102(plan={}){return{version:ADAPTIVE_ASSET_INTELLIGENCE_V102,active:plan.context?.active===true,context:{version:CONTEXT_INTELLIGENCE_V102,operator_domain:plan.context?.operatorDomain||'general',task_domain:plan.context?.task?.domain||'general',working_domain:plan.context?.task?.workingDomain||'general',intent:plan.context?.task?.intent||'answer',complexity:plan.context?.task?.complexity||'simple',current:plan.context?.task?.current===true,operator_provenance:plan.context?.provenance?.operator||'unknown',organization_provenance:plan.context?.provenance?.organization||'unknown',confidence:plan.context?.confidence||{}},professional_graph:{version:PROFESSIONAL_ORG_GRAPH_V102,domains:plan.graph?.domains||['general'],primary_domain:plan.graph?.primaryDomain||'general',specialist_count:plan.graph?.specialists?.length||0,workspace:plan.graph?.workspace||[],risk:plan.graph?.risk||'low'},capability_router:{version:ADAPTIVE_CAPABILITY_ROUTER_V102,specialists:plan.routing?.specialists||[],capabilities:plan.routing?.capabilities||[],tools:plan.routing?.tools||[],orchestration:plan.routing?.orchestration||'single_core',verification:plan.routing?.verification||{}},memory:publicMemoryFabricV102(plan.memory||{}),asset:{version:ASSET_COMPILER_V102,type:plan.asset?.assetType||'actionable_answer',structure:plan.asset?.structure||'',quality_gate:plan.asset?.qualityGate||{}}}}

export function applyAdaptiveAssetIntelligenceV102(body={}){
  if(body?.adaptive_asset_intelligence_version===ADAPTIVE_ASSET_INTELLIGENCE_V102&&body?.adaptive_asset_context)return{body:{...body},plan:null,publicContext:body.adaptive_asset_context};
  const plan=buildAdaptiveAssetIntelligenceV102(body);const existing=String(body.preferences?.projectInstructions||'').trim();const projectInstructions=existing.includes(MARKER)?existing:[existing,plan.instruction].filter(Boolean).join('\n\n');const mode=String(body.mode||'').trim();const suggested=preferredMode(plan.context);
  const next={...body,preferences:{...(body.preferences||{}),projectInstructions,responseDepth:body.preferences?.responseDepth||(plan.context.task?.complexity==='deep'?'deep':'balanced')},adaptive_asset_intelligence:true,adaptive_asset_intelligence_version:ADAPTIVE_ASSET_INTELLIGENCE_V102};
  if(plan.memory?.partitioned&&plan.memory.scopedUserKey)next.userKey=plan.memory.scopedUserKey;
  if((!mode||mode==='auto'||mode==='general')&&suggested)next.mode=suggested;
  if(plan.routing?.orchestration==='specialist_council'&&body.multiagent===undefined)next.multiagent=true;
  if(plan.routing?.requiresLiveEvidence&&body.web_enabled!==false)next.web_enabled=true;
  const publicContext=publicAdaptiveAssetContextV102(plan);next.adaptive_asset_context=publicContext;return{body:next,plan,publicContext};
}

export function adaptiveAssetVersionsV102(){return{adaptiveAssetIntelligence:ADAPTIVE_ASSET_INTELLIGENCE_V102,contextIntelligence:CONTEXT_INTELLIGENCE_V102,professionalOrganizationGraph:PROFESSIONAL_ORG_GRAPH_V102,adaptiveCapabilityRouter:ADAPTIVE_CAPABILITY_ROUTER_V102,memoryFabric:MEMORY_FABRIC_V102,assetCompiler:ASSET_COMPILER_V102}}
