// WAE Universal Core · portable local continuity archive, no remote sessions or secrets.
// Pure validation and merge logic; browser I/O lives in continuity-backup-v7.js.
export const CONTINUITY_FORMAT='wae-universal-continuity-v1';
export const FACTORY_KEYS=Object.freeze({
 projects:'wae.render.factory.projects.v1',
 active:'wae.render.factory.active.v1',
 revisions:'wae.render.factory.revisions.v3'
});
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(s)&&!['__proto__','prototype','constructor'].includes(s);
const sane=s=>typeof s==='string'&&s.length<=200_000;
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const fileName=s=>typeof s==='string'&&/^(?!\.)(?!.*\.\.)[a-zA-Z0-9_\-./]{1,100}$/.test(s)&&!s.startsWith('/')&&!s.split('/').includes('..')&&!s.includes('//');
const assert=(condition,message)=>{if(!condition)throw Error(message)};
function validateFiles(files,max=30){
 assert(Array.isArray(files)&&files.length>0&&files.length<=max,'Archivos de producto inválidos');
 const names=new Set();
 for(const file of files){
  assert(object(file)&&fileName(file.name)&&sane(file.content)&&!names.has(file.name),'Nombre o contenido de archivo inválido');
  names.add(file.name);
 }
}
export function validatePayload(data){
 assert(object(data),'El respaldo no es un objeto JSON válido');
 assert(data.format===CONTINUITY_FORMAT,'El respaldo no corresponde a esta versión de Universal Core');
 assert(object(data.navigation)&&Array.isArray(data.navigation.projects)&&Array.isArray(data.navigation.conversations),'Falta el archivo de conversaciones y proyectos');
 assert(data.navigation.projects.length<=200&&data.navigation.conversations.length<=1500,'El respaldo supera el límite de conversaciones');
 const projects=new Set(),chats=new Set();
 for(const project of data.navigation.projects){
  assert(object(project)&&validId(project.id)&&!projects.has(project.id),'Proyecto de conversación inválido');
  projects.add(project.id);
  assert(typeof project.title==='string'&&project.title.length<=200,'Título de proyecto inválido');
  for(const prop of ['knowledge','instructions'])assert(project[prop]==null||sane(project[prop]),'Conocimiento de proyecto demasiado grande');
 }
 for(const chat of data.navigation.conversations){
  assert(object(chat)&&validId(chat.id)&&!chats.has(chat.id),'Conversación duplicada o inválida');
  chats.add(chat.id);
  assert(Array.isArray(chat.messages)&&chat.messages.length<=1000,'Historial de conversación demasiado grande');
  for(const turn of chat.messages)assert(object(turn)&&['user','assistant'].includes(turn.role)&&typeof turn.text==='string'&&turn.text.length<=100_000,'Turno de conversación inválido');
 }
 assert(typeof data.document==='string'&&data.document.length<=1_000_000,'Documento demasiado grande');
 assert(typeof data.html==='string'&&data.html.length<=1_000_000,'Canvas demasiado grande');
 assert(object(data.factory)&&Array.isArray(data.factory.projects)&&data.factory.projects.length<=25,'Fábrica inválida');
 assert(object(data.factory.revisions),'Historial de versiones inválido');
 const ids=new Set();
 for(const p of data.factory.projects){
  assert(object(p)&&validId(p.id)&&!ids.has(p.id),'Identificador duplicado de producto');
  ids.add(p.id);
  assert(typeof p.name==='string'&&p.name.length<=100,'Nombre de producto inválido');
  validateFiles(p.files);
 }
 for(const [id,versions] of Object.entries(data.factory.revisions)){
  assert(ids.has(id)&&Array.isArray(versions)&&versions.length<=4,'Versiones de producto inválidas');
  for(const rev of versions){assert(object(rev),'Revisión inválida');validateFiles(rev.files)}
 }
 assert(data.factory.active==null||typeof data.factory.active==='string'&&ids.has(data.factory.active),'Producto activo inválido');
 return data;
}
const clone=v=>JSON.parse(JSON.stringify(v));
const unique=(used,newId)=>{
 let id;
 for(let i=0;i<10;i++){id=String(newId());if(validId(id)&&!used.has(id)){used.add(id);return id}}
 throw Error('No se pudo crear un identificador de recuperación');
};
export function mergePayload(current,incoming,newId){
 validatePayload(incoming);
 const nav=object(current.navigation)?clone(current.navigation):{active:null,projects:[],conversations:[]};
 nav.projects=Array.isArray(nav.projects)?nav.projects:[];
 nav.conversations=Array.isArray(nav.conversations)?nav.conversations:[];
 const usedProjects=new Set(nav.projects.map(x=>x.id)),usedChats=new Set(nav.conversations.map(x=>x.id));
 const pids=new Map();
 for(const project of incoming.navigation.projects){
  const id=usedProjects.has(project.id)?unique(usedProjects,newId):project.id;
  usedProjects.add(id);pids.set(project.id,id);
  nav.projects.push({...clone(project),id});
 }
 for(const chat of incoming.navigation.conversations){
  const id=usedChats.has(chat.id)?unique(usedChats,newId):chat.id;
  usedChats.add(id);
  // Import only the local conversation; never reuse a remote user/session pointer.
  nav.conversations.push({...clone(chat),id,remoteId:null,
    projectId:pids.get(chat.projectId)||null});
 }
 if(!nav.active&&nav.conversations.length)nav.active=nav.conversations[0].id;
 const factory=Array.isArray(current.factory?.projects)?clone(current.factory):{projects:[],active:null,revisions:{}};
 factory.revisions=object(factory.revisions)?factory.revisions:{};
 const usedFactory=new Set(factory.projects.map(x=>x.id));
 for(const p of incoming.factory.projects){
  const id=usedFactory.has(p.id)?unique(usedFactory,newId):p.id;
  usedFactory.add(id);
  factory.projects.push({...clone(p),id});
  if(incoming.factory.revisions[p.id])factory.revisions[id]=clone(incoming.factory.revisions[p.id]);
  if(!factory.active)factory.active=id;
 }
 assert(factory.projects.length<=25,'No hay espacio para fusionar todos los productos: exporta los actuales antes de continuar');
 assert(nav.conversations.length<=2000,'No hay espacio para fusionar todas las conversaciones');
 return{
  navigation:nav,factory,
  document:current.document||incoming.document,
  html:current.html||incoming.html,
  // Device settings, access tokens and cloud credentials are never imported.
  counts:{conversations:incoming.navigation.conversations.length,projects:incoming.navigation.projects.length,factory:incoming.factory.projects.length}
 };
}
