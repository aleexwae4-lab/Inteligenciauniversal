import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../storage-v2.js',import.meta.url),'utf8');
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

function harness(seed={},failed=false){
 const records=new Map(),local=new Map(Object.entries(seed)),deletions=[];
 const localStorage={
  getItem:key=>local.has(key)?local.get(key):null,
  setItem:()=>{throw new Error('QuotaExceededError')},
  removeItem:key=>{deletions.push(key);local.delete(key)}
 };
 const indexedDB={
  open:()=>{
   const req={};
   queueMicrotask(()=>{
    if(failed){req.onerror?.();return}
    const db={
     objectStoreNames:{contains:()=>false},createObjectStore:()=>{},
     close:()=>{},
     transaction:()=>{
      const tx={
       objectStore:()=>({
        get:key=>{const r={};queueMicrotask(()=>{r.result=records.get(key);r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return r},
        put:(value,key)=>{const r={};queueMicrotask(()=>{records.set(key,value);r.result=key;r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())});return r}
       })
      };
      return tx;
     }
    };
    req.result=db;req.onupgradeneeded?.();req.onsuccess?.();
   });
   return req;
  }
 };
 const window={indexedDB};
 vm.runInNewContext(source,{window,indexedDB,localStorage,queueMicrotask,JSON,console});
 return {storage:window.WAEStorage,records,local,deletions};
}

test('verified migration preserves all chats and workspace even when localStorage is full',async()=>{
 const chats={active:'chat-1',projects:[{id:'project-1',knowledge:'Detailed context'}],conversations:Array.from({length:45},(_,i)=>({id:'chat-'+i,messages:[{role:'user',text:'important '+i},{role:'assistant',text:'reply '+i}]}))};
 const seed={
  'iu.premium.navigation.v1':JSON.stringify(chats),
  'wae.messages':JSON.stringify(chats.conversations[0].messages),
  'wae.document':'<p>Important workspace</p>',
  'wae.html':'<!doctype html><title>Original</title>'
 };
 const h=harness(seed);
 const result=await h.storage.ready;
 assert.equal(result.ok,true);
 assert.deepEqual(h.deletions.sort(),Object.keys(seed).sort());
 assert.equal((await h.storage.load('navigation')).conversations.length,45);
 assert.equal((await h.storage.load('active')).length,2);
 assert.equal(await h.storage.load('document'),seed['wae.document']);
 assert.equal(await h.storage.load('html'),seed['wae.html']);
 await h.storage.save('navigation',{...chats,conversations:[...chats.conversations,{id:'chat-46',messages:[]}]});
 assert.equal((await h.storage.load('navigation')).conversations.length,46);
});

test('failed IndexedDB open never deletes legacy conversations or workspace',async()=>{
 const original='{"active":"chat","projects":[],"conversations":[{"id":"chat","messages":[]}]}';
 const h=harness({'iu.premium.navigation.v1':original,'wae.document':'critical'},true);
 const result=await h.storage.ready;
 assert.equal(result.ok,false);
 assert.equal(h.local.get('iu.premium.navigation.v1'),original);
 assert.equal(h.local.get('wae.document'),'critical');
 assert.equal(h.deletions.length,0);
});

test('UI archives active and remote conversations and provides user-triggered export',()=>{
 const nav=read('../navigation-premium-v1.js'),app=read('../app.js'),remote=read('../runtime-client.js');
 const html=read('../index.html'),sw=read('../sw.js');
 assert.match(nav,/WAEStorage\.save\('navigation',snapshot\)/);
 assert.match(nav,/async function exportMemory\(/);
 assert.match(nav,/scope:'local-device-only'/);
 assert.doesNotMatch(nav,/\.slice\(0,30\)/);
 assert.doesNotMatch(nav,/Sin espacio de almacenamiento; exporta y libera conversaciones/);
 assert.match(app,/WAEStorage\.save\('active',recent\)/);
 assert.match(app,/WAEStorage\.save\('document',state.document\)/);
 assert.match(remote,/WAEStorage\.save\('active',messages.slice\(-60\)\)/);
 assert.match(html,/storage-v2\.js\?v=1/);
 assert.match(sw,/wae-universal-render-canvas-factory-v30/);
 assert.match(sw,/canvas-render-factory-v1\.js\?v=1/);
});

test('Render fallback never uses shared IP or anonymous cross-user memory key',()=>{
 const api=read('../api/chat.js'),runtime=read('../lib/runtime.js');
 assert.doesNotMatch(api,/getClientIp\(req\)/);
 assert.doesNotMatch(runtime,/\|\| 'anonymous'/);
});
