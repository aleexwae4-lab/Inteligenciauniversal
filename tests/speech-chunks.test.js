import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadChunker(){
  const window={};
  const source=readFileSync(new URL('../speech-chunks.js',import.meta.url),'utf8');
  vm.runInNewContext(source,{window});
  return window.WAESpeechChunks;
}
test('TTS never slices vehículos or another word at an old 170-character boundary',()=>{
 const chunk=loadChunker();
 const input='a'.repeat(164)+' vehículos disponibles para el diagnóstico. '+ 'Esto es una segunda frase sobre vehículos.'.repeat(5);
 const result=Array.from(chunk(input,280));
 assert.equal(result.join(' '),input.trim().replace(/\s+/g,' '));
 assert.equal(result.filter(s=>s.includes('vehículos')).length>0,true);
 for(let i=0;i<result.length-1;i++){
  assert.doesNotMatch(result[i],/vehi$/);
  assert.doesNotMatch(result[i+1],/^culos\b/);
 }
});
test('TTS respects natural punctuation and preserves accents, numbers and long tokens',()=>{
 const chunk=loadChunker();
 const input='Los vehículos eléctricos circulan por México. '+'Revisión mecánica y diagnóstico de automóviles. '.repeat(8);
 const result=Array.from(chunk(input,280));
 assert.equal(result.join(' '),input.trim().replace(/\s+/g,' '));
 assert.ok(result.every(s=>s.length<=280),'normal sentences should fit under the Android utterance limit');
 assert.equal(chunk('   ').length,0);
 const long='á'.repeat(320);
 assert.equal(chunk(long).join(' '),long,'long unspaced tokens must stay intact');
});

test('a normal response is read as ONE utterance, without gaps between sentences',()=>{
 const chunk=loadChunker();
 const sentence='Los vehículos circulan con normalidad por la ciudad, sin interrupciones innecesarias. ';
 const input=sentence.repeat(11).trim();
 assert.ok(input.length>280&&input.length<1350);
 const result=Array.from(chunk(input,1350));
 assert.deepEqual(result,[input]);
});
test('long responses require substantially fewer TTS restarts, without losing any words',()=>{
 const chunk=loadChunker();
 const input='Estos vehículos eléctricos requieren un diagnóstico profesional. '.repeat(110).trim();
 const segments=Array.from(chunk(input,1350));
 assert.equal(segments.join(' '),input);
 assert.ok(segments.length<=Math.ceil(input.length/1000)+1);
 assert.ok(segments.every(s=>s.length<=1350));
});
test('frontend queues speech at once and does not restart the engine after every chunk',()=>{
 const script=readFileSync(new URL('../premium-render-v1.js',import.meta.url),'utf8');
 assert.match(script,/WAESpeechChunks\(content,1350\)/);
 assert.match(script,/utterances\.forEach\(utter=>synth\.speak\(utter\)\)/);
 assert.doesNotMatch(script,/utter\.onend=\(\)=>\{if\(token===voice\.token\)next\(\)/);
});
