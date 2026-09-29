import { runLiveFrontierEvaluation } from './frontier-live-eval-v1.js';
import { frontierLearningSnapshot } from './frontier-learning-v1.js';

export const FRONTIER_CONTROL_LOOP_VERSION='frontier-control-loop/v1';

const finite=v=>Number.isFinite(Number(v))?Number(v):null;

export function buildPromotionDecision({evaluation,baselineScore=null,regressionThreshold=.01}={}){
  const current=finite(evaluation?.score), baseline=finite(baselineScore);
  if(current===null)return {status:'BLOCKED',reason:'no_measured_score',regression:false,delta:null};
  if(baseline===null)return {status:'BASELINE_REQUIRED',reason:'baseline_missing',regression:false,delta:null};
  const delta=Number((current-baseline).toFixed(4));
  const regression=delta<=-Number(regressionThreshold);
  return {
    status:regression?'BLOCKED':'ELIGIBLE',
    reason:regression?'regression_detected':'no_regression_detected',
    regression,delta,baselineScore:baseline,currentScore:current,
    threshold:Number(regressionThreshold)
  };
}

export function controlLoopSnapshot({evaluation,baselineScore=null,regressionThreshold=.01}={}){
  const promotion=buildPromotionDecision({evaluation,baselineScore,regressionThreshold});
  const measured={};
  for(const item of (evaluation?.cases||[])){
    if(item?.id&&finite(item?.score)!==null)measured[item.id]=item.score;
  }
  const learning=frontierLearningSnapshot({});
  return {
    version:FRONTIER_CONTROL_LOOP_VERSION,
    evaluation:{
      status:evaluation?.status||'UNMEASURED',
      score:evaluation?.score??null,
      measuredCases:evaluation?.measuredCases??0,
      totalCases:evaluation?.totalCases??0,
      averageLatencyMs:evaluation?.operations?.averageLatencyMs??null
    },
    promotion,
    learning:{
      referenceMatrix:learning.version,
      nextFocus:learning.nextFocus,
      verdict:learning.verdict
    },
    policy:{
      promotionNeverBasedOnMarketingClaims:true,
      baselineRequiredForPromotion:true,
      regressionBlocksPromotion:true,
      missingEvidenceBlocksPromotion:true,
      noSyntheticScores:true
    }
  };
}

export async function runFrontierControlLoop({baselineScore=null,regressionThreshold=.01,maxCases=8}={}){
  const evaluation=await runLiveFrontierEvaluation({maxCases});
  const snapshot=controlLoopSnapshot({evaluation,baselineScore,regressionThreshold});
  return {version:FRONTIER_CONTROL_LOOP_VERSION,status:'MEASURED',evaluation,snapshot};
}
