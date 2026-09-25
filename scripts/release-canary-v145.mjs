const base=String(process.env.WAE_CANARY_BASE_URL||'https://inteligenciauniversal.onrender.com').replace(/\/$/,'');
const expected=String(process.env.WAE_EXPECTED_COMMIT||'').trim();
const attempts=Math.max(1,Math.min(36,Number(process.env.WAE_CANARY_ATTEMPTS||24)));
const delayMs=Math.max(1000,Math.min(30000,Number(process.env.WAE_CANARY_DELAY_MS||10000)));

async function read(path){
  const response=await fetch(base+path,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(8000)});
  const text=await response.text();
  let body={};
  try{body=text?JSON.parse(text):{}}catch{body={invalidJson:true}}
  return {status:response.status,body};
}

function releaseCommit(...results){
  for(const result of results){
    const value=result?.body?.release?.commit;
    if(value)return String(value);
  }
  return '';
}

for(let attempt=1;attempt<=attempts;attempt++){
  try{
    const [live,ready,canary]=await Promise.all([
      read('/api/health/liveness'),
      read('/api/health/readiness'),
      read('/api/health/canary')
    ]);
    const commit=releaseCommit(canary,ready,live);
    const commitMatches=!expected||commit===expected;
    const healthy=live.status===200&&ready.status===200&&canary.status===200&&live.body?.ok===true&&ready.body?.ok===true&&canary.body?.ok===true;
    console.log(JSON.stringify({attempt,healthy,commitMatches,commit:commit||null,liveness:live.status,readiness:ready.status,canary:canary.status}));
    if(healthy&&commitMatches){
      console.log('Universal Core production canary PASS');
      process.exit(0);
    }
  }catch(error){
    console.log(JSON.stringify({attempt,error:String(error?.name||error?.message||'canary_error')}));
  }
  if(attempt<attempts)await new Promise(resolve=>setTimeout(resolve,delayMs));
}
console.error('Universal Core production canary FAILED');
process.exit(1);
