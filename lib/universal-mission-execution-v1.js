export const UNIVERSAL_MISSION_EXECUTION_VERSION='universal-mission-execution/v1';

const PHASES=['scope','research','design','execute','verify','deliver'];
const clean=(s='',n=700)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);

function toolState(toolResults=[]){
  const list=Array.isArray(toolResults)?toolResults:[];
  return {
    attempted:list.length>0,
    successful:list.filter(x=>x?.ok===true).map(x=>clean(x.tool,100)),
    failed:list.filter(x=>x?.ok===false).map(x=>({tool:clean(x.tool,100),error:clean(x.error,240)})),
    planned:list.filter(x=>x?.planned===true).map(x=>clean(x.tool,100))
  };
}

export function buildMissionExecutionState({message='',director=null,toolResults=[],executionProof=null}={}){
  const tools=toolState(toolResults);
  const complex=director?.mission?.complex===true||Array.isArray(director?.phases)&&director.phases.length>1;
  const evidence=executionProof?.verification_status||'not_executed';
  const hasSuccess=tools.successful.length>0;
  const hasFailure=tools.failed.length>0;
  const phaseState=PHASES.map((phase,index)=>{
    let status='planned',proof='not_executed';
    if(!complex&&phase!=='deliver') status='not_applicable';
    else if(phase==='scope') status='complete';
    else if(phase==='research') status=tools.successful.length||evidence==='verified'?'complete':'pending';
    else if(phase==='design') status=complex?'complete':'not_applicable';
    else if(phase==='execute'){status=hasSuccess?'complete':hasFailure?'failed':'pending';proof=hasSuccess?'tool_result':'not_executed'}
    else if(phase==='verify'){status=evidence==='verified'?'complete':hasFailure?'partial':'pending';proof=evidence}
    else if(phase==='deliver') status=(evidence==='verified'||(!hasFailure&&(!complex||hasSuccess)))?'ready':'blocked';
    return {phase,index,status,proof};
  });
  const blocked=phaseState.some(x=>x.status==='blocked'||x.status==='failed');
  const next=phaseState.find(x=>['pending','failed','blocked'].includes(x.status));
  const completed=phaseState.filter(x=>x.status==='complete').length;
  return {
    version:UNIVERSAL_MISSION_EXECUTION_VERSION,
    missionId:'mission-'+Date.now().toString(36),
    objective:clean(message,1000),
    state:blocked?'attention':next?.status==='pending'?'in_progress':'ready',
    phases:phaseState,
    nextPhase:next?.phase||'deliver',
    progress:Math.round((completed/phaseState.filter(x=>x.status!=='not_applicable').length)*100),
    execution:{attempted:tools.attempted,successfulTools:tools.successful,failedTools:tools.failed,plannedTools:tools.planned},
    proof:{verificationStatus:evidence,hasExecutionReceipt:Boolean(executionProof?.external_action_executed),proofVersion:executionProof?.version||null},
    recovery:{retryBudget:1,retryUsed:false,rollbackOnlyIfToolSupportsIt:true,failClosed:true},
    policy:{planningIsNotExecution:true,toolResultsAreRequiredForExecutionClaims:true,verificationRequiredBeforeCompletion:true,noSyntheticReceipts:true,noAutomaticExternalWrites:true}
  };
}

export function missionExecutionInstruction(state){
  if(!state)return '';
  return '\n\nFABRIC DE EJECUCIÓN DE MISIÓN ('+UNIVERSAL_MISSION_EXECUTION_VERSION+'):\n'+JSON.stringify(state)+'\n- Usa este estado como máquina de estados, no como registro ficticio.\n- Solo marca execute como completado cuando exista resultado real de una herramienta.\n- Solo marca verify como completado cuando exista evidencia verificable.\n- Si una fase está blocked/failed, dilo y conserva el error; no lo ocultes.\n- Nunca inventes recibos, cambios externos, archivos creados o despliegues.\n- Respeta el presupuesto de reintento y no repitas acciones con efectos externos sin autorización.\n';
}

export function publicMissionExecution(state){
  if(!state)return null;
  return {version:state.version,missionId:state.missionId,objective:state.objective,state:state.state,phases:state.phases,nextPhase:state.nextPhase,progress:state.progress,execution:state.execution,proof:state.proof,recovery:state.recovery,policy:state.policy};
}
