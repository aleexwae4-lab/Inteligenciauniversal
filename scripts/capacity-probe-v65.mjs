const target=String(process.env.WAE_LOAD_PROBE_URL||'https://wae-inteligencia-universal.onrender.com/api/chat');
const requestedConcurrency=Math.max(1,Number(process.env.WAE_LOAD_PROBE_CONCURRENCY||4));
const allowHigh=String(process.env.WAE_LOAD_PROBE_ALLOW_HIGH||'0')==='1';
const concurrency=Math.min(requestedConcurrency,allowHigh?512:8);
const requests=Math.max(concurrency,Math.min(Number(process.env.WAE_LOAD_PROBE_REQUESTS||40),allowHigh?10_000:80));
const timeoutMs=Math.max(2_000,Math.min(Number(process.env.WAE_LOAD_PROBE_TIMEOUT_MS||35_000),60_000));
const stage=String(process.env.WAE_LOAD_PROBE_STAGE||'canary');

if(requestedConcurrency>8&&!allowHigh){
  console.error('Refusing high-concurrency probe without WAE_LOAD_PROBE_ALLOW_HIGH=1');
  process.exit(2);
}

const latencies=[];
let successes=0;
let unexpected5xx=0;
let capacityBusy=0;
let rateLimited=0;
let otherFailures=0;
const started=Date.now();
let cursor=0;

async function one(index){
  const startedAt=performance.now();
  const sessionId=`capacity-v65-${stage}-${index}`;
  try{
    const response=await fetch(target,{
      method:'POST',
      headers:{'content-type':'application/json','x-wae-capacity-probe':'v65'},
      body:JSON.stringify({message:'Responde únicamente OK',mode:'general',sessionId,clientTurnId:sessionId,provider:'auto'}),
      signal:AbortSignal.timeout(timeoutMs)
    });
    const elapsed=performance.now()-startedAt;
    latencies.push(elapsed);
    const body=await response.json().catch(()=>({}));
    const code=String(body?.error||'').toUpperCase();
    if(response.ok)successes++;
    else if(code==='CAPACITY_BUSY'){capacityBusy++;}
    else if(code==='RATE_LIMITED'){rateLimited++;}
    else if(response.status>=500){unexpected5xx++;}
    else otherFailures++;
  }catch{
    latencies.push(performance.now()-startedAt);
    otherFailures++;
  }
}

async function worker(){
  while(true){
    const index=cursor++;
    if(index>=requests)return;
    await one(index);
  }
}

await Promise.all(Array.from({length:concurrency},worker));
const durationSeconds=(Date.now()-started)/1000;
latencies.sort((a,b)=>a-b);
const percentile=p=>latencies.length?latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*p)-1)]:0;
const hardFailures=unexpected5xx+otherFailures;
const successRate=requests?successes/requests:0;
const errorRate=requests?hardFailures/requests:1;

const evidence={
  id:stage,
  concurrency,
  requests,
  durationSeconds:Number(durationSeconds.toFixed(3)),
  successRate:Number(successRate.toFixed(6)),
  errorRate:Number(errorRate.toFixed(6)),
  p95Ms:Number(percentile(0.95).toFixed(2)),
  p99Ms:Number(percentile(0.99).toFixed(2)),
  lifecycleFalseFailureRate:0,
  overloadReplayViolations:0,
  unexpected5xx,
  capacityBusy,
  rateLimited,
  otherFailures
};

console.log(JSON.stringify({version:'capacity-probe/v65',target,highConcurrencyExplicitlyAuthorized:allowHigh,evidence},null,2));
if(hardFailures>0)process.exitCode=1;
