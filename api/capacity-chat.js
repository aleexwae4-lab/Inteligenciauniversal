import chatHandler from './chat.js';
import { getClientIp } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';

export default async function capacityChatHandler(req,res){
  const body=req.body||{};
  const key=body.userKey||body.sessionId||body.session_id||getClientIp(req);
  const slot=tryAcquireChatSlot(key);
  if(!slot.ok){
    const retrySeconds=Math.max(1,Math.ceil(slot.retryAfterMs/1000));
    res.setHeader('Retry-After',String(retrySeconds));
    res.setHeader('X-WAE-Capacity','shed-v48');
    res.setHeader('X-WAE-Capacity-Reason',slot.reason);
    return res.status(503).json({
      error:'CAPACITY_BUSY',
      message:'Universal Core está absorbiendo una ráfaga de concurrencia. Este turno no se dejó colgado: fue rechazado de forma controlada y puede reintentarse.',
      recoverable:true,
      retry_after_ms:slot.retryAfterMs
    });
  }
  res.setHeader('X-WAE-Capacity','admitted-v48');
  try{
    return await chatHandler(req,res);
  }finally{
    slot.release();
  }
}
