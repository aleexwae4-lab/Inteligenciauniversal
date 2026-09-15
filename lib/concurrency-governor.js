const MAX_ACTIVE=Math.max(4,Number(process.env.WAE_MAX_CONCURRENT_CHAT||48));
const MAX_PER_KEY=Math.max(1,Number(process.env.WAE_MAX_CONCURRENT_PER_SESSION||1));
const RETRY_AFTER_MS=Math.max(250,Number(process.env.WAE_CAPACITY_RETRY_AFTER_MS||750));

let active=0;
const byKey=new Map();

function safeKey(value='anonymous'){
  return String(value||'anonymous').slice(0,180);
}

export function tryAcquireChatSlot(key='anonymous'){
  const k=safeKey(key),current=Number(byKey.get(k)||0);
  if(current>=MAX_PER_KEY){
    return {ok:false,reason:'conversation_busy',retryAfterMs:RETRY_AFTER_MS,active,maxActive:MAX_ACTIVE};
  }
  if(active>=MAX_ACTIVE){
    return {ok:false,reason:'global_capacity',retryAfterMs:RETRY_AFTER_MS,active,maxActive:MAX_ACTIVE};
  }
  active+=1;
  byKey.set(k,current+1);
  let released=false;
  return {
    ok:true,
    active,
    maxActive:MAX_ACTIVE,
    release(){
      if(released)return;
      released=true;
      active=Math.max(0,active-1);
      const next=Math.max(0,Number(byKey.get(k)||1)-1);
      if(next===0)byKey.delete(k);else byKey.set(k,next);
    }
  };
}

export function capacitySnapshot(){
  return {active,maxActive:MAX_ACTIVE,maxPerSession:MAX_PER_KEY,trackedSessions:byKey.size};
}
