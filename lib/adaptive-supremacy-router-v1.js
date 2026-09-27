import { createHash } from 'node:crypto';

export const ADAPTIVE_SUPREMACY_ROUTER_VERSION='adaptive-supremacy-router/v1';

const hash=v=>createHash('sha256').update(String(v??'')).digest('hex');

const PROFILES=Object.freeze({
  reasoning:{strategy:'dual_pass_verifier',steps:['decompose','solve','independent_verify'],verification:'independent',hardGapBoost:true},
  coding:{strategy:'execution_first',steps:['inspect','implement','run_tests','verify'],verification:'test_suite',hardGapBoost:true},
  agentic:{strategy:'plan_act_verify',steps:['plan','act','observe','verify'],verification:'state_and_output',hardGapBoost:true},
  long_context:{strategy:'hierarchical_context',steps:['index','retrieve','synthesize','verify'],verification:'source_coverage',hardGapBoost:true},
  professional:{strategy:'specialist_workflow',steps:['classify','execute','quality_check'],verification:'domain_checks',hardGapBoost:true},
  computer_use:{strategy:'action_observe_verify',steps:['plan_action','execute','observe','confirm'],verification:'postcondition',hardGapBoost:true},
  research:{strategy:'evidence_first',steps:['retrieve','triangulate','synthesize','cite'],verification:'provenance',hardGapBoost:true},
  multimodal:{strategy:'structured_perception',steps:['extract','cross_check','answer'],verification:'visual_consistency',hardGapBoost:true},
  security:{strategy:'adversarial_verify',steps:['threat_model','attempt','verify_controls'],verification:'security_gate',hardGapBoost:true},
  verification:{strategy:'independent_challenge',steps:['restate_claim','challenge','resolve'],verification:'independent',hardGapBoost:true},
  default:{strategy:'standard_quality',steps:['understand','answer','verify'],verification:'quality_gate',hardGapBoost:false}
});

const CATEGORY_ALIASES={
  science:['research','reasoning'],
  coding:['coding'],
  computer_use:['computer_use','agentic'],
  professional:['professional','automation'],
  research:['research','long_context'],
  security:['security','verification']
};

function normalizeCategory(value){
  const key=String(value||'').trim().toLowerCase().replace(/[- ]+/g,'_');
  return PROFILES[key]?key:(CATEGORY_ALIASES[key]?.[0]||'default');
}

export function buildAdaptiveSupremacyRouter({taskCategory='default',gapReport={},curriculum={},history={},constraints={}}={}){
  const category=normalizeCategory(taskCategory);
  const profile=PROFILES[category]||PROFILES.default;
  const queue=Array.isArray(curriculum.queue)?curriculum.queue:[];
  const relevant=queue.filter(x=>Array.isArray(x.regressionCases)&&x.regressionCases.length);
  const p0=queue.filter(x=>x.severity==='P0');
  const gapPressure=p0.length?Math.min(1,p0.length/3):relevant.length?0.5:0;
  const hardMode=gapPressure>0 || constraints.hardChallenge===true;
  const prior=history?.[category]||{};
  const reliability=Number.isFinite(Number(prior.successRate))?Number(prior.successRate):null;
  const latency=Number.isFinite(Number(prior.p95LatencyMs))?Number(prior.p95LatencyMs):null;
  const budget=constraints.budget||'balanced';
  const reasons=[];
  if(p0.length)reasons.push('P0_ASTRA_GAP');
  else if(relevant.length)reasons.push('P1_REGRESSION_CURRICULUM');
  if(hardMode)reasons.push('HARD_CHALLENGE');
  if(reliability!==null&&reliability<0.95)reasons.push('RELIABILITY_DEBT');
  if(latency!==null&&constraints.maxP95LatencyMs&&latency>Number(constraints.maxP95LatencyMs))reasons.push('LATENCY_DEBT');
  if(!reasons.length)reasons.push('BASELINE_STRATEGY');

  const strategy=hardMode&&profile.hardGapBoost
    ? {...profile,steps:[...profile.steps,'independent_challenger'],verification:'independent_plus_gate'}
    : profile;

  return {
    version:ADAPTIVE_SUPREMACY_ROUTER_VERSION,
    category,
    strategy,
    decision:{
      hardMode,
      budget,
      reasonCodes:reasons,
      gapPressure:Number(gapPressure.toFixed(3)),
      regressionTasks:relevant.slice(0,5).map(x=>x.id)
    },
    observed:{
      reliability,
      p95LatencyMs:latency,
      gapSummary:gapReport?.summary||null
    },
    policy:{
      strategyOnly:true,
      providerSelectionDelegated:true,
      noPaidProviderProvisioning:true,
      noSimulatedCompetitorData:true,
      noGlobalSuperiorityClaim:true
    },
    deterministicId:hash(JSON.stringify({category,strategy,reasons,relevant:relevant.slice(0,5).map(x=>x.id),budget}))
  };
}

export function routeTask(task={},context={}){
  const category=task.category||task.domain||'default';
  return buildAdaptiveSupremacyRouter({...context,taskCategory:category});
}
