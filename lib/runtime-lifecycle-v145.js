export const RUNTIME_LIFECYCLE_VERSION='v145';

const state={
  phase:'booting',
  startedAt:new Date().toISOString(),
  readyAt:null,
  drainStartedAt:null,
  drainReason:null,
  startupChecks:null
};

function major(version=process.version){
  const match=String(version).match(/v?(\d+)/);
  return match?Number(match[1]):0;
}

export function startupSafety({port,maxBodyBytes,nodeVersion=process.version}={}){
  const issues=[];
  const p=Number(port);
  const body=Number(maxBodyBytes);
  if(!Number.isInteger(p)||p<1||p>65535)issues.push('invalid_port');
  if(!Number.isFinite(body)||body<64||body>16*1024*1024)issues.push('invalid_body_limit');
  if(major(nodeVersion)<22)issues.push('unsupported_node_major');
  return {
    ok:issues.length===0,
    issues,
    nodeVersion:String(nodeVersion),
    requiredNodeMajor:22,
    port:p,
    maxBodyBytes:body
  };
}

export function assertStartupSafety(input={}){
  const checks=startupSafety(input);
  state.startupChecks=checks;
  if(!checks.ok){
    const error=new Error('runtime_startup_safety_failed');
    error.code='RUNTIME_STARTUP_SAFETY_FAILED';
    error.issues=checks.issues;
    throw error;
  }
  return checks;
}

export function markRuntimeReady(){
  if(state.phase==='draining')return lifecycleSnapshot();
  state.phase='ready';
  state.readyAt=new Date().toISOString();
  return lifecycleSnapshot();
}

export function beginRuntimeDrain(reason='shutdown'){
  if(state.phase!=='draining'){
    state.phase='draining';
    state.drainStartedAt=new Date().toISOString();
    state.drainReason=String(reason||'shutdown').slice(0,80);
  }
  return lifecycleSnapshot();
}

export function lifecycleSnapshot(){
  return {
    version:RUNTIME_LIFECYCLE_VERSION,
    phase:state.phase,
    acceptingTraffic:state.phase==='ready',
    startedAt:state.startedAt,
    readyAt:state.readyAt,
    drainStartedAt:state.drainStartedAt,
    drainReason:state.drainReason,
    startupChecks:state.startupChecks
  };
}
