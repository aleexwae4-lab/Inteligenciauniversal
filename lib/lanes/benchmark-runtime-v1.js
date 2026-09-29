import { readAdaptiveLearning, recordAdaptiveOutcome, adaptiveLearningCapabilities, ADAPTIVE_LEARNING_LOOP_VERSION } from '../adaptive-learning-loop-v1.js';
import { buildAdaptiveSupremacyRouter, ADAPTIVE_SUPREMACY_ROUTER_VERSION } from '../adaptive-supremacy-router-v1.js';
import { buildArenaV2, buildArenaCurriculum, BENCHMARK_ARENA_V2 } from '../benchmark-arena-v2.js';

export {
  readAdaptiveLearning,
  recordAdaptiveOutcome,
  adaptiveLearningCapabilities,
  ADAPTIVE_LEARNING_LOOP_VERSION,
  buildAdaptiveSupremacyRouter,
  ADAPTIVE_SUPREMACY_ROUTER_VERSION,
  BENCHMARK_ARENA_V2,
};

export async function buildAdaptiveBenchmarkRuntime({
  payload={},
  category='default',
}={}){
  const adaptiveRequested=payload.adaptiveHistory!=null
    || payload.hardChallenge===true
    || payload.astraGapReport!=null
    || payload.regressionCurriculum!=null
    || payload.adaptiveMode===true;

  const learnedRows=adaptiveRequested
    ? await readAdaptiveLearning({category})
    : null;

  const learnedBest=Array.isArray(learnedRows)&&learnedRows.length
    ? learnedRows[0]
    : null;

  const adaptiveHistory={...(payload.adaptiveHistory||{})};

  if(learnedBest){
    adaptiveHistory[category]={
      successRate:learnedBest.successRate,
      meanQuality:learnedBest.meanQuality,
      meanLatencyMs:learnedBest.meanLatencyMs,
      sampleCount:learnedBest.sampleCount,
    };
  }

  const adaptiveSupremacy=buildAdaptiveSupremacyRouter({
    taskCategory:category,
    history:adaptiveHistory,
    constraints:{
      hardChallenge:payload.hardChallenge===true,
      budget:String(payload.budget||'balanced'),
    },
    gapReport:payload.astraGapReport||{},
    curriculum:payload.regressionCurriculum||{},
  });

  const benchmarkRequested=Array.isArray(payload.benchmarkEntries)&&payload.benchmarkEntries.length>0
    || payload.previousArena!=null
    || Number(payload.benchmarkDifficulty||0)!==0
    || payload.benchmarkMode===true;

  const benchmarkArena=benchmarkRequested
    ? buildArenaV2({
        entries:payload.benchmarkEntries||[],
        previous:payload.previousArena||{},
        difficultyBoost:Number(payload.benchmarkDifficulty||0),
      })
    : {
        version:BENCHMARK_ARENA_V2,
        suiteVersion:'astra-frontier-challenge/v1',
        cases:0,
        overallScore:null,
        dimensions:{},
        regressionQueue:[],
        nextDifficulty:0,
        previousScore:null,
        improvement:null,
        policy:{
          verifiedOnly:true,
          adaptiveDifficulty:true,
          regressionFirst:true,
          noSimulatedCompetitorData:true,
          noGlobalSuperiorityClaim:true,
          rawAnswersPersisted:false,
        },
      };

  const benchmarkCurriculum=benchmarkRequested
    ? buildArenaCurriculum({arena:benchmarkArena,maxCases:12})
    : {
        version:BENCHMARK_ARENA_V2,
        mode:'regression_first_adaptive_difficulty',
        difficulty:0,
        cases:[],
      };

  return {
    adaptiveRequested,
    learnedRows,
    learnedBest,
    adaptiveHistory,
    adaptiveSupremacy,
    benchmarkRequested,
    benchmarkArena,
    benchmarkCurriculum,
    versions:{
      adaptiveLearning:ADAPTIVE_LEARNING_LOOP_VERSION,
      adaptiveSupremacy:ADAPTIVE_SUPREMACY_ROUTER_VERSION,
      benchmarkArena:BENCHMARK_ARENA_V2,
    },
  };
}
