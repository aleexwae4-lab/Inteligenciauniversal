import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeBlocks} from '../api/export.js';
test('document export validates content and prevents unlimited server work',()=>{
 assert.deepEqual(sanitizeBlocks([{type:'h2',text:'  Vehículos eléctricos  '},{type:'li',text:'Prueba'}]),[{type:'h2',text:'Vehículos eléctricos'},{type:'li',text:'Prueba'}]);
 assert.throws(()=>sanitizeBlocks([]),/document_empty/);
 assert.throws(()=>sanitizeBlocks('x'),/blocks_invalid/);
 assert.throws(()=>sanitizeBlocks([{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)}]),/document_too_long/);
});
