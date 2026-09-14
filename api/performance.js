import { applyHeaders } from '../lib/security.js';
import { fetchPerformanceGate, fetchCognitiveScorecard } from '../lib/performance.js';

export default async function performanceHandler(req,res) {
  applyHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({error:'method_not_allowed'});
  const [gate,cognitive]=await Promise.all([
    fetchPerformanceGate({windowHours:6,minOk:20}),
    fetchCognitiveScorecard({windowHours:24})
  ]);
  return res.status(200).json({
    success:true,
    core:'Universal Core',
    performance:gate,
    cognitive,
    production_gate:{
      performance_ready:gate.routing_state==='PROMOTE',
      cognitive_ready:cognitive.state==='PASS',
      stream_ready:gate.stream_ready===true,
      globally_ready:gate.routing_state==='PROMOTE'&&cognitive.state==='PASS'
    },
    public_contract:'universal-performance+quality/v3'
  });
}
