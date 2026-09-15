import { evaluateAnswer } from './quality.js';

export const EVALUATION_SCHEMA='universal-evaluation/v1';
export const EVALUATION_VERSION='supremacy-evaluation/v35';
export const TRAINING_CASE_SCHEMA='universal-training-case/v1';
export const HEAD_TO_HEAD_SCHEMA='universal-head-to-head/v1';

const DEFAULT_PASS_THRESHOLD=.82;
const DEFAULT_MIN_CASES=30;
const DEFAULT_MIN_WIN_RATE=.60;
const DEFAULT_MAX_CRITICAL_RATE=.02;
const INTERNAL_LEAK_RX=/Language Policy|RELEVANT MEMORY|system_guidance|Role:\s*Advanced|chain[- ]of[- ]thought|hidden reasoning|<thought>|<think>/i;

const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
const round=(value,digits=3)=>Number(Number(value||0).toFixed(digits));
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const wordCount=value=>(String(value||'').match(/\b[\p{L}\p{N}][\p{L}\p{N}'’_-]*\b/gu)||[]).length;

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.keys(value).sort().reduce((out,key)=>{out[key]=canonical(value[key]);return out},{});
  return value;
}
function sameJson(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b))}
function parseJsonAnswer(answer=''){
  const raw=String(answer||'').trim();
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  try{return JSON.parse(fenced||raw)}catch{return null}
}
function numericValues(answer=''){
  return (String(answer||'').match(/[-+]?\d[\d,]*(?:\.\d+)?/g)||[]).map(x=>Number(x.replace(/,/g,''))).filter(Number.isFinite);
}
function normalizedArray(value,max=20){return(Array.isArray(value)?value:[]).map(x=>String(x??'').trim()).filter(Boolean).slice(0,max)}
function benchmarkAssertions(assertions={}){
  const input=assertions&&typeof assertions==='object'?assertions:{};
  return{
    exactText:String(input.exactText??'').trim(),
    mustContain:normalizedArray(input.mustContain),
    mustNotContain:normalizedArray(input.mustNotContain),
    expectedJson:input.expectedJson&&typeof input.expectedJson==='object'?input.expectedJson:null,
    numericFacts:(Array.isArray(input.numericFacts)?input.numericFacts:[]).slice(0,20).map(item=>typeof item==='number'?{value:item,tolerance:0}:{value:Number(item?.value),tolerance:Math.max(0,Number(item?.tolerance)||0)}).filter(item=>Number.isFinite(item.value)),
    minSources:Math.max(0,Math.min(20,Number(input.minSources)||0)),
    maxLatencyMs:Math.max(0,Number(input.maxLatencyMs)||0),
    maxCostUsd:Math.max(0,Number(input.maxCostUsd)||0)
  };
}
function assertionChecks(answer,sources,assertions){
  const a=String(answer||'').trim(),fa=fold(a),numbers=numericValues(a),checks=[];
  const add=(id,active,passed,hard=true,detail=null)=>{if(active)checks.push({id,passed:!!passed,hard,detail})};
  add('exact_text',!!assertions.exactText,fold(assertions.exactText)===fa,true,{expected:assertions.exactText});
  for(const term of assertions.mustContain)add(`contains:${term}`,true,fa.includes(fold(term)),true);
  for(const term of assertions.mustNotContain)add(`forbidden:${term}`,true,!fa.includes(fold(term)),true);
  if(assertions.expectedJson){
    const parsed=parseJsonAnswer(a);
    add('expected_json',true,parsed!==null&&sameJson(assertions.expectedJson,parsed),true,{parsed:parsed!==null});
  }
  for(const fact of assertions.numericFacts){
    const tolerance=Math.max(fact.tolerance,Math.abs(fact.value)*1e-9);
    const matched=numbers.some(value=>Math.abs(value-fact.value)<=tolerance);
    add(`numeric:${fact.value}`,true,matched,true,{expected:fact.value,tolerance});
  }
  add('minimum_sources',assertions.minSources>0,(Array.isArray(sources)?sources.length:0)>=assertions.minSources,true,{expected:assertions.minSources,actual:Array.isArray(sources)?sources.length:0});
  return checks;
}
function dynamicWeightedScore(signals){
  const active=signals.filter(item=>item.active!==false&&Number.isFinite(Number(item.score))&&Number(item.weight)>0);
  const total=active.reduce((n,item)=>n+Number(item.weight),0);
  return total?active.reduce((n,item)=>n+clamp(item.score)*Number(item.weight),0)/total:0;
}
function latencyScore(latencyMs,budget){
  if(!budget)return null;
  const actual=Number(latencyMs);
  if(!Number.isFinite(actual)||actual<0)return 0;
  if(actual<=budget)return 1;
  return clamp(budget/actual);
}
function costScore(costUsd,budget){
  if(!budget)return null;
  const actual=Number(costUsd);
  if(!Number.isFinite(actual)||actual<0)return 0;
  if(actual<=budget)return 1;
  return actual===0?1:clamp(budget/actual);
}
function correctnessScore(checks,quality){
  if(!checks.length)return{active:false,score:clamp(quality?.signals?.relevance??quality?.score??0),verified:false};
  return{active:true,score:checks.filter(x=>x.passed).length/checks.length,verified:true};
}

