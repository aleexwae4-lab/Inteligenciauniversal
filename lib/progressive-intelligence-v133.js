export const TURN_PROGRESS_VERSION='turn-progress/v133';
export const TURN_PROGRESS_STAGES=Object.freeze(['router','memory','tools','provider','sources','persistence']);

const allowedStatus=new Set(['running','ok','recovered','skipped','failed']);
const safeDetailKeys=new Set([
  'strategy','mode','research','attachments','requestedTools','recalled','configured',
  'attempted','succeeded','failed','tools','provider','model','fallbackCount',
  'count','required','saved','code'
]);

function clean(value,max=96){
  if(value===null||value===undefined)return null;
  const text=String(value).trim().replace(/[\r\n\t]+/g,' ');
  return text.slice(0,max)||null;
}

export function safeProgressEvent({phase='begin',stage='',status='running',latencyMs=0,details={}}={}){
  if(!TURN_PROGRESS_STAGES.includes(stage))return null;
  const event={
    version:TURN_PROGRESS_VERSION,
    type:'stage',
    phase:phase==='end'?'end':'begin',
    stage,
    status:allowedStatus.has(status)?status:(phase==='end'?'ok':'running'),
    latencyMs:Number.isFinite(Number(latencyMs))?Math.max(0,Math.round(Number(latencyMs))):0
  };
  const publicDetails={};
  for(const [key,value] of Object.entries(details||{})){
    if(!safeDetailKeys.has(key)||value===undefined)continue;
    if(typeof value==='boolean')publicDetails[key]=value;
    else if(typeof value==='number')publicDetails[key]=Number.isFinite(value)?value:null;
    else if(Array.isArray(value))publicDetails[key]=value.slice(0,8).map(item=>clean(item,64)).filter(Boolean);
    else publicDetails[key]=clean(value,key==='model'?120:96);
  }
  if(Object.keys(publicDetails).length)event.details=publicDetails;
  return event;
}

export function progressiveContract(){
  return {
    version:TURN_PROGRESS_VERSION,
    transport:'server-sent-events',
    stages:[...TURN_PROGRESS_STAGES],
    contentRelease:'after-quality-and-persistence',
    tokenStreaming:false
  };
}
