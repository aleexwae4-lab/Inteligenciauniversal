(()=>{
'use strict';
// Render-only durable browser archive. Never silently prune conversations or erase cloud data.
const NAME='wae-universal-render-memory-v2',STORE='snapshots';
const LEGACY={navigation:'iu.premium.navigation.v1',active:'wae.messages',document:'wae.document',html:'wae.html'};
let database=null,writeQueue=Promise.resolve();
const open=new Promise(resolve=>{
  if(!window.indexedDB){resolve(null);return}
  let request;
  try{request=indexedDB.open(NAME,1)}catch{resolve(null);return}
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
  request.onsuccess=()=>{database=request.result;database.onversionchange=()=>database.close();resolve(database)};
  request.onerror=()=>resolve(null);
  request.onblocked=()=>resolve(null);
});
function transact(mode,callback){
  if(!database)return Promise.reject(new Error('indexeddb_unavailable'));
  return new Promise((resolve,reject)=>{
    let result,tx;
    try{
      tx=database.transaction(STORE,mode);
      const req=callback(tx.objectStore(STORE));
      req.onsuccess=()=>{result=req.result};
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(tx.error||new Error('indexeddb_transaction_failed'));
      tx.onabort=()=>reject(tx.error||new Error('indexeddb_transaction_aborted'));
    }catch(error){reject(error)}
  });
}
async function load(key){await open;return transact('readonly',store=>store.get(key))}
async function save(key,value){
  // Serialize writes so an older snapshot cannot overtake the newer one.
  const snapshot=JSON.parse(JSON.stringify(value));
  const job=writeQueue.catch(()=>{}).then(async()=>{await open;await transact('readwrite',store=>store.put(snapshot,key));return true});
  writeQueue=job;return job;
}
async function migrate(){
  await open;
  if(!database)return {ok:false,backend:'unavailable'};
  const moved=[];
  for(const [key,legacy] of Object.entries(LEGACY)){
    let raw;
    try{raw=localStorage.getItem(legacy)}catch{continue}
    if(raw===null)continue;
    try{
      const existing=await load(key);
      if(existing!==undefined){ // Previous verified v2 snapshot takes precedence; leave legacy untouched if they differ.
        if(JSON.stringify(existing)===raw){localStorage.removeItem(legacy);moved.push(key)}
        continue;
      }
      const parsed=key==='navigation'||key==='active'?JSON.parse(raw):raw;
      await save(key,parsed);
      const verified=await load(key);
      if(JSON.stringify(verified)!==JSON.stringify(parsed))throw new Error('archive_verification_failed');
      localStorage.removeItem(legacy);
      moved.push(key);
    }catch(error){console.warn('[WAE Storage] legacy retained for recovery:',key,error?.message||error)}
  }
  return {ok:true,backend:'indexeddb',moved};
}
const ready=migrate();
window.WAEStorage={
  ready,
  available:async()=>!!(await open),
  load,save,
  exportableKeys:Object.keys(LEGACY),
  // The app itself owns the explicit export action; storage never automatically deletes a chat.
};
})();
