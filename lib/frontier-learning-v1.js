export const FRONTIER_LEARNING_VERSION='frontier-learning/v1';

const TARGETS=Object.freeze({
  'frontiermath-tier4-v2':{domain:'reasoning',target:.976,source:'OpenAI GPT-6 Astra announcement'},
  'arc-agi-3':{domain:'adaptive-reasoning',target:.999,source:'OpenAI GPT-6 Astra announcement'},
  'gpqa-diamond':{domain:'expert-knowledge',target:.960,source:'OpenAI GPT-6 Astra announcement'},
  'terminal-bench-4':{domain:'coding-agents',target:.579,source:'OpenAI GPT-6 Astra announcement'},
  'deep-swe-v1.1':{domain:'software-engineering',target:.741,source:'OpenAI GPT-6 Astra announcement'},
  'frontiercode-1.1-extended':{domain:'software-engineering',target:.645,source:'OpenAI GPT-6 Astra announcement'},
  'terminal-bench-science-0.1':{domain:'scientific-agents',target:.646,source:'OpenAI GPT-6 Astra announcement'},
  'exploitbench':{domain:'cybersecurity',target:1.000,source:'OpenAI GPT-6 Astra announcement'},
  'exploitgym':{domain:'cybersecurity',target:.424,source:'OpenAI GPT-6 Astra announcement'},
  'sre-bench':{domain:'systems-reasoning',target:.880,source:'OpenAI GPT-6 Astra announcement'},
  'sec-bench-pro':{domain:'secure-engineering',target:.854,source:'OpenAI GPT-6 Astra announcement'}
});

const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=v=>Math.max(0,Math.min(1,Number(v)));

export function frontierLearningTargets(){
  return {
    version:FRONTIER_LEARNING_VERSION,
    targets:Object.fromEntries(Object.entries(TARGETS).map(([id,x])=>[id,{...x}])),
    policy:{
      measuredOnly:true,
      missingIsNotZero:true,
      sourceAttributionRequired:true,
      noSyntheticScores:true,
      noGlobalSuperiorityClaim:true,
      cyberEvaluationSafeMode:true
    }
  };
}

export function frontierLearningSnapshot(measured={}){
  const cases=Object.entries(TARGETS).map(([id,t])=>{
    const raw=finite(measured?.[id]);
    const actual=raw===null?null:clamp(raw);
    const gap=actual===null?null:Number((actual-t.target).toFixed(4));
    return {
      id,domain:t.domain,target:t.target,actual,gap,
      status:actual===null?'UNMEASURED':gap>=0?'MEETS_REFERENCE':'GAP',
      source:t.source
    };
  });
  const observed=cases.filter(x=>x.actual!==null);
  const gaps=observed.filter(x=>x.gap<0);
  const domainMap={};
  for(const row of gaps){
    const current=domainMap[row.domain]??{domain:row.domain,cases:0,totalGap:0,worstGap:0};
    current.cases++;
    current.totalGap+=row.gap;
    current.worstGap=Math.min(current.worstGap,row.gap);
    domainMap[row.domain]=current;
  }
  const priorities=Object.values(domainMap)
    .map(x=>({...x,priorityScore:Number((Math.abs(x.worstGap)*.7+Math.abs(x.totalGap/x.cases)*.3).toFixed(4))}))
    .sort((a,b)=>b.priorityScore-a.priorityScore);
  return {
    version:FRONTIER_LEARNING_VERSION,
    coverage:Number((observed.length/cases.length).toFixed(4)),
    measured:observed.length,
    gaps:gaps.length,
    cases,
    priorities,
    nextFocus:priorities[0]?.domain??'collect_measurements',
    verdict:observed.length?'TRAINING_PRIORITY_AVAILABLE':'NO_EVIDENCE',
    policy:frontierLearningTargets().policy
  };
}

export function frontierTrainingPlan(domain='collect_measurements'){
  const plans={
    reasoning:{objective:'multi-step reasoning under strict verification',safeTasks:['derive-and-check mathematical arguments','detect hidden assumptions','produce independently checkable intermediate steps']},
    'adaptive-reasoning':{objective:'learn novel task rules efficiently',safeTasks:['infer rules from examples','test hypotheses against counterexamples','minimize unnecessary actions']},
    'expert-knowledge':{objective:'expert-level question answering with calibrated uncertainty',safeTasks:['answer with evidence requirements','separate known facts from inference','refuse unsupported certainty']},
    'coding-agents':{objective:'reliable software engineering',safeTasks:['implement from specification','debug failing tests','perform regression analysis','review diffs for correctness and security']},
    'software-engineering':{objective:'end-to-end code quality',safeTasks:['architecture decisions','test-driven fixes','dependency and API reasoning','performance regression detection']},
    'scientific-agents':{objective:'tool-using scientific workflows',safeTasks:['data analysis','simulation planning','parameter reasoning','reproducibility checks']},
    cybersecurity:{objective:'defensive security reasoning',safeTasks:['threat modeling','vulnerability triage','secure-code review','patch validation']},
    'systems-reasoning':{objective:'reverse engineering and systems understanding',safeTasks:['infer component behavior from observations','trace state transitions','identify invariants']},
    'secure-engineering':{objective:'secure software engineering',safeTasks:['find unsafe patterns','design mitigations','verify security regression tests']},
    collect_measurements:{objective:'obtain reproducible baseline measurements',safeTasks:['run fixed evaluation sets','record tool configuration','store provenance and grader version']}
  };
  return {version:FRONTIER_LEARNING_VERSION,domain,plan:plans[domain]??plans.collect_measurements};
}
