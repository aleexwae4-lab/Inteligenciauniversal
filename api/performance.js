import { applyHeaders } from '../lib/security.js';
import { fetchPerformanceGate, fetchCognitiveScorecard, fetchReliabilityPlane } from '../lib/performance.js';

export default async function performanceHandler(req,res) {
  applyHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({error:'method_not_allowed'});
  const [gate,cognitive,reliability]=await Promise.all([
    fetchPerformanceGate({windowHours:6,minOk:20}),
    fetchCognitiveScorecard({windowHours:24}),
    fetchReliabilityPlane({windowMinutes:30})
  ]);
  const reliabilityReady=reliability.available===true&&reliability.runtime.requests>=5&&reliability.runtime.success_pct>=99&&reliability.models.healthy>=1;
  const instantResponseReady=gate.stream_ready===true&&gate.best_stream_ttft_ms>0&&gate.best_stream_ttft_ms<=Number(gate?.policy?.stream_ttft_ceiling_ms||2500);
  return res.status(200).json({
    success:true,
    core:'Universal Core',
    performance:gate,
    cognitive,
    reliability,
    instant_response:{
      ready:instantResponseReady,
      verified_routes:gate.stream_ready_count||0,
      best_ttft_ms:gate.best_stream_ttft_ms||0,
      freshness_minutes:gate.stream_freshness_minutes||30,
      latest_verified_at:gate.latest_stream_success_at||null
    },
    production_gate:{
      performance_ready:gate.routing_state==='PROMOTE',
      cognitive_ready:cognitive.state==='PASS',
      reliability_ready:reliabilityReady,
      stream_ready:instantResponseReady,
      globally_ready:gate.routing_state==='PROMOTE'&&cognitive.state==='PASS'&&reliabilityReady
    },
    public_contract:'universal-performance+quality+reliability+streaming/v5'
  });
}
