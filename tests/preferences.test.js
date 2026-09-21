import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPreferences,formatPreferences } from '../lib/preferences.js';
test('preferences include instructions and knowledge with strict bounds',()=>{
 const clean=cleanPreferences({instructions:' a '.repeat(3000),knowledge:'z'.repeat(50000)});
 assert.equal(clean.instructions.length,4000);
 assert.equal(clean.knowledge.length,12000);
 assert.match(formatPreferences({instructions:'Responder en español',knowledge:'Mi empresa vende software'}),/Responder en español/);
 assert.match(formatPreferences({instructions:'Responder en español',knowledge:'Mi empresa vende software'}),/Mi empresa vende software/);
});
test('malformed preferences cannot crash the runtime',()=>{
 assert.deepEqual(cleanPreferences(null),{instructions:'',knowledge:''});
 assert.deepEqual(cleanPreferences({knowledge:4,instructions:{}}),{instructions:'',knowledge:''});
});
