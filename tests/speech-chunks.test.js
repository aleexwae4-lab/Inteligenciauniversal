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
