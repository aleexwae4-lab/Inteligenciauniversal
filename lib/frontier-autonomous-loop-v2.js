import { frontierLearningSnapshot, frontierLearningTargets, frontierTrainingPlan } from './frontier-learning-v1.js';
import { evaluateRun } from './frontier-evaluation-fabric-v1.js';

export const FRONTIER_AUTONOMOUS_VERSION='frontier-autonomous-loop/v2';

const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const safeText=v=>typeof v==='string'?v.trim():'';

export function buildFrontierQueue(input={}){
  const snapshot=frontierLearningSnapshot(input.measured||{});
  const maxItems=Math.max(1,Math.min(10,Number(input.maxItems)||5));
  const queue=snapshot.priorities.slice(0,maxItems).map((row,index)=>{
    const plan=frontierTrainingPlan(row.domain);
    return {
      rank:index+1,
      domain:row.domain,
      priorityScore:row.priorityScore,
      worstGap:row.worstGap,
      cases:row.cases,
      objective:plan.plan.objective,
      safeTasks:plan.plan.safeTasks,
      gate:'measure -> train -> regression -> reference comparison'
    };
  });
  if(!queue.length){
    return {
      version:FRONTIER_AUTONOMOUS_VERSION,
      status:snapshot.measured?'AWAITING_MEASUREMENTS':'NO_EVIDENCE',
      nextAction:'collect_reproducible_measurements',
      queue:[]
    };
  }
  return {
    version:FRONTIER_AUTONOMOUS_VERSION,
    status:'READY',
    nextAction:'execute_rank_1_then_remeasure',
    queue,
    policy:{noSyntheticScores:true,missingIsNotZero:true,noGlobalSuperiorityClaim:true}
  };
}

export function orchestrateFrontierCycle(input={}){
  const evaluation=input.evaluation&&typeof input.evaluation==='object'?evaluateRun(input.evaluation):null;
  const measured=input.measured||{};
  const queue=buildFrontierQueue({measured,maxItems:input.maxItems});
  const targets=frontierLearningTargets().targets;
  const targetIds=Object.keys(targets);
  const unmeasured=targetIds.filter(id=>finite(measured[id])===null);
  const measuredCount=targetIds.length-unmeasured.length;
  const promotionBlocked=Boolean(evaluation?.promotion?.status==='BLOCKED');
  return {
    version:FRONTIER_AUTONOMOUS_VERSION,
    timestamp:new Date().toISOString(),
    evidence:{measured:measuredCount,total:targetIds.length,unmeasured:unmeasured.length},
    evaluation,
    queue,
    decision:promotionBlocked
      ? 'HOLD_AND_REPAIR_REGRESSION'
      : queue.queue.length
      ? 'TRAIN_TOP_GAP_AND_REMEASURE'
      : 'COLLECT_BASELINE_EVIDENCE',
    next:{
      benchmark:queue.queue[0]?.domain??null,
      action:promotionBlocked?'repair_regression':queue.queue.length?'train_and_remeasure':'collect_measurements'
    },
    policy:{promotionRequiresProvenance:true,regressionsBlockPromotion:true,syntheticScoresAllowed:false}
  };
}
