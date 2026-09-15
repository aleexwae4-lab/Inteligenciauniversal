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

test('mobile v45 remains between v47 transport and v46 semantic voice layers',()=>{
  const server=read('server.js');
  const telemetry=server.indexOf('telemetry-throttle-v47.js?v=47');
  const adaptive=server.indexOf('mobile-runtime-v47.js?v=47');
  const bootstrap=server.indexOf('mobile-bootstrap-v45.js?v=45');
  const semantic=server.indexOf('semantic-ux-v32.js?v=46');
  const voice=server.indexOf('mobile-voice-v46.js?v=46');
  assert.ok(telemetry>=0&&adaptive>telemetry&&bootstrap>adaptive&&semantic>bootstrap&&voice>semantic);
  assert.match(server,/long-session-backpressure-v47/);
  assert.match(server,/universal-core-mobile-v47-long-session/);
});