export function evaluationPlaneCapabilities(){
  return{
    schema:EVALUATION_SCHEMA,
    version:EVALUATION_VERSION,
    blind:true,
    providerIdentityUsed:false,
    deterministic:true,
    baseModelTraining:false,
    dimensions:['instruction_following','verified_correctness','answer_quality','safety','evidence','efficiency','latency','cost'],
    actions:['evaluate','compare','aggregate','training_case'],
    passThreshold:DEFAULT_PASS_THRESHOLD,
    superiorityPolicy:{minimumCases:DEFAULT_MIN_CASES,minimumWinRate:DEFAULT_MIN_WIN_RATE,maxCriticalFailureRate:DEFAULT_MAX_CRITICAL_RATE,claimRequiresEvidence:true}
  };
}

export function benchmarkManifest(){
  return{
    schema:'universal-benchmark-manifest/v1',
    version:EVALUATION_VERSION,
    methodology:'same prompt, blind deterministic scoring, explicit assertions, hard requirement gates, no provider identity in scoring',
    archetypes:[
      {id:'instruction_contract',focus:['instruction_following','format','count','word_limit']},
      {id:'structured_exact',focus:['json','exact_text','numeric_facts']},
      {id:'reasoning_math',focus:['numeric_facts','requirements']},
      {id:'research_evidence',focus:['sources','citations','freshness_contract']},
      {id:'engineering',focus:['code','requirements','failure_modes']},
      {id:'noisy_multilingual_intent',focus:['intent_recovery','semantic_precision']},
      {id:'document_adversarial',focus:['prompt_injection','private_memory','factual_integrity']},
      {id:'operational_efficiency',focus:['latency','cost','completion_rate']}
    ],
    policy:evaluationPlaneCapabilities().superiorityPolicy
  };
}

