import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('native complete-project exporter produces real ZIP records and UTF-8 contents',()=>{
 const ctx={window:{},TextEncoder,Uint8Array,DataView};
 vm.runInNewContext(read('factory-zip-v4.js'),ctx);
 const archive=ctx.window.WAEZipProject([{name:'index.html',content:'<h1>Hola</h1>'},{name:'README.md',content:'Proyecto WAE • español'}]);
 const v=new DataView(archive.buffer,archive.byteOffset,archive.byteLength);
 assert.equal(v.getUint32(0,true),0x04034b50);
 assert.equal(v.getUint32(archive.length-22,true),0x06054b50);
 assert.equal(v.getUint16(archive.length-14,true),2);
 const cdOffset=v.getUint32(archive.length-6,true);
 assert.equal(v.getUint32(cdOffset,true),0x02014b50);
 assert.throws(()=>ctx.window.WAEZipProject([{name:'../secret',content:'key'}]),/Ruta inválida/);
 assert.throws(()=>ctx.window.WAEZipProject([{name:'ok.txt',content:'a'},{name:'ok.txt',content:'b'}]),/duplicada/);
});
test('chat downloads editable ZIP and keeps stand-alone HTML and JSON exports',()=>{
 const factory=read('factory-projects-render-v2.js'),agent=read('factory-agent-render-v3.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(factory,/function exportZip\(/);
 assert.match(factory,/id="wfExportZIP"/);
 assert.match(factory,/id="wfExportHTML"/);
 assert.match(factory,/id="wfExportProject"/);
 assert.match(agent,/wfExportZIP/);
 assert.match(html,/factory-zip-v4\.js\?v=4/);
 assert.match(sw,/factory-zip-v4\.js\?v=4/);
});
