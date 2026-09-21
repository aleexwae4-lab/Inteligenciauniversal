import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('premium controls and renderer parse as JavaScript',()=>{
  for(const name of ['premium-controls-v1.js','gpt-experience-v1.js','app.js']){
    assert.doesNotThrow(()=>new Script(file(name),{filename:name}));
  }
});
test('existing interface loads behavior and styling without replacing shell',()=>{
  const html=file('index.html');
  assert.match(html,/premium-controls-v1\.js\?v=1/);
  assert.match(html,/premium-controls-v1\.css\?v=1/);
  for(const id of ['messages','composer','workspace','documentEditor','mobileSafeInput']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
});
test('response actions and navigation use real APIs',()=>{
  const code=file('premium-controls-v1.js');
  for(const feature of ['.copy-answer','.speak-answer','wae-open-workspace','/api/health','/api/capabilities','/api/knowledge/health','/api/tools']){
    assert.ok(code.includes(feature),feature);
  }
});
test('tables never silently discard content on malformed markdown',()=>{
  const code=file('gpt-experience-v1.js');
  assert.match(code,/html\+=table\.map\(line=>'<p>'\+inline\(line\)\+'<\/p>'\)/);
});