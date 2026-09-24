import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

const serverSource=readFileSync(new URL('../server.js',import.meta.url),'utf8');

test('v122: server never returns raw thrown messages on HTTP 5xx',()=>{
  assert.match(serverSource,/const publicError = status === 400/);
  assert.match(serverSource,/status === 413 && error\?\.message === 'request_body_too_large'/);
  assert.match(serverSource,/'internal_error'/);
  assert.doesNotMatch(serverSource,/res\.end\(JSON\.stringify\(\{ error: error\.message/);
});

test('v122: streaming failures do not append JSON to a partial response',()=>{
  assert.match(serverSource,/if \(res\.headersSent\) \{\s*if \(!res\.writableEnded\) res\.destroy\(\);\s*return;/);
});

async function freePort(){
  const socket=createServer();
  socket.listen(0,'127.0.0.1');
  await once(socket,'listening');
  const port=socket.address().port;
  await new Promise(resolve=>socket.close(resolve));
  return port;
}

test('v122: HTTP validation preserves safe 400/413 and blocks source browsing', {timeout:12000},async t=>{
  const port=await freePort();
  const child=spawn(process.execPath,['server.js'],{
    cwd:new URL('..',import.meta.url),
    env:{...process.env,PORT:String(port),WAE_MAX_BODY_BYTES:'128'},
    stdio:['ignore','pipe','pipe']
  });
  t.after(()=>child.kill());
  const base='http://127.0.0.1:'+port;
  let ready=false;
  for(let attempt=0;attempt<70;attempt++){
    if(child.exitCode!==null)break;
    try{
      const result=await fetch(base+'/api/health/liveness',{signal:AbortSignal.timeout(200)});
      if(result.status===200){ready=true;break}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,75));
  }
  assert.ok(ready,'test server did not become ready');
  const malformed=await fetch(base+'/api/chat',{
    method:'POST',headers:{'content-type':'application/json'},body:'{invalid'
  });
  assert.equal(malformed.status,400);
  assert.deepEqual(await malformed.json(),{error:'invalid_json'});
  const large=await fetch(base+'/api/chat',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'x'.repeat(180)})
  });
  assert.equal(large.status,413);
  assert.deepEqual(await large.json(),{error:'request_body_too_large'});
  const source=await fetch(base+'/server.js');
  assert.equal(source.status,404);
});
