import {analyzeVisual,validateVisualRequest} from '../lib/vision.js';
import {forwardVisual,bootstrapVisualSession} from '../lib/vision-gateway.js';
import {allowRequest,originAllowed,applyHeaders} from '../lib/security.js';
export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req)||req.headers?.origin&&req.headers.origin!=='https://inteligenciauniversal.onrender.com')return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req))return res.status(429).json({error:'rate_limited',message:'Demasiadas solicitudes. Conserva la captura y vuelve a intentar en un minuto.'});
  try{
    const body=req.body||{};
    if(body.action==='bootstrap')return res.status(200).json(await bootstrapVisualSession(body));
    // Render-native provider is preferred when explicitly enabled. This removes the
    // extra Render -> Supabase Edge -> provider hop that failed on Android sessions.
    // It is still opt-in: analyzeVisual refuses to call anything unless WAE_VISION_ENABLED=true.
    let result;
    if(process.env.WAE_VISION_ENABLED==='true'&&process.env.GEMINI_API_KEY){
      result=await analyzeVisual(body);
      result.transport='render_native_provider';
    }else if(body.session_id||body.session_secret){
      result=await forwardVisual(body);
    }else{
      result=await analyzeVisual(body);
    }
    return res.status(200).json(result);
  }catch(error){
    return res.status(error.statusCode||502).json({error:error.code||'vision_error',message:String(error.message||'vision_error')});
  }
}
