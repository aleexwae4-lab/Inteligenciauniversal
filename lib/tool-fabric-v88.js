import {
  toolFabricSnapshot as baseToolFabricSnapshot,
  getToolDefinition as getBaseToolDefinition,
  resolveTool as resolveBaseTool,
  validateToolInput as validateBaseToolInput,
} from './tool-fabric.js';
import {
  OPEN_SOURCE_CAPABILITY_MESH_VERSION,
  openSourceMeshSnapshot,
  getOpenSourceToolDefinition,
  resolveOpenSourceTool,
  validateOpenSourceToolInput,
} from './open-source-capability-mesh-v88.js';

export const TOOL_FABRIC_V88_VERSION='universal-tool-fabric/v88-open-source-zero-cost';

function isOssId(id=''){return String(id||'').toLowerCase().startsWith('oss.')}

export function toolFabricSnapshot(){
  const base=baseToolFabricSnapshot();
  const oss=openSourceMeshSnapshot();
  const tools=[...(base.tools||[]),...(oss.tools||[])];
  return{
    ...base,
    version:TOOL_FABRIC_V88_VERSION,
    baseVersion:base.version,
    openSourceMesh:OPEN_SOURCE_CAPABILITY_MESH_VERSION,
    policy:{
      ...(base.policy||{}),
      zeroCostOpenSourcePreferred:true,
      paidApiAutoActivation:false,
      ossUnconfiguredFailClosed:true,
      networkCopyleftDeclared:true,
    },
    toolCount:tools.length,
    configuredToolCount:tools.filter(tool=>tool.configured).length,
    enabledToolCount:tools.filter(tool=>tool.enabled).length,
    tools,
    openSource:oss,
  };
}

export function getToolDefinition(id){
  const wanted=String(id||'').trim().toLowerCase();
  return isOssId(wanted)?getOpenSourceToolDefinition(wanted):getBaseToolDefinition(wanted);
}

export function resolveTool(capability,action=''){
  let oss=null;
  try{oss=resolveOpenSourceTool(capability,action)}catch{oss=null}
  const base=resolveBaseTool(capability,action);
  if(oss?.configured)return oss;
  if(base?.configured)return base;
  return oss||base||null;
}

export function validateToolInput(toolId,payload={}){
  return isOssId(toolId)?validateOpenSourceToolInput(toolId,payload):validateBaseToolInput(toolId,payload);
}
