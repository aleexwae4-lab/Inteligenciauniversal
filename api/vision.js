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
    // Guarded, authenticated WAE route first. Legacy local Gemini route stays opt-in
    // for callers without an IU session: never switch to a paid provider silently.
    if(body.action==='bootstrap')return res.status(200).json(await bootstrapVisualSession(body));
    const result=body.session_id||body.session_secret
      ?await forwardVisual(body)
      :await analyzeVisual(body);
    return res.status(200).json(result);
  }catch(error){
    return res.status(error.statusCode||502).json({error:error.code||'vision_error',message:String(error.message||'vision_error')});
  }
}
