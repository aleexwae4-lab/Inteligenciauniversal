import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('mobile v45 removes blocking Supabase bootstrap from the interactive path',()=>{
  const source=read('mobile-bootstrap-v45.js');
  assert.match(source,/action==='bootstrap'/);
  assert.match(source,/bootstrap:'local_nonblocking'/);
  assert.match(source,/renderPrimary:true/);
  assert.match(source,/edgeBlocking:false/);
  assert.match(source,/Promise\.resolve\(bootstrapResponse\(\)\)/);
  assert.doesNotMatch(source,/setTimeout\([^)]*15000/);
});

test('mobile v45 keeps v34 adaptive chat routing and loads immediately after it',()=>{
  const server=read('server.js');
  const adaptive=server.indexOf('mobile-runtime-v34.js?v=44');
  const bootstrap=server.indexOf('mobile-bootstrap-v45.js?v=45');
  const voice=server.indexOf('mobile-voice-v27.js?v=34');
  assert.ok(adaptive>=0&&bootstrap>adaptive&&voice>bootstrap);
  assert.match(server,/X-WAE-Mobile-Fix','render-first-bootstrap-v45'/);
  assert.match(server,/universal-core-mobile-v34-adaptive-mesh/);
});
