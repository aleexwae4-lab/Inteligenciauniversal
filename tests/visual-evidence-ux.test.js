import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function extract(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a);return source.slice(a,b)}

test('visual evidence badge labels sheets accurately and offers retry only after actual failure',()=>{
 const script=read('camera-v1.js');
 const section=extract(script,'function renderBadge(){','function clear(){');
 const image={className:'',alt:'',src:''};
 const badge={hidden:true,textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v},prepend(img){this.thumbnail=img}};
 const retryBtn={hidden:true};
 const pending={kind:'video',frames:[{dataUrl:'data:image/jpeg;base64,YWJj'},{dataUrl:'data:image/jpeg;base64,YWJj'},{dataUrl:'data:image/jpeg;base64,YWJj'}]};
 const state=vm.createContext({badge,pending,retryBtn,evidenceState:'error',lastQuestion:'¿Qué cambia entre escenas?',document:{createElement:()=>image}});
 vm.runInContext(section+'\nrenderBadge();',state);
 assert.match(badge.textContent,/3 hojas temporales/);
 assert.doesNotMatch(badge.textContent,/fotogramas preparados/);
 assert.equal(image.alt,'Primera hoja temporal preparada');
 assert.equal(retryBtn.hidden,false);
 state.evidenceState='analyzing';
 vm.runInContext('renderBadge();',state);
 assert.match(badge.textContent,/Analizando/);
 assert.equal(retryBtn.hidden,true);
 state.pending=null;
 vm.runInContext('renderBadge();',state);
 assert.equal(badge.hidden,true);
});

test('replacement media cannot resurrect after a user cancels a slow gallery decode',async()=>{
 const script=read('camera-v1.js');
 const section=extract(script,'async function prepareFile(file){','function initialize(){');
 let release;
 const gate=new Promise(resolve=>{release=resolve});
 const state=vm.createContext({
  revision:0,pending:null,evidenceState:'idle',
  window:{WAEVideoScanV2:{prepareFile:()=>gate},WAECoreTools:{status:()=>({active:null})}},
  clear(){this.revision++;this.pending=null},renderBadge(){},notify(){},loadPhoto:()=>Promise.reject(Error('not used')),Error
 });
 // Use non-arrow independent clear function to keep VM globals.
 state.clear=function(){state.revision++;state.pending=null};
 vm.runInContext(section,state);
 const promise=state.prepareFile({type:'video/mp4',name:'muestra.mp4',size:123});
 state.clear();
 release({frames:[{dataUrl:'data:image/jpeg;base64,YWJj',timeSec:1}]});
 await assert.rejects(promise,/reemplazado o cancelado/);
 assert.equal(state.pending,null);
});

test('new evidence UX preserves text attachments, original user question, and media without autosave',()=>{
 const script=read('camera-v1.js'),app=read('app.js'),css=read('camera-v1.css'),sw=read('sw.js');
 assert.match(script,/const task=preparation=prepareFile\(visuals\[0\]\)/);
 assert.match(script,/setTimeout\(\(\)=>\{picker\.value=''\},0\)/);
 const clearSection=extract(script,'function clear(){','function setStatus(');
 assert.doesNotMatch(clearSection,/picker\.value/,'never empty FileList during another input listener');
 assert.match(script,/const question=simpleRetry&&lastQuestion\?lastQuestion:requested/);
 assert.match(script,/if\(requestRevision!==revision\)throw Error/);
 assert.match(script,/if\(window\.WAECoreTools\?\.status\(\)\?\.active==='visual.inspect'\)/);
 assert.match(app,/i\.value=m;autosizeInput\(\)/);
 assert.match(css,/\.wae-camera-thumb/);
 assert.match(css,/\.wae-camera-retry\[hidden\]/);
 assert.match(sw,/wae-universal-render-canvas-factory-v30/);
 assert.match(sw,/canvas-render-factory-v1\.js\?v=1/);
});
