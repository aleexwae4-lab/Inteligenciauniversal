export const FRONTIER_EVALUATION_VERSION='frontier-evaluation/v1';

const text=v=>typeof v==='string'?v.trim():'';
const num=v=>Number.isFinite(Number(v))?Number(v):null;

export function createEvaluationRun(input={}){
  const runId=text(input.runId)||`wae-run-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const model=text(input.model)||'Universal Core';
  const harness=text(input.harness);
  const graderVersion=text(input.graderVersion);
  const datasetVersion=text(input.datasetVersion);
  const commit=text(input.commit);
  const startedAt=text(input.startedAt)||new Date().toISOString();
  const errors=[];
  if(!harness)errors.push('harness_required');
  if(!graderVersion)errors.push('graderVersion_required');
  if(!datasetVersion)errors.push('datasetVersion_required');
  if(!commit)errors.push('commit_required');
  return {valid:errors.length===0,errors,run:errors.length?null:{
    version:FRONTIER_EVALUATION_VERSION,runId,model,harness,graderVersion,datasetVersion,commit,startedAt
  }};
}

export function compareEvaluationRuns(current={},baseline={}){
  const currentScore=num(current.score), baselineScore=num(baseline.score);
  const threshold=num(current.regressionThreshold) ?? .01;
  if(currentScore===null||baselineScore===null){
    return {status:'UNMEASURED',regression:false,delta:null,threshold};
  }
  const delta=Number((currentScore-baselineScore).toFixed(4));
  return {status:delta<=-threshold?'REGRESSION':'PASS',regression:delta<=-threshold,delta,threshold};
}

export function evaluateRun(input={}){
  const base=createEvaluationRun(input);
  if(!base.valid)return {version:FRONTIER_EVALUATION_VERSION,valid:false,errors:base.errors};
  const measurements=Array.isArray(input.measurements)?input.measurements:[];
  const invalid=[],accepted=[];
  for(const m of measurements){
    const benchmark=text(m?.benchmark),score=num(m?.score);
    const errors=[];
    if(!benchmark)errors.push('benchmark_required');
    if(score===null||score<0||score>1)errors.push('score_must_be_between_0_and_1');
    if(errors.length)invalid.push({...m,errors});
    else accepted.push({benchmark,score:Number(score),cases:Number.isFinite(Number(m.cases))?Number(m.cases):null});
  }
  const baselines=input.baselines&&typeof input.baselines==='object'?input.baselines:{};
  const regressions=accepted.map(m=>{
    const baseline=baselines[m.benchmark];
    if(!baseline)return {...m,comparison:{status:'NO_BASELINE',regression:false,delta:null}};
    return {...m,comparison:compareEvaluationRuns({score:m.score,regressionThreshold:input.regressionThreshold},{score:baseline})};
  });
  const regressionCount=regressions.filter(x=>x.comparison.regression).length;
  return {
    version:FRONTIER_EVALUATION_VERSION,valid:true,run:base.run,
    accepted,invalid,regressions,regressionCount,
    promotion:{
      status:regressionCount?'BLOCKED':'ELIGIBLE_PENDING_REFERENCE_COMPARISON',
      requiresReproducibility:true,requiresRegressionCheck:true,requiresReferenceComparison:true,
      syntheticScoresAllowed:false
    },
    policy:{measuredOnly:true,missingIsNotZero:true,noSyntheticScores:true,noGlobalSuperiorityClaim:true}
  };
}
