import { planNativeMission, verifiedToolSources } from './mission-control-v114.js';

export const MISSION_ORCHESTRATOR_VERSION='universal-mission-orchestrator/v2';

const STAGES=Object.freeze(['intent','planning','tools','evidence','generation','verification','response']);

const clean=(v,max=500)=>String(v??'').trim().slice(0,max);

export function createMissionOrchestration({message='',payload={},history=[],attachments=[],task=null}={}) {
  const mission=planNativeMission(payload,message,history,attachments);
  const requested=Array.isArray(payload.tools)?payload.tools:[];
  const planned=[...new Set([...(mission.toolIds||[]),...requested])];
  return {
    version:MISSION_ORCHESTRATOR_VERSION,
    status:'planned',
    stages:STAGES.map((stage,index)=>({stage,index,status:index===0?'complete':'pending'})),
    intent:{category:task?.category||'unknown',path:task?.path||'STANDARD',risk:task?.risk||'low',complexity:task?.complexity||'medium'},
    mission,
    plannedTools:planned,
    recovery:{enabled:true,maxAttempts:1,strategies:['fallback_tool','degraded_generation','deterministic_continuity']},
  };
}

export function mergeMissionTools(orchestration,tools=[]) {
  const existing=new Set((tools||[]).map(x=>String(x?.tool||'')));
  const planned=(orchestration?.plannedTools||[]).filter(Boolean);
  return [...new Set([...tools,...planned.filter(id=>!existing.has(id)).map(tool=>({tool:id,ok:false,planned:true}))])];
}

export function verifyMissionEvidence(toolResults=[],{requiresEvidence=false}={}) {
  const successful=(toolResults||[]).filter(x=>x?.ok===true);
  const sources=verifiedToolSources(toolResults);
  const failed=(toolResults||[]).filter(x=>x?.ok===false);
  const hasEvidence=sources.length>0;
  const status=requiresEvidence&&!hasEvidence?'missing_evidence':failed.length&&hasEvidence?'partial':'verified';
  return {
    status,
    verified:status==='verified',
    sourceCount:sources.length,
    successfulTools:successful.map(x=>clean(x.tool,100)),
    failedTools:failed.map(x=>({tool:clean(x.tool,100),error:clean(x.error,180)})),
    sources:sources.slice(0,10),
  };
}

export function finalizeMissionOrchestration(orchestration,{toolResults=[],requiresEvidence=false,generationStatus='complete',verificationStatus='pending'}={}) {
  const evidence=verifyMissionEvidence(toolResults,{requiresEvidence});
  const stageStatus=orchestration?.stages?.map(x=>({...x}))||STAGES.map((stage,index)=>({stage,index,status:'pending'}));
  const set=(name,status)=>{const item=stageStatus.find(x=>x.stage===name);if(item)item.status=status;};
  set('intent','complete');set('planning','complete');set('tools',toolResults.length?'complete':'skipped');
  set('evidence',evidence.verified||evidence.status==='partial'?'complete':evidence.status==='missing_evidence'?'blocked':'complete');
  set('generation',generationStatus);set('verification',verificationStatus);set('response',verificationStatus==='failed'?'degraded':'ready');
  return {
    ...orchestration,
    status:verificationStatus==='failed'?'degraded':'ready',
    stages:stageStatus,
    evidence,
    recoveryTriggered:toolResults.some(x=>x?.recovery===true),
    completedAt:new Date().toISOString(),
  };
}

export function missionRecoveryPolicy({toolResults=[],requiresEvidence=false,qualityCritical=false}={}) {
  const evidence=verifyMissionEvidence(toolResults,{requiresEvidence});
  if(requiresEvidence&&!evidence.verified) return {action:'recover_generation',reason:'evidence_missing',priority:'high'};
  if(qualityCritical) return {action:'repair_generation',reason:'quality_gate',priority:'high'};
  if(evidence.status==='partial') return {action:'continue_with_attribution',reason:'partial_evidence',priority:'medium'};
  return {action:'complete',reason:'mission_healthy',priority:'low'};
}
