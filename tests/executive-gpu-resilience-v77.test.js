import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {publicOrchestrationResult} from '../api/orchestrate.js';
import {executiveGpuFallbackAllowed,EXECUTIVE_RESILIENCE_VERSION} from '../lib/executive-orchestration-v52.js';

const ENV_KEYS=['WAE_GPU_FABRIC_ENABLED','WAE_GPU_ALLOW_ATTACHMENTS','WAE_GPU_LANE_1_ID','WAE_GPU_LANE_1_BASE_URL','WAE_GPU_LANE_1_API_KEY','WAE_GPU_LANE_1_MODEL','NVIDIA_API_KEY','GROQ_API_KEY','HF_TOKEN','HUGGINGFACE_API_KEY','OPENROUTER_API_KEY'];
function isolatedGpu(){const saved=new Map(ENV_KEYS.map(k=>[k,process.env[k]]));for(const k of ENV_KEYS)delete process.env[k];process.env.WAE_GPU_FABRIC_ENABLED='1';process.env.WAE_GPU_LANE_1_ID='executive-test';process.env.WAE_GPU_LANE_1_BASE_URL='https://executive-test.example/v1';process.env.WAE_GPU_LANE_1_API_KEY='secret-test';process.env.WAE_GPU_LANE_1_MODEL='test/model';return()=>{for(const[k,v]of saved){if(v===undefined)delete process.env[k];else process.env[k]=v}}}

test('public deep orchestration contract is stable and strips provider identity',()=>{
  const internal={
    success:true,deep:true,reply:'OK',provider:'private-provider',model:'private-model',fallbackFailures:[{x:1}],
    response:{content:'OK',metadata:{provider:'private-provider',model:'private-model',quality:{pass:true}}},
    orchestration:{version:'db-executive-orchestrator/v57-evidence-router',synthesis:'Universal Core',specialists:[{role:'CEO',ok:true}]}
  };
  const result=publicOrchestrationResult(internal,{changed:false});
  assert.equal(result.deep,true);
  assert.equal(result.orchestration.schema,'universal-orchestrator/v1');
  assert.equal(result.orchestration.implementationVersion,'db-executive-orchestrator/v57-evidence-router');
  assert.equal(result.orchestration.synthesis,'executive');
  assert.equal(result.orchestration.synthesisStatus,'Universal Core');
  assert.equal(result.orchestration.specialists.length,1);
  assert.equal('provider' in result,false);
  assert.equal('model' in result,false);
  assert.equal('fallbackFailures' in result,false);
  assert.equal('provider' in result.response.metadata,false);
  assert.equal('model' in result.response.metadata,false);
});

test('executive GPU fallback is eligible only for ordinary non-sensitive non-live turns',()=>{
  const restore=isolatedGpu();
  try{
    assert.equal(executiveGpuFallbackAllowed({message:'Analiza esta arquitectura',mode:'analysis',provider:'auto'}),true);
    assert.equal(executiveGpuFallbackAllowed({message:'Analiza el documento',attachments:[{name:'privado.pdf'}]}),false);
    assert.equal(executiveGpuFallbackAllowed({message:'Analiza esto',sensitivity:'CONFIDENTIAL'}),false);
    assert.equal(executiveGpuFallbackAllowed({message:'¿Qué ocurrió hoy?',mode:'analysis'}),false);
    assert.equal(executiveGpuFallbackAllowed({message:'Investiga noticias',web_enabled:true}),false);
    assert.equal(executiveGpuFallbackAllowed({message:'Analiza esto',provider:'specific-provider'}),false);
  }finally{restore()}
});

test('executive resilience is wired to v77 GPU scheduler without recursive chat fallback',async()=>{
  assert.equal(EXECUTIVE_RESILIENCE_VERSION,'executive-gpu-resilience/v77');
  const executive=await readFile(new URL('../lib/executive-orchestration-v52.js',import.meta.url),'utf8');
  const endpoint=await readFile(new URL('../api/orchestrate.js',import.meta.url),'utf8');
  assert.match(executive,/generateWithGpuFabric/);
  assert.match(executive,/weakGeneration/);
  assert.match(executive,/executiveGpuFallbackAllowed/);
  assert.doesNotMatch(executive,/\/api\/chat/);
  assert.match(endpoint,/publicOrchestrationResult/);
  assert.match(endpoint,/ORCHESTRATOR_VERSION/);
  assert.match(endpoint,/EXECUTIVE_RESILIENCE_VERSION/);
});
