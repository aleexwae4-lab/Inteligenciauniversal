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

test('mobile v45 remains between v34 transport and v46 semantic voice layers',()=>{
  const server=read('server.js');
  const adaptive=server.indexOf('mobile-runtime-v34.js?v=44');
  const bootstrap=server.indexOf('mobile-bootstrap-v45.js?v=45');
  const semantic=server.indexOf('semantic-ux-v32.js?v=46');
  const voice=server.indexOf('mobile-voice-v46.js?v=46');
  assert.ok(adaptive>=0&&bootstrap>adaptive&&semantic>bootstrap&&voice>semantic);
  assert.match(server,/voice-chat-deadline-v46/);
  assert.match(server,/universal-core-mobile-v46-responsive-voice/);
});