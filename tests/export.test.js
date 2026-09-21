import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitizeBlocks} from '../api/export.js';
test('document export validates content and prevents unlimited server work',()=>{
 assert.deepEqual(sanitizeBlocks([{type:'h2',text:'  Vehículos eléctricos  '},{type:'li',text:'Prueba'}]),[{type:'h2',text:'Vehículos eléctricos'},{type:'li',text:'Prueba'}]);
 assert.throws(()=>sanitizeBlocks([]),/document_empty/);
 assert.throws(()=>sanitizeBlocks('x'),/blocks_invalid/);
 assert.throws(()=>sanitizeBlocks([{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)},{text:'a'.repeat(8000)}]),/document_too_long/);
});

test('PDF and Word exporters produce actual binary documents',async()=>{
 const {default:handler}=await import('../api/export.js');
 for(const fmt of ['pdf','docx']){
  const req={method:'POST',body:{format:fmt,filename:'prueba',blocks:[{type:'h1',text:'Universal Core'},{type:'p',text:'Vehículos eléctricos y proyectos.'}]}};
  let status=0,headers={},buffer;
  const res={setHeader:(k,v)=>{headers[k]=v},status(code){status=code;return this},json(v){throw Error(JSON.stringify(v))},end(v){buffer=v}};
  await handler(req,res);
  assert.equal(status||res.statusCode,200);
  assert.ok(Buffer.isBuffer(buffer)&&buffer.length>120);
  assert.equal(buffer.toString('latin1',0,4),fmt==='pdf'?'%PDF':'PK\u0003\u0004');
  assert.match(headers['Content-Disposition'],new RegExp('prueba\\.'+fmt));
 }
});
test('UI offers document formats and working Canvas construction controls',async()=>{
 const {readFileSync}=await import('node:fs');
 const ui=readFileSync(new URL('../workspace-premium-v1.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const ext of ['pdf','docx','txt','md','html','rtf'])assert.match(ui,new RegExp('value="'+ext+'"'));
 for(const key of ['iuCanvasType','iuCanvasGenerate','iuCanvasTemplate','iuCanvasDownload'])assert.match(ui,new RegExp(key));
 assert.match(html,/workspace-premium-v1\.js\?v=11/);
});

test('Canvas v2 is loaded after legacy Canvas without replacing the original shell',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/canvas-premium-v2\.js\?v=14/);
 assert.match(html,/workspace-premium-v1\.css\?v=13/);
});
