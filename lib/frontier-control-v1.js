import { frontierLearningSnapshot, frontierLearningTargets, frontierTrainingPlan, FRONTIER_LEARNING_VERSION } from './frontier-learning-v1.js';

export const FRONTIER_CONTROL_VERSION='frontier-control/v1';
const text=v=>typeof v==='string'?v.trim():'';
const num=v=>Number.isFinite(Number(v))?Number(v):null;

export function validateMeasurement(input={}){
  const benchmark=text(input.benchmark), score=num(input.score), runId=text(input.runId);
  const harness=text(input.harness), graderVersion=text(input.graderVersion);
  const datasetVersion=text(input.datasetVersion), model=text(input.model);
  const errors=[];
  if(!benchmark)errors.push('benchmark_required');
  if(score===null||score<0||score>1)errors.push('score_must_be_between_0_and_1');
  if(!runId)errors.push('runId_required');
  if(!harness)errors.push('harness_required');
  if(!graderVersion)errors.push('graderVersion_required');
  if(!datasetVersion)errors.push('datasetVersion_required');
  if(!model)errors.push('model_required');
  if(benchmark&&!frontierLearningTargets().targets[benchmark])errors.push('benchmark_not_in_reference_matrix');
  return {valid:errors.length===0,errors,measurement:errors.length?null:{
    benchmark,score,runId,harness,graderVersion,datasetVersion,model,
    timestamp:text(input.timestamp)||new Date().toISOString()
  }};
}

export function frontierControlSnapshot(measurements=[]){
  const accepted=[], rejected=[];
  for(const item of Array.isArray(measurements)?measurements:[]){
    const result=validateMeasurement(item);
    (result.valid?accepted:rejected).push(result.valid?result.measurement:{...item,errors:result.errors});
  }
  const measured={};
  for(const item of accepted)measured[item.benchmark]=item.score;
  const learning=frontierLearningSnapshot(measured);
  const byDomain={};
  for(const item of accepted){
    const target=frontierLearningTargets().targets[item.benchmark];
    if(!target)continue;
    const gap=item.score-target.target;
    const row=byDomain[target.domain]??{domain:target.domain,cases:0,scoreSum:0,gapSum:0};
    row.cases++; row.scoreSum+=item.score; row.gapSum+=gap; byDomain[target.domain]=row;
  }
  const domains=Object.values(byDomain).map(x=>({
    domain:x.domain,cases:x.cases,
    averageScore:Number((x.scoreSum/x.cases).toFixed(4)),
    averageGap:Number((x.gapSum/x.cases).toFixed(4))
  })).sort((a,b)=>a.averageGap-b.averageGap);
  return {
    version:FRONTIER_CONTROL_VERSION,learningVersion:FRONTIER_LEARNING_VERSION,
    accepted:accepted.length,rejected:rejected.length,evidenceCoverage:learning.coverage,
    acceptedMeasurements:accepted,rejectedMeasurements:rejected,learning,domains,
    nextAction:learning.nextFocus==='collect_measurements'
      ? 'collect_reproducible_measurements'
      : 'train_and_regress_'+learning.nextFocus,
    policy:{promotionRequiresProvenance:true,promotionRequiresRegressionCheck:true,missingIsNotZero:true,noSyntheticScores:true}
  };
}

export function frontierControlPlan(domain='collect_measurements'){
  return {version:FRONTIER_CONTROL_VERSION,domain,training:frontierTrainingPlan(domain),
    gates:['reproduce_baseline','record_all_changes','run_regression_suite','compare_against_reference','promote_only_with_provenance']};
}
