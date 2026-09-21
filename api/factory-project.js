import { getClientIp, originAllowed, applyHeaders } from '../lib/security.js';
import { buildProductProject, PROJECT_ENGINE_VERSION } from '../lib/product-builder-v4.js';

const buckets=new Map();
function allow(req){
 const now=Date.now(),ip=getClientIp(req),limit=Math.max(1,Math.min(30,Number(process.env.WAE_FACTORY_PROJECT_LIMIT_PER_MINUTE||3)||3));
 const b=buckets.get(ip)||{started:now,used:0};if(now-b.started>=60000){b.started=now;b.used=0;}
 b.used++;buckets.set(ip,b);
 if(buckets.size>3000)for(const [key,val] of buckets)if(now-val.started>120000)buckets.delete(key);
 return b.used<=limit;
}
export default async function handler(req,res){
 applyHeaders(res);
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(!originAllowed(req)||req.headers?.['sec-fetch-site']==='cross-site')return res.status(403).json({error:'origin_not_allowed'});
 const origin=String(req.headers?.origin||''),host=String(req.headers?.['x-forwarded-host']||req.headers?.host||'').split(',')[0].trim();
 if(origin&&host){try{if(new URL(origin).host!==host)return res.status(403).json({error:'origin_not_allowed'});}catch{return res.status(403).json({error:'invalid_origin'});}}
 const b=req.body||{};
 if(typeof b.request!=='string'||b.request.trim().length<8||b.request.length>3400)return res.status(400).json({error:'invalid_brief',message:'Describe el producto entre 8 y 3400 caracteres.'});
 if(b.files!=null&&(!Array.isArray(b.files)||b.files.length>12||JSON.stringify(b.files).length>100000))return res.status(413).json({error:'project_context_too_large',message:'El proyecto excede el límite de contexto de 75 KB.'});
 if(!allow(req))return res.status(429).json({error:'rate_limited',message:'Se alcanzó el límite temporal de construcción. Tu proyecto anterior permanece intacto.'});
 try{
  const result=await buildProductProject({request:b.request,files:b.files||[],kind:typeof b.kind==='string'?b.kind.slice(0,30):'app'});
  return res.status(200).json(result);
 }catch(error){
  return res.status(error.statusCode||502).json({error:error.code||'project_generation_failed',message:String(error.message||'No se pudo construir un proyecto válido.').slice(0,280),version:PROJECT_ENGINE_VERSION});
 }
}
