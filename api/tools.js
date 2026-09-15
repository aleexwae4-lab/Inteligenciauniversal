import { getToolDefinition, toolFabricSnapshot } from '../lib/tool-fabric.js';
import { applyHeaders } from '../lib/security.js';

export default function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const url=new URL(req.url||'/api/tools','http://localhost');
  const id=String(url.searchParams.get('id')||'').trim().toLowerCase();
  if(id){
    const tool=getToolDefinition(id);
    if(!tool)return res.status(404).json({error:'tool_not_found'});
    return res.status(200).json({success:true,tool});
  }
  return res.status(200).json({success:true,toolFabric:toolFabricSnapshot()});
}
