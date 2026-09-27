import { createHash } from 'node:crypto';
import { astraFrontierSuite } from './astra-frontier-challenge-v1.js';

export const BENCHMARK_ARENA_V2='benchmark-arena/v2';
const DIMENSIONS=['reasoning','coding','agentic','long_context','professional','computer_use','research','multimodal','security','verification'];
const hash=v=>createHash('sha256').update(String(v??'')).digest('hex');

function clamp(v){return Math.max(0,Math.min(1,Number(v)||0))}
function normalize(entries=[]){return new Map((Array.isArray(entries)?entries:[]).map(x=>[String(x?.caseId||x?.id),x]))}

export function buildArenaV2({entries=[],previous={},difficultyBoost=0}={}){
  const suite=astraFrontierSuite(),map=normalize(entries),byDimension={},losses=[];
  for(const c of suite){
    const row=map.get(c.id);
    const score=clamp(row?.score);
    const dimension=c.category;
    (byDimension[dimension]??=[]).push(score);
    if(row?.verified!==true||score<0.80)losses.push({
      caseId:c.id,category:dimension,score,
      severity:score<0.50?'critical':score<0.80?'high':'medium',
      regressionKey:hash(c.id+':'+String(score))
    });
  }
  const dimensions=Object.fromEntries(Object.entries(byDimension).map(([k,v])=>[k,{
    score:Number((v.reduce((a,b)=>a+b,0)/Math.max(1,v.length)).toFixed(4)),cases:v.length
  }]));
  const measured=Object.values(dimensions);
  const overall=measured.length?Number((measured.reduce((a,b)=>a+b.score,0)/measured.length).toFixed(4)):0;
  const nextDifficulty=Math.min(1,Math.max(0,Number(difficultyBoost)||0)+losses.length/Math.max(1,suite.length)*0.25);
  return {
    version:BENCHMARK_ARENA_V2,
    suiteVersion:'astra-frontier-challenge/v1',
    cases:suite.length,
    overallScore:overall,
    dimensions,
    regressionQueue:losses.sort((a,b)=>a.score-b.score).slice(0,20),
    nextDifficulty:Number(nextDifficulty.toFixed(4)),
    previousScore:Number(previous?.overallScore)||null,
    improvement:previous?.overallScore!=null?Number((overall-Number(previous.overallScore)).toFixed(4)):null,
    policy:{
      verifiedOnly:true,
      adaptiveDifficulty:true,
      regressionFirst:true,
      noSimulatedCompetitorData:true,
      noGlobalSuperiorityClaim:true,
      rawAnswersPersisted:false
    }
  };
}

export function buildArenaCurriculum({arena={},maxCases=12}={}){
  const queue=Array.isArray(arena.regressionQueue)?arena.regressionQueue:[];
  return {
    version:BENCHMARK_ARENA_V2,
    mode:'regression_first_adaptive_difficulty',
    difficulty:Number(arena.nextDifficulty)||0,
    cases:queue.slice(0,Math.max(1,Math.min(50,Number(maxCases)||12))).map(x=>x.caseId),
    priority:queue.some(x=>x.severity==='critical')?'critical':queue.some(x=>x.severity==='high')?'high':'maintenance',
    promotionBlocked:queue.some(x=>x.severity==='critical'||x.severity==='high'),
    policy:arena.policy||null
  };
}
