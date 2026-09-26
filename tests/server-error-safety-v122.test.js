import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('v122: HTTP validation preserves safe 400/413 and blocks source browsing', {timeout:30000},async()=>{
  const port=await freePort();
  process.env.PORT=String(port);
  process.env.WAE_MAX_BODY_BYTES='128';
  const {server}=await import('../server.js?v122_test='+Date.now());
  await new Promise((resolve,reject)=>{
    if(server.listening)return resolve();
    server.once('listening',resolve);
    server.once('error',reject);
  });
  try{
    const base='http://127.0.0.1:'+port;
    const liveness=await fetch(base+'/api/health/liveness');
    assert.equal(liveness.status,200);
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
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
