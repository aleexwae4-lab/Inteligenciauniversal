import {randomBytes,timingSafeEqual} from 'node:crypto';

export const LIVE_COLLAB_VERSION='wae-collaboration/v119';
const rooms=new Map(),MAX_ROOMS=24,TTL=6*60*60*1000,MAX_TEXT=90000,MAX_SUBSCRIBERS=8;
const observers=new Map();
const fresh=()=>randomBytes(32).toString('base64url');
const clean=()=>{const now=Date.now();for(const[id,room]of rooms)if(room.expiresAt<=now){for(const s of observers.get(id)||[])s.end();observers.delete(id);rooms.delete(id)}};
const reject=(code,statusCode=400)=>{throw Object.assign(new Error(code),{code,statusCode})};
function roomFor(id,secret){
  clean();const room=rooms.get(String(id||''));
  if(!room||typeof secret!=='string')reject('room_not_found',404);
  const a=Buffer.from(room.secret),b=Buffer.from(secret);
  if(a.length!==b.length||!timingSafeEqual(a,b))reject('room_not_found',404);
  return room;
}
const visible=room=>({id:room.id,title:room.title,text:room.text,revision:room.revision,updatedAt:room.updatedAt,expiresAt:new Date(room.expiresAt).toISOString(),persistent:false,concurrentEdits:'optimistic-revision'});
export function collaborationCapabilities(){return {version:LIVE_COLLAB_VERSION,temporaryRooms:true,transport:'SSE push with optimistic revision guard',storage:'single Render process memory',persistent:false,ttlHours:6,merge:'revision-conflict-prevention',googleWorkspaceConnected:false,oauthRequiredForGoogle:true}};
export function createRoom({title='Documento',text=''}={}){
  clean();if(rooms.size>=MAX_ROOMS)reject('temporary_room_capacity',503);
  if(typeof title!=='string'||title.length>100||typeof text!=='string'||text.length>MAX_TEXT)reject('invalid_room_payload');
  const id=fresh(),secret=fresh(),now=Date.now();
  const room={id,secret,title:title.trim()||'Documento',text,revision:0,updatedAt:new Date(now).toISOString(),expiresAt:now+TTL};
  rooms.set(id,room);return{...visible(room),secret};
}
export function readRoom({id,secret}){return visible(roomFor(id,secret))}
export function updateRoom({id,secret,text,revision}){
  const room=roomFor(id,secret);
  if(!Number.isSafeInteger(revision)||revision<0)reject('invalid_revision');
  if(typeof text!=='string'||text.length>MAX_TEXT)reject('invalid_room_text');
  if(revision!==room.revision)return{ok:false,code:'revision_conflict',...visible(room)};
  room.text=text;room.revision++;room.updatedAt=new Date().toISOString();
  const event='event: document\ndata: '+JSON.stringify(visible(room))+'\n\n';
  for(const res of observers.get(room.id)||[])try{res.write(event)}catch{observers.get(room.id)?.delete(res)}
  return{ok:true,...visible(room)};
}

export function subscribeRoom({id,secret},req,res){
  const room=roomFor(id,secret),clients=observers.get(room.id)||new Set();
  if(clients.size>=MAX_SUBSCRIBERS)reject('collaboration_room_full',429);
  res.statusCode=200;res.setHeader('Content-Type','text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-transform');res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders?.();clients.add(res);observers.set(room.id,clients);
  res.write('event: document\n'+'data: '+JSON.stringify(visible(room))+'\n\n');
  const keepalive=setInterval(()=>{try{res.write(': keepalive\n\n')}catch{cleanup()}},15000);
  const deadline=setTimeout(()=>res.end(),100000);
  const cleanup=()=>{clearInterval(keepalive);clearTimeout(deadline);clients.delete(res)};
  req.on('close',cleanup);res.on('close',cleanup);
}