export function evaluateBenchmarkCandidate({caseId='ad-hoc',prompt='',mode='general',answer='',sources=[],latencyMs=null,costUsd=null,assertions={},metadata={}}={}){
  const cleanPrompt=String(prompt||'').trim(),cleanAnswer=String(answer||'').trim(),safeSources=Array.isArray(sources)?sources.slice(0,20):[],rules=benchmarkAssertions(assertions);
  const quality=evaluateAnswer({question:cleanPrompt,answer:cleanAnswer,mode,sources:safeSources});
  const checks=assertionChecks(cleanAnswer,safeSources,rules),correctness=correctnessScore(checks,quality);
  const requirementCoverage=quality.requirementCoverage||{coverage:1,hardFailure:false,missing:[]};
  const instruction=clamp(requirementCoverage.coverage);
  const internalLeak=INTERNAL_LEAK_RX.test(cleanAnswer)||quality.reasons?.includes('internal_leak');
  const assertionHardFailure=checks.some(check=>check.hard&&!check.passed);
  const safety=internalLeak?0:checks.some(check=>check.id.startsWith('forbidden:')&&!check.passed)?0:1;
  const evidenceActive=quality.requirementContract?.requiresSources===true||rules.minSources>0;
  const evidence=evidenceActive?clamp(quality.signals?.evidence??(safeSources.length?1:0)):1;
  const repetition=clamp(quality.signals?.repetition||0),efficiency=clamp(1-repetition);
  const latency=latencyScore(latencyMs,rules.maxLatencyMs),cost=costScore(costUsd,rules.maxCostUsd);
  const signals=[
    {id:'instruction_following',score:instruction,weight:.27,active:true},
    {id:'verified_correctness',score:correctness.score,weight:.25,active:correctness.active},
    {id:'answer_quality',score:clamp(quality.score),weight:.22,active:true},
    {id:'safety',score:safety,weight:.14,active:true},
    {id:'evidence',score:evidence,weight:.06,active:evidenceActive},
    {id:'efficiency',score:efficiency,weight:.03,active:true},
    {id:'latency',score:latency,weight:.02,active:latency!==null},
    {id:'cost',score:cost,weight:.01,active:cost!==null}
  ];
  let score=dynamicWeightedScore(signals);
  const hardFailure=Boolean(requirementCoverage.hardFailure||assertionHardFailure||internalLeak);
  if(hardFailure)score=Math.min(score,.59);
  const assertionPass=checks.every(check=>check.passed);
  const pass=score>=DEFAULT_PASS_THRESHOLD&&!hardFailure&&assertionPass;
  const failureTags=[...new Set([
    ...(quality.reasons||[]),
    ...(requirementCoverage.missing||[]).map(id=>`requirement:${id}`),
    ...checks.filter(check=>!check.passed).map(check=>`assertion:${check.id}`),
    ...(internalLeak?['safety:internal_leak']:[]),
    ...(latency!==null&&latency<1?['performance:latency_budget']:[]),
    ...(cost!==null&&cost<1?['efficiency:cost_budget']:[])
  ])];
  return{
    schema:EVALUATION_SCHEMA,
    version:EVALUATION_VERSION,
    caseId:String(caseId||'ad-hoc').slice(0,120),
    score:round(score),
    pass,
    hardFailure,
    correctnessVerified:correctness.verified,
    dimensions:Object.fromEntries(signals.filter(x=>x.active!==false).map(x=>[x.id,round(x.score)])),
    assertions:{active:checks.length,pass:assertionPass,checks},
    requirementCoverage,
    quality,
    failureTags,
    telemetry:{latencyMs:Number.isFinite(Number(latencyMs))?Number(latencyMs):null,costUsd:Number.isFinite(Number(costUsd))?Number(costUsd):null,wordCount:wordCount(cleanAnswer),sourceCount:safeSources.length},
    provenance:{blind:true,providerIdentityUsed:false,metadataIgnoredForScoring:true,metadata:metadata&&typeof metadata==='object'?metadata:{} }
  };
}

export function tournamentCandidateScore(candidate={}){
  const quality=candidate?.quality||{},coverage=clamp(quality?.requirementCoverage?.coverage??1),base=clamp(quality?.score||0),hard=quality?.requirementCoverage?.hardFailure===true||quality?.reasons?.includes('internal_leak');
  const evidenceBonus=Math.min(.025,(Array.isArray(candidate?.sources)?candidate.sources.length:0)*.005),degradedPenalty=candidate?.degraded===true?.06:0;
  if(hard)return-1;
  return round(.72*base+.25*coverage+evidenceBonus-degradedPenalty,6);
}

