import { safeProgressEvent } from './progressive-intelligence-v133.js';
export const CONVERSATION_E2E_VERSION='conversation-e2e/v130';
export const CONVERSATION_E2E_STAGES=Object.freeze(['router','memory','tools','provider','sources','persistence','ui','voice']);

const allowedStatus=new Set(['ok','recovered','skipped','failed','unobserved']);

function safe(value,max=96){
  if(value===null||value===undefined)return null;
  const text=String(value).trim().replace(/[\r\n\t]+/g,' ');
  return text.slice(0,max)||null;
}
function count(value){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.floor(n):0}

export function createConversationTrace({route='render',onProgress=null}={}){
  const started=Date.now();
  const stages=new Map();
  const beginTimes=new Map();

  const emit=event=>{if(typeof onProgress==='function'&&event)try{onProgress(event)}catch{}};
  const begin=id=>{
    if(!CONVERSATION_E2E_STAGES.includes(id))return;
    beginTimes.set(id,Date.now());
    emit(safeProgressEvent({phase:'begin',stage:id,status:'running'}));
  };
  const end=(id,status='ok',details={})=>{
    if(!CONVERSATION_E2E_STAGES.includes(id))return;
    const startedAt=beginTimes.get(id)||Date.now();
    const item={id,status:allowedStatus.has(status)?status:'ok',latencyMs:Math.max(0,Date.now()-startedAt)};
    for(const [key,value] of Object.entries(details||{})){
      if(value===undefined)continue;
      if(typeof value==='boolean')item[key]=value;
      else if(typeof value==='number')item[key]=Number.isFinite(value)?value:null;
      else if(Array.isArray(value))item[key]=value.slice(0,8).map(v=>safe(v,64)).filter(Boolean);
      else item[key]=safe(value);
    }
    stages.set(id,item);
    emit(safeProgressEvent({phase:'end',stage:id,status:item.status,latencyMs:item.latencyMs,details:item}));
  };

  const snapshot=(extra={})=>{
    const ordered=CONVERSATION_E2E_STAGES.map(id=>stages.get(id)||{id,status:'unobserved',latencyMs:0});
    const recovered=ordered.filter(s=>s.status==='recovered').length;
    const failed=ordered.filter(s=>s.status==='failed').length;
    return {
      version:CONVERSATION_E2E_VERSION,
      route:safe(route,48),
      status:failed?'failed':recovered?'recovered':'ok',
      recovered:recovered>0,
      recoveryCount:recovered,
      failedStageCount:failed,
      latencyMs:Math.max(0,Date.now()-started),
      stages:ordered,
      ...extra
    };
  };

  const attachFailure=(error,stage,code='stage_failed')=>{
    end(stage,'failed',{code});
    try{error.e2e=snapshot()}catch{}
    return error;
  };

  return {begin,end,snapshot,attachFailure};
}

export function clientTurnTrace({route='supabase-primary',provider=null,model=null,sourceCount=0,recovered=false,latencyMs=null}={}){
  const stages=CONVERSATION_E2E_STAGES.map(id=>{
    if(id==='router')return {id,status:'ok',latencyMs:0};
    if(id==='provider')return {id,status:recovered?'recovered':'ok',latencyMs:0,provider:safe(provider),model:safe(model,120)};
    if(id==='sources')return {id,status:'ok',latencyMs:0,count:count(sourceCount)};
    if(id==='ui')return {id,status:'ok',latencyMs:0};
    if(id==='voice')return {id,status:'unobserved',latencyMs:0};
    return {id,status:'unobserved',latencyMs:0};
  });
  return {
    version:CONVERSATION_E2E_VERSION,route:safe(route,48),
    status:recovered?'recovered':'ok',recovered:!!recovered,recoveryCount:recovered?1:0,
    failedStageCount:0,latencyMs:Number.isFinite(Number(latencyMs))?Math.max(0,Math.round(Number(latencyMs))):null,stages
  };
}
