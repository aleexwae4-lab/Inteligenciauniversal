import { nativeBrainReply, nativeBrainStatus, NATIVE_BRAIN_VERSION } from '../lib/native-brain-v5.js';
import { applyHeaders, originAllowed, allowRequest } from '../lib/security.js';
import { classifySelfAwarenessV99, buildSelfAwarenessReplyV99, selfAwarenessSnapshotV99 } from '../lib/self-awareness-v99.js';
import { userContextStateV92 } from '../lib/user-context-v92.js';
import { contextualFollowupV103 } from '../lib/context-integrity-v103.js';

export default async function nativeBrainHandler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json(nativeBrainStatus());
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req))return res.status(429).json({error:'rate_limited'});
  try{
    const body=req.body||{};
    const awareness=classifySelfAwarenessV99(body);
    // Self-description is server-grounded; it must not spend a provider request,
    // and must not replace a contextual or explicitly personalized follow-up.
    const context=userContextStateV92(body);
    const followup=contextualFollowupV103(body.message||body.task||'',body.history||[]);
    if(awareness.eligible&&!context.affectsGeneration&&!followup){
      const reply=buildSelfAwarenessReplyV99({kind:awareness.kind});
      const snapshot=selfAwarenessSnapshotV99();
      res.setHeader('X-WAE-Native-Brain',NATIVE_BRAIN_VERSION);
      res.setHeader('X-WAE-Native-Path','grounded-self-awareness-v120');
      res.setHeader('X-WAE-Quality-Strategy','grounded-capability-snapshot');
      res.setHeader('X-WAE-Fast-Path','grounded-self-awareness-v120');
      return res.status(200).json({
        success:true,reply,speech_text:reply,
        response:{content:reply,speechText:reply,sources:[],metadata:{selfAwareness:snapshot,fastLane:true}},
        provider:'universal_core',model:'universal-core-self-awareness-v103',
        native_brain:NATIVE_BRAIN_VERSION,native_path:'grounded-self-awareness-v120',
        self_awareness:snapshot,web_sources:[],fast_lane:true
      });
    }
    const result=await nativeBrainReply(body);
    res.setHeader('X-WAE-Native-Brain',NATIVE_BRAIN_VERSION);
    res.setHeader('X-WAE-Native-Path',String(result.native_path||'unknown'));
    res.setHeader('X-WAE-Quality-Score',String(result?.quality?.score??'unknown'));
    res.setHeader('X-WAE-Quality-Strategy',String(result?.selection?.strategy||'none'));
    return res.status(200).json(result);
  }catch(error){
    const status=Number(error?.statusCode)||500;
    return res.status(status).json({error:String(error?.message||'native_brain_error'),recoverable:status>=500,native_brain:NATIVE_BRAIN_VERSION});
  }
}
