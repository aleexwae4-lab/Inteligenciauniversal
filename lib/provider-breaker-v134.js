export const PROVIDER_BREAKER_VERSION='provider-breaker/v134';

const state=new Map();
const threshold=Math.max(2,Number(process.env.WAE_PROVIDER_BREAKER_FAILURES)||3);
const cooldownMs=Math.max(15000,Number(process.env.WAE_PROVIDER_BREAKER_COOLDOWN_MS)||60000);

function row(id){
  if(!state.has(id))state.set(id,{failures:0,openedAt:0,openUntil:0,lastFailure:null,lastSuccessAt:null});
  return state.get(id);
}

export function providerCircuitOpen(id,now=Date.now()){
  return row(id).openUntil>now;
}

export function providerCircuitSuccess(id){
  const item=row(id);
  item.failures=0;item.openedAt=0;item.openUntil=0;item.lastFailure=null;item.lastSuccessAt=Date.now();
}

export function providerCircuitFailure(id,code){
  const item=row(id);
  item.failures++;
  item.lastFailure=String(code||'provider_error').slice(0,80);
  if(item.failures>=threshold){
    item.openedAt=Date.now();
    item.openUntil=item.openedAt+cooldownMs;
  }
}

export function providerCircuitSnapshot(providers=[]){
  const now=Date.now();
  return providers.map(provider=>{
    const item=row(provider.id);
    return {
      id:provider.id,
      configured:!!provider.configured,
      model:provider.model||null,
      streaming:!!provider.streaming,
      circuit:item.openUntil>now?'open':'closed',
      failureCount:item.failures,
      cooldownRemainingMs:Math.max(0,item.openUntil-now),
      lastFailure:item.lastFailure,
      lastSuccessAt:item.lastSuccessAt
    };
  });
}