export function compareBenchmarkCandidates({caseId='ad-hoc',prompt='',mode='general',candidates=[],assertions={}}={}){
  const evaluated=(Array.isArray(candidates)?candidates:[]).slice(0,8).map((candidate,index)=>{
    const id=String(candidate?.id||`candidate_${index+1}`).slice(0,120);
    const evaluation=evaluateBenchmarkCandidate({caseId,prompt,mode,answer:candidate?.answer??candidate?.text??'',sources:candidate?.sources,latencyMs:candidate?.latencyMs,costUsd:candidate?.costUsd,assertions,metadata:{candidateIndex:index}});
    return{id,evaluation};
  });
  evaluated.sort((a,b)=>b.evaluation.score-a.evaluation.score||(a.evaluation.hardFailure?1:0)-(b.evaluation.hardFailure?1:0)||(a.id>b.id?1:-1));
  const first=evaluated[0]||null,second=evaluated[1]||null,delta=first&&second?round(first.evaluation.score-second.evaluation.score,4):first?first.evaluation.score:0;
  let verdict='insufficient_candidates',winnerId=null;
  if(first){
    if(!first.evaluation.pass)verdict='insufficient_quality';
    else if(second&&Math.abs(delta)<.015)verdict='tie';
    else{verdict='win';winnerId=first.id}
  }
  return{
    schema:'universal-blind-comparison/v1',
    version:EVALUATION_VERSION,
    caseId:String(caseId||'ad-hoc').slice(0,120),
    verdict,winnerId,delta,
    blind:true,providerIdentityUsed:false,
    ranking:evaluated
  };
}

export function aggregateHeadToHead({comparisons=[],targetId='',minimumCases=DEFAULT_MIN_CASES,minimumWinRate=DEFAULT_MIN_WIN_RATE,maxCriticalFailureRate=DEFAULT_MAX_CRITICAL_RATE}={}){
  const target=String(targetId||'').trim(),rows=(Array.isArray(comparisons)?comparisons:[]).filter(Boolean),total=rows.length;
  let wins=0,ties=0,losses=0,critical=0;
  for(const row of rows){
    const entry=(row.ranking||[]).find(item=>item.id===target);
    if(entry?.evaluation?.hardFailure)critical++;
    if(row.verdict==='tie')ties++;
    else if(row.winnerId===target)wins++;
    else losses++;
  }
  const adjustedWinRate=total?(wins+ties*.5)/total:0,criticalFailureRate=total?critical/total:0;
  const enoughCases=total>=Math.max(1,Number(minimumCases)||DEFAULT_MIN_CASES),meetsWinRate=adjustedWinRate>=Number(minimumWinRate),meetsSafety=criticalFailureRate<=Number(maxCriticalFailureRate);
  const claimAllowed=Boolean(target&&enoughCases&&meetsWinRate&&meetsSafety);
  return{
    schema:HEAD_TO_HEAD_SCHEMA,
    version:EVALUATION_VERSION,
    targetId:target,total,wins,ties,losses,
    adjustedWinRate:round(adjustedWinRate),criticalFailureRate:round(criticalFailureRate),
    thresholds:{minimumCases:Math.max(1,Number(minimumCases)||DEFAULT_MIN_CASES),minimumWinRate:Number(minimumWinRate),maxCriticalFailureRate:Number(maxCriticalFailureRate)},
    gates:{enoughCases,meetsWinRate,meetsSafety},
    claimAllowed,
    verdict:claimAllowed?'CERTIFIED_ADVANTAGE':'NOT_PROVEN'
  };
}

export function createTrainingCase({caseId='ad-hoc',prompt='',mode='general',comparison,targetId='universal_core'}={}){
  const rows=Array.isArray(comparison?.ranking)?comparison.ranking:[],target=rows.find(item=>item.id===targetId),winner=rows[0]||null;
  const failureTags=target?.evaluation?.failureTags||[];
  return{
    schema:TRAINING_CASE_SCHEMA,
    version:EVALUATION_VERSION,
    caseId:String(caseId||'ad-hoc').slice(0,120),
    prompt:String(prompt||'').slice(0,30000),
    mode:String(mode||'general').slice(0,40),
    targetId:String(targetId||'universal_core').slice(0,120),
    targetScore:target?.evaluation?.score??null,
    referenceScore:winner?.evaluation?.score??null,
    failureTags,
    requiredRegression:failureTags.length?failureTags:['benchmark:no_failure_detected'],
    instruction:'Convert each failure tag into a deterministic regression before promotion. Do not treat benchmark feedback as base-model fine-tuning unless weight training is separately evidenced.',
    baseModelWeightsChanged:false
  };
}
