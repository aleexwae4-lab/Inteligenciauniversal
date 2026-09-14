import { applyHeaders } from '../lib/security.js';
import { fetchPerformanceGate } from '../lib/performance.js';

export default async function performanceHandler(req,res) {
  applyHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({error:'method_not_allowed'});
  const gate=await fetchPerformanceGate({windowHours:6,minOk:20});
  return res.status(200).json({
    success:true,
    core:'Universal Core',
    performance:gate,
    public_contract:'universal-performance-gate/v2'
  });
}
