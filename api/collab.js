import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {allowRequest,originAllowed,applyHeaders} from '../lib/security.js';

// Deliberately ephemeral: the free Render instance has neither shared state
// nor a durable database. Do not market this as Google Docs or persisted SaaS.
const ROOMS=new Map();
const MAX_ROOMS=32,MAX_VIEWERS=8,MAX_TEXT=40000,ROOM_TTL=2*60*60*1000;
const clean=()=>{const now=Date.now();for(const [id,r] of ROOMS)if(now-r.last>ROOM_TTL){for(const c of r.viewers)try{c.end()}catch{}ROOMS.delete(id)}};
const keyhash=value=>createHash('sha256').update(value).digest();
const secret=()=>randomBytes(24).toString('base64url');
const roomId=()=>randomBytes(10).toString('hex');
const tokenFrom=req=>String(req.headers?.authorization||'').replace(/^Bearer /i,'');
function authorized(req){
  const id=String(new URL(req.url,'http://localhost').searchParams.get('room')||req.body?.room||'');
  const room=ROOMS.get(id),token=tokenFrom(req);
  if(!room||token.length!==32||!timingSafeEqual(room.digest,keyhash(token)))return null;
  room.last=Date.now();return room;
}
const snapshot=room=>({room:room.id,version:room.version,text:room.text,updatedAt:new Date(room.updatedAt).toISOString(),viewers:room.viewers.size,persistence:'memory-only'});
const emit=(res,event,value)=>res.write('event: '+event+'\ndata: '+JSON.stringify(value)+'\n\n');
export function collabStatus(){clean();return{version:'wae-collab-live/v119',mode:'in-memory-single-instance-sse',persistent:false,googleConnected:false,rooms:ROOMS.size,maxRooms:MAX_ROOMS,maxViewers:MAX_VIEWERS,documentMaxChars:MAX_TEXT,ttlSeconds:ROOM_TTL/1000}};
export default async function handler(req,res){
  applyHeaders(res);res.setHeader('X-Robots-Tag','noindex');res.setHeader('X-Frame-Options','DENY');
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(req.method==='POST'&&req.body?.action==='create'){
    if(!allowRequest(req,6))return res.status(429).json({error:'rate_limited'});
    clean();if(ROOMS.size>=MAX_ROOMS)return res.status(503).json({error:'room_capacity'});
    const accessKey=secret(),id=roomId();
    const room={id,digest:keyhash(accessKey),text:'',version:0,last:Date.now(),updatedAt:Date.now(),viewers:new Set()};
    ROOMS.set(id,room);
    return res.status(201).json({...snapshot(room),accessKey,warning:'Sala temporal: todo se pierde si Render reinicia; comparte la clave solo con colaboradores de confianza.'});
  }
  const room=authorized(req);
  if(!room)return res.status(401).json({error:'room_key_required'});
  if(req.method==='GET'){
    if(new URL(req.url,'http://localhost').searchParams.get('events')!=='1')return res.status(200).json(snapshot(room));
    if(room.viewers.size>=MAX_VIEWERS)return res.status(429).json({error:'room_viewer_capacity'});
    res.statusCode=200;
    res.setHeader('Content-Type','text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control','no-store, no-transform');
    res.setHeader('Connection','keep-alive');
    res.flushHeaders?.();room.viewers.add(res);
    emit(res,'snapshot',snapshot(room));
    const heartbeat=setInterval(()=>{try{res.write(': heartbeat\n\n')}catch{res.end()}},18000);
    res.on('close',()=>{clearInterval(heartbeat);room.viewers.delete(res)});
    return;
  }
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!allowRequest(req,45))return res.status(429).json({error:'rate_limited'});
  if(req.body?.action!=='save'||!Number.isSafeInteger(req.body.version)||typeof req.body.text!=='string'||req.body.text.length>MAX_TEXT)return res.status(400).json({error:'invalid_collaboration_document'});
  if(req.body.version!==room.version)return res.status(409).json({error:'version_conflict',currentVersion:room.version});
  room.text=req.body.text;room.version++;room.last=room.updatedAt=Date.now();
  const state=snapshot(room);
  for(const viewer of room.viewers)try{emit(viewer,'update',state)}catch{room.viewers.delete(viewer)}
  return res.status(200).json(state);
}
