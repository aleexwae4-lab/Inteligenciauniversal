import {randomBytes,timingSafeEqual} from 'node:crypto';

export const LIVE_COLLAB_VERSION='wae-collaboration/v119';
const rooms=new Map(),MAX_ROOMS=24,TTL=6*60*60*1000,MAX_TEXT=90000;
const fresh=()=>randomBytes(32).toString('base64url');
const clean=()=>{const now=Date.now();for(const[id,room]of rooms)if(room.expiresAt<=now)rooms.delete(id)};
const reject=(code,statusCode=400)=>{throw Object.assign(new Error(code),{code,statusCode})};
function roomFor(id,secret){
  clean();const room=rooms.get(String(id||''));
  if(!room||typeof secret!=='string')reject('room_not_found',404);
  const a=Buffer.from(room.secret),b=Buffer.from(secret);
  if(a.length!==b.length||!timingSafeEqual(a,b))reject('room_not_found',404);
  return room;
}
const visible=room=>({id:room.id,title:room.title,text:room.text,revision:room.revision,updatedAt:room.updatedAt,expiresAt:new Date(room.expiresAt).toISOString(),persistent:false,concurrentEdits:'optimistic-revision'});
export function collaborationCapabilities(){return {version:LIVE_COLLAB_VERSION,temporaryRooms:true,storage:'single Render process memory',persistent:false,ttlHours:6,merge:'revision-conflict-prevention',googleWorkspaceConnected:false,oauthRequiredForGoogle:true}};
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
  return{ok:true,...visible(room)};
}
