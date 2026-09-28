export const FRONTIER_ARENA_VERSION='frontier-arena/v1';
const REFERENCES=Object.freeze({
'frontiermath-tier4':{value:.976,source:'OpenAI GPT-6 Astra announcement — Tier 4 v2'},
'arc-agi-3':{value:.999,source:'OpenAI GPT-6 Astra announcement'},
'gpqa-diamond':{value:.96,source:'OpenAI GPT-6 Astra announcement'},
'exploitbench':{value:1,source:'OpenAI GPT-6 Astra announcement'},
'terminal-bench-4':{value:.579,source:'OpenAI GPT-6 Astra announcement'},
'osworld-2':{value:.726,source:'OpenAI GPT-6 Astra announcement'},
'benchcad':{value:.959,source:'OpenAI GPT-6 Astra announcement'}
});
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=v=>Math.max(0,Math.min(1,Number(v)));
export function frontierArenaReferences(){return{version:FRONTIER_ARENA_VERSION,references:Object.fromEntries(Object.entries(REFERENCES).map(([id,x])=>[id,{...x}])),policy:{sourceAttributionRequired:true,measuredOnly:true,missingIsNotZero:true,noSyntheticScores:true,noGlobalSuperiorityClaim:true}}}
export function evaluateFrontierArena(measured={}){
 const cases=Object.entries(REFERENCES).map(([id,ref])=>{const raw=finite(measured?.[id]);const actual=raw===null?null:clamp(raw);const gap=actual===null?null:Number((actual-ref.value).toFixed(4));return{id,reference:ref.value,actual,gap,status:actual===null?'UNMEASURED':gap>=0?'AT_OR_ABOVE_REFERENCE':'BELOW_REFERENCE',source:ref.source}});
 const rows=cases.filter(x=>x.actual!==null),atOrAbove=rows.filter(x=>x.gap>=0).length;
 return{version:FRONTIER_ARENA_VERSION,cases,coverage:Number((rows.length/cases.length).toFixed(4)),measured:rows.length,atOrAboveReference:atOrAbove,averageGap:rows.length?Number((rows.reduce((s,x)=>s+x.gap,0)/rows.length).toFixed(4)):null,verdict:rows.length?'BENCHMARK_SCOPED_ONLY':'NO_EVIDENCE',policy:frontierArenaReferences().policy};
}