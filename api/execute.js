import { capabilityPlan } from '../lib/capability-kernel.js';
import { executeCapability, executionPlaneSnapshot, probeExecutionPlane } from '../lib/execution-plane.js';
import { persistExecutionReceipt } from '../lib/execution-ledger-v75.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';

function supportedCapabilities(){
  return new Set(executionPlaneSnapshot().adapters.flatMap((adapter)=>adapter.capabilities));
}

function resolveCapability(body,plan){
  const explicit=String(body.capability||body.domain||'').trim().toLowerCase();
  if(explicit)return explicit;
  const supported=supportedCapabilities();
  return plan.matched.find((item)=>supported.has(item.id))?.id||'';
}

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET'){
    const probe=await probeExecutionPlane();
    return res.status(200).json({success:true,executionPlane:probe});
  }
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_EXECUTION_RATE_LIMIT_PER_MINUTE||10)))return res.status(429).json({error:'rate_limited'});

  const body=req.body&&typeof req.body==='object'?req.body:{};
  const task=String(body.task||body.message||'').slice(0,30000);
  const input=body.input&&typeof body.input==='object'&&!Array.isArray(body.input)?body.input:{};
  const plan=capabilityPlan(task||String(input.content||'').slice(0,4000));
  const capability=resolveCapability(body,plan);
  const userKey=String(body.userKey||body.sessionId||getClientIp(req)).slice(0,500);
  const sessionId=String(body.sessionId||'').slice(0,500)||null;

  const execution=await executeCapability({
    capability,
    action:body.action,
    task,
    input,
    userKey,
    sessionId,
    approved:false,
    persistReceipt:persistExecutionReceipt,
  });

  const statusCode=execution.success?200:execution.status==='blocked'?422:502;
  return res.status(statusCode).json({
    ...execution,
    executionPlane:executionPlaneSnapshot().version,
    capabilityPlan:{
      schema:plan.schema,
      kernel:plan.kernel,
      matched:plan.matched,
      selectedCapability:capability||null,
    },
  });
}
