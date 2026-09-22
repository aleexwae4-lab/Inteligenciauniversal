import {createRoom,readRoom,updateRoom,subscribeRoom,collaborationCapabilities} from '../lib/live-collaboration-v119.js';
import {allowRequest,originAllowed,applyHeaders} from '../lib/security.js';

export default function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json({ok:true,...collaborationCapabilities()});
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,35))return res.status(429).json({error:'rate_limited'});
  try{
    const body=req.body||{};
    let data;
    if(body.action==='create')data=createRoom(body);
    else if(body.action==='read')data=readRoom(body);
    else if(body.action==='update')data=updateRoom(body);
    else if(body.action==='subscribe')return subscribeRoom(body,req,res);
    else return res.status(400).json({error:'unsupported_collaboration_action'});
    return res.status(data.ok===false?409:200).json(data);
  }catch(e){return res.status(e.statusCode||502).json({error:e.code||'collaboration_error'})}
}
