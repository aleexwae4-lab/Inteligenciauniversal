/* WAE Universal Core Render · user-initiated local backup and non-destructive restore. */
import {CONTINUITY_FORMAT,FACTORY_KEYS,validatePayload,mergePayload} from './continuity-archive-core-v7.js';
const $=(q,r=document)=>r.querySelector(q);
const text=(x)=>String(x??'');
const notify=message=>window.toast?.(message);
const local=key=>{try{return localStorage.getItem(key)}catch{return null}};
const readJSON=(key,fallback)=>{try{return JSON.parse(local(key)||'null')??fallback}catch{return fallback}};
const snapshot=async key=>{
 try{if(window.WAEStorage){await window.WAEStorage.ready;return await window.WAEStorage.load(key)}}catch{}
 return undefined;
};
function uuid(){
 if(typeof crypto?.randomUUID==='function')return crypto.randomUUID();
 const numbers=new Uint8Array(16);crypto.getRandomValues(numbers);
 return 'restore-'+Array.from(numbers,byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function sha(value){
 if(!crypto?.subtle)throw Error('Tu navegador no permite verificar SHA-256 en esta conexión');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
async function currentPayload(){
 // Save the active editor first; the factory is local, not a cloud filesystem.
 if(window.__waeFactoryV1?.save)window.__waeFactoryV1.save();
 const navigation=window.WAENavigation?.snapshotLocal?.()??(await snapshot('navigation'))??readJSON('iu.premium.navigation.v1',null)??{active:null,projects:[],conversations:[]};
 const messages=window.WAEChatState?.snapshot?.()||[];
 if(navigation.active&&Array.isArray(navigation.conversations)){
  const active=navigation.conversations.find(c=>c.id===navigation.active);
  if(active)active.messages=messages;
 }
 const projects=readJSON(FACTORY_KEYS.projects,[]);
 const allRevisions=readJSON(FACTORY_KEYS.revisions,{});
 const revisions={};for(const project of projects||[])if(Array.isArray(allRevisions?.[project.id]))revisions[project.id]=allRevisions[project.id];
 const data={
  format:CONTINUITY_FORMAT,
  exportedAt:new Date().toISOString(),
  scope:'local-device-only',
  note:'Archivo JSON sin cifrado: guárdalo en un lugar privado. NO incluye conversaciones remotas, sesiones, contraseñas, claves API ni configuración de cuenta.',
  navigation,
  activeMessages:messages,
  document:text((await snapshot('document'))??local('wae.document')),
  html:text((await snapshot('html'))??local('wae.html')),
  factory:{projects:Array.isArray(projects)?projects:[],active:local(FACTORY_KEYS.active)||null,revisions}
 };
 validatePayload(data);return data;
}
function downloadArchive(filename,content){
 const url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function exportBackup(){
 if(window.WAEChatState?.busy?.())return notify('Finaliza la respuesta antes de respaldar.');
 try{
  const data=await currentPayload();
  const content=JSON.stringify(data);
  const checksum=await sha(content);
  const archive={format:CONTINUITY_FORMAT,integrity:{algorithm:'SHA-256',digest:checksum},data};
  downloadArchive('WAE-UniversalCore-respaldo-integral-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(archive,null,2));
  notify('Descarga solicitada. Verifica el archivo; esta copia no se guarda automáticamente en la nube.');
 }catch(error){console.warn('[WAE continuity] export rejected:',error?.message);notify('No se generó el respaldo: '+text(error?.message).slice(0,100))}
}
async function verifyArchive(file){
 if(!file||file.size>12_000_000)throw Error('Archivo vacío o superior a 12 MB');
 const source=await file.text(),wrapper=JSON.parse(source);
 if(wrapper?.format!==CONTINUITY_FORMAT||wrapper?.integrity?.algorithm!=='SHA-256'||!(/^[a-f0-9]{64}$/i).test(wrapper?.integrity?.digest||''))
  throw Error('Formato o suma de verificación inválidos');
 const content=JSON.stringify(wrapper.data);
 if((await sha(content))!==wrapper.integrity.digest.toLowerCase())throw Error('La integridad SHA-256 no coincide: archivo alterado o incompleto');
 return validatePayload(wrapper.data);
}
// The backup file is not trusted code. Restore editor markup through a
// limited formatting allowlist; drop event handlers, resource tags and links.
function safeDocumentHTML(raw){
 const template=document.createElement('template');template.innerHTML=text(raw);
 const allowed=new Set(['P','DIV','SPAN','BR','STRONG','B','EM','I','U','S','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','PRE','CODE','HR','TABLE','THEAD','TBODY','TR','TH','TD']);
 function copy(node){
  if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent||'');
  if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
  if(!allowed.has(node.tagName)){
   // Unknown elements are not reproduced. Their text is preserved as text.
   return document.createTextNode(node.textContent||'');
  }
  const clean=document.createElement(node.tagName.toLowerCase());
  for(const child of node.childNodes)clean.append(copy(child));
  return clean;
 }
 const wrapper=document.createElement('div');
 for(const child of template.content.childNodes)wrapper.append(copy(child));
 return wrapper.innerHTML;
}
async function restoreFile(file){
 if(window.WAEChatState?.busy?.())return notify('Finaliza la respuesta antes de restaurar');
 let data;
 try{data=await verifyArchive(file)}
 catch(error){console.warn('[WAE continuity] invalid import:',error?.message);return notify('Respaldo rechazado: '+text(error?.message).slice(0,95))}
 const current=await currentPayload().catch(()=>null);
 if(!current)return notify('No pude leer los datos actuales. No se modificó nada.');
 const merged=(()=>{try{return mergePayload(current,data,uuid)}catch(error){notify(text(error?.message).slice(0,120));return null}})();
 if(merged&&!current.document&&merged.document)merged.document=safeDocumentHTML(merged.document);
 if(!merged)return;
 if(!confirm('Respaldo verificado.\n\nSe agregarán '+merged.counts.conversations+' conversaciones, '+merged.counts.projects+' proyectos de conversación y '+merged.counts.factory+' productos de Fábrica.\n\nNO se eliminarán los existentes. Los documentos actuales tienen prioridad. No se importarán credenciales ni sesiones. El archivo NO está cifrado.\n\n¿Importar y reiniciar Universal Core?'))return;
 const keys=[FACTORY_KEYS.projects,FACTORY_KEYS.active,FACTORY_KEYS.revisions];
 const oldLocal=Object.fromEntries(keys.map(k=>[k,local(k)]));
 const stored={navigation:await snapshot('navigation'),document:await snapshot('document'),html:await snapshot('html')};
 const oldNavLocal=local('iu.premium.navigation.v1');
 const hasDB=await window.WAEStorage?.available?.().catch(()=>false);
 let navWritten=false,documentWritten=false,htmlWritten=false;
 try{
  localStorage.setItem(FACTORY_KEYS.projects,JSON.stringify(merged.factory.projects));
  localStorage.setItem(FACTORY_KEYS.active,merged.factory.active||'');
  localStorage.setItem(FACTORY_KEYS.revisions,JSON.stringify(merged.factory.revisions));
  for(const key of keys)if(local(key)===null)throw Error('Falló el guardado de los proyectos.');
  if(hasDB){
   await window.WAEStorage.save('navigation',merged.navigation);navWritten=true;
   if(!current.document&&merged.document){await window.WAEStorage.save('document',merged.document);documentWritten=true;}
   if(!current.html&&merged.html){await window.WAEStorage.save('html',merged.html);htmlWritten=true;}
   const check=await window.WAEStorage.load('navigation');
   if(JSON.stringify(check)!==JSON.stringify(merged.navigation))throw Error('Falló la verificación de conversaciones.');
  }else{
   localStorage.setItem('iu.premium.navigation.v1',JSON.stringify(merged.navigation));navWritten=true;
   if(!current.document&&merged.document){localStorage.setItem('wae.document',merged.document);documentWritten=true}
   if(!current.html&&merged.html){localStorage.setItem('wae.html',merged.html);htmlWritten=true}
   if(local('iu.premium.navigation.v1')!==JSON.stringify(merged.navigation))throw Error('Falló la verificación local.');
  }
  notify('Respaldo restaurado. Recargando para reconstruir el historial…');
  location.reload();
 }catch(error){
  console.warn('[WAE continuity] restore failed; attempting rollback:',error?.message);
  for(const [key,value] of Object.entries(oldLocal))try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}catch{}
  try{
   if(hasDB){
    if(navWritten&&stored.navigation!==undefined)await window.WAEStorage.save('navigation',stored.navigation);
    if(documentWritten&&stored.document!==undefined)await window.WAEStorage.save('document',stored.document);
    if(htmlWritten&&stored.html!==undefined)await window.WAEStorage.save('html',stored.html);
   }else{
    if(navWritten){if(oldNavLocal===null)localStorage.removeItem('iu.premium.navigation.v1');else localStorage.setItem('iu.premium.navigation.v1',oldNavLocal)}
    if(documentWritten){if(!current.document)localStorage.removeItem('wae.document')}
    if(htmlWritten){if(!current.html)localStorage.removeItem('wae.html')}
   }
  }catch(rollback){console.warn('[WAE continuity] rollback requires manual restore',rollback?.message)}
  notify('No se completó la restauración. Conserva el JSON original. '+text(error?.message).slice(0,70));
 }
}
function attach(){
 const footer=$('#drawer .iu-nav-footer');if(!footer||$('#iuBackupExport'))return false;
 const row=document.createElement('div');row.className='iu-backup-row';
 const exportButton=document.createElement('button');exportButton.id='iuBackupExport';exportButton.type='button';exportButton.textContent='↓ Respaldo integral';exportButton.title='Descargar conversaciones locales, Workspace y todos los proyectos de Fábrica';
 const importButton=document.createElement('button');importButton.id='iuBackupImport';importButton.type='button';importButton.textContent='↑ Restaurar';importButton.title='Verificar archivo SHA-256 y fusionar sin borrar tus proyectos';
 const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.hidden=true;picker.id='iuBackupPicker';
 exportButton.addEventListener('click',exportBackup);
 importButton.addEventListener('click',()=>picker.click());
 picker.addEventListener('change',()=>{const file=picker.files?.[0];picker.value='';if(file)restoreFile(file)});
 row.append(exportButton,importButton,picker);footer.append(row);
 const help=document.createElement('small');help.className='iu-backup-help';help.textContent='Local · JSON verificable · sin credenciales';footer.append(help);return true;
}
function start(){
 if(attach())return;
 const drawer=$('#drawer');if(!drawer)return;
 const observer=new MutationObserver(()=>{if(attach())observer.disconnect()});
 observer.observe(drawer,{childList:true,subtree:false});
}
window.WAEContinuityArchive=Object.freeze({exportBackup,verifyArchive,restoreFile,attach});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
