import { applyHeaders } from '../lib/security.js';
import { fetchPerformanceGate, fetchCognitiveScorecard, fetchReliabilityPlane, fetchSelfImprovement } from '../lib/performance.js';
import { latencySnapshotV94 } from '../lib/latency-metrics-v94.js';

export default async function performanceHandler(req,res) {
  applyHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({error:'method_not_allowed'});
  const [gate,cognitive,reliability,selfImprovement]=await Promise.all([
    fetchPerformanceGate({windowHours:6,minOk:20}),
    fetchCognitiveScorecard({windowHours:24}),
    fetchReliabilityPlane({windowMinutes:30}),
    fetchSelfImprovement({windowHours:24})
  ]);
  const liveLatency=latencySnapshotV94({windowMs:60*60*1000});
  const reliabilityReady=reliability.available===true&&reliability.runtime.requests>=5&&reliability.runtime.success_pct>=99&&reliability.models.healthy>=1;
  const instantResponseReady=gate.stream_ready===true&&gate.best_stream_ttft_ms>0&&gate.best_stream_ttft_ms<=Number(gate?.policy?.stream_ttft_ceiling_ms||2500);
  const learningReady=selfImprovement.available===true&&selfImprovement.router_learning_active===true&&selfImprovement.signals.total>=100&&selfImprovement.signals.learned_routes>=1;
  return res.status(200).json({
    success:true,
    core:'Universal Core',
    performance:gate,
    live_latency:liveLatency,
    cognitive,
    reliability,
    self_improvement:selfImprovement,
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
      learning_ready:learningReady,
      supremacy_claim_allowed:selfImprovement?.supremacy_gate?.claim_allowed===true,
      globally_ready:gate.routing_state==='PROMOTE'&&cognitive.state==='PASS'&&reliabilityReady&&learningReady
    },
    public_contract:'universal-performance+quality+reliability+streaming+learning/v6',
    latency_contract:'universal-performance+quality+reliability+streaming+learning+latency/v7'
  });
}
