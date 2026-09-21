import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('v117 preserves live source links, quality feedback and user navigation',async()=>{
  const js=await read('premium-v117.js');
  assert.match(js,/const feedbackButtons=legacyRows\.flatMap/);
  assert.match(js,/const sourceBox=\$\('\.iu-sources',node\)/);
  assert.match(js,/sourceLinks\.length/);
  assert.match(js,/sourceBox\.scrollIntoView/);
  assert.match(js,/attachSourceAction\(existing\)/);
  assert.doesNotMatch(js,/const feedbackButtons=\$\('button\[data-feedback\]'/);
  assert.doesNotMatch(js,/^\s*\$\('\.answer-actions,.iu-answer-actions,.actions',node\)/m);
});
test('other presentation layer cannot erase rich source charts or force scroll',async()=>{
  const js=await read('gpt-experience-v1.js');
  assert.match(js,/!body\.classList\.contains\('rich-content'\)/);
  assert.match(js,/!\$\('\.iu-sources',node\)/);
  assert.doesNotMatch(js,/node\.scrollIntoView\(\{block:'end',behavior:'smooth'\}\)/);
});
test('voice preference is not destroyed on load',async()=>{
  assert.doesNotMatch(await read('polish-v2.js'),/localStorage\.setItem\('wae\.autoVoice','false'\)/);
});
test('production action and response scripts parse successfully',()=>{
  for(const file of ['premium-v117.js','gpt-experience-v1.js','polish-v2.js']){
    const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+file,import.meta.url))],{encoding:'utf8'});
    assert.equal(result.status,0,file+': '+(result.stderr||result.stdout));
  }
});