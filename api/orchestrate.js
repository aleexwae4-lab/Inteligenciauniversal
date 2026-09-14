import { executeMission } from '../lib/runtime.js';
import { planMission, specialistPrompt, synthesisPrompt, ORCHESTRATOR_VERSION } from '../lib/orchestrator.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';

const cleanHistory=(value)=>Array.isArray(value)?value.slice(-16).filter(x=>x&&['user','assistant'].includes(x.role)).map(x=>({role:x.role,text:String(x.text??x.content??'').slice(0,12000)})):[];
const cleanAttachments=(value)=>Array.isArray(value)?value.slice(0,5):[];

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_DEEP_RATE_LIMIT_PER_MINUTE||6)))return res.status(429).json({error:'deep_rate_limited'});

  const body=req.body||{};
  const message=String(body.message||body.task||'').trim();
  if(!message)return res.status(400).json({error:'message_required'});
  if(message.length>30000)return res.status(413).json({error:'message_too_large'});

  const started=Date.now();
  const sessionId=String(body.sessionId||body.session_id||'').slice(0,160);
  const rootKey=String(body.userKey||sessionId||getClientIp(req)).slice(0,160);
  const history=cleanHistory(body.history);
  const attachments=cleanAttachments(body.attachments);
  const plan=planMission(message,body.specialists);

  const specialistRuns=await Promise.allSettled(plan.specialists.map(async agent=>{
    const result=await executeMission({
      message:specialistPrompt(agent,message),
      mode:agent,
      userKey:`${rootKey}:deep:${agent}`.slice(0,160),
      sessionId:`${sessionId}:deep:${agent}`.slice(0,160),
      history,
      attachments,
    });
    return{agent,reply:result.reply,latencyMs:result.latencyMs,tools:(result.tools||[]).map(x=>({tool:x.tool,ok:x.ok}))};
  }));

  const specialists=specialistRuns.map((run,index)=>run.status==='fulfilled'?run.value:{agent:plan.specialists[index],error:String(run.reason?.message||run.reason||'specialist_failed').slice(0,300)});
  const usable=specialists.filter(x=>x.reply);

  try{
    const final=await executeMission({
      message:synthesisPrompt(message,plan,usable),
      mode:'executive',
      userKey:rootKey,
      sessionId,
      history,
      attachments,
    });
    const elapsedMs=Date.now()-started;
    return res.status(200).json({
      ...final,
      provider:undefined,
      model:undefined,
      fallbackFailures:undefined,
      deep:true,
      orchestration:{
        schema:ORCHESTRATOR_VERSION,
        strategy:plan.strategy,
        specialists:specialists.map(x=>({agent:x.agent,ok:!!x.reply,latencyMs:x.latencyMs||null,tools:x.tools||[],error:x.error||null})),
        synthesis:'executive',
        elapsedMs,
        evidencePolicy:plan.evidencePolicy,
      },
      agent:{id:'universal-deep',name:'Universal Core Deep'},
    });
  }catch(error){
    return res.status(error.statusCode||502).json({error:error.code||'deep_orchestration_failed',message:String(error.message||error)});
  }
}
