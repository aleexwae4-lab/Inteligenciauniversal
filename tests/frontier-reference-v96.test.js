import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPENAI_FRONTIER_MODEL,
  FRONTIER_REFERENCE_VERSION,
  frontierReferenceCapabilities,
  openAIFrontierReferenceState,
} from '../lib/frontier-reference-v96.js';

function withEnv(patch,fn){
  const prior=Object.fromEntries(Object.keys(patch).map(key=>[key,process.env[key]]));
  for(const [key,value] of Object.entries(patch)){if(value===undefined)delete process.env[key];else process.env[key]=String(value)}
  try{return fn()}finally{for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
}

test('v96 pins GPT-6 Astra as the dedicated frontier reference without changing ordinary provider model',()=>{
  withEnv({OPENAI_BENCHMARK_MODEL:undefined},()=>{
    const state=openAIFrontierReferenceState([{id:'openai',configured:true,model:'gpt-5.6-sol'}]);
    assert.equal(state.version,FRONTIER_REFERENCE_VERSION);
    assert.equal(state.model,DEFAULT_OPENAI_FRONTIER_MODEL);
    assert.equal(state.referenceId,'openai:gpt-6-astra');
    assert.equal(state.ordinaryProviderModel,'gpt-5.6-sol');
    assert.equal(state.decoupledFromProductionModel,true);
    assert.equal(state.executable,true);
  });
});

test('v96 accepts an explicit versioned benchmark override but never exposes credentials',()=>{
  withEnv({OPENAI_BENCHMARK_MODEL:'gpt-6-astra-2026-09-15'},()=>{
    const state=openAIFrontierReferenceState([{id:'openai',configured:true,model:'gpt-5.6-sol'}]);
    assert.equal(state.referenceId,'openai:gpt-6-astra-2026-09-15');
    assert.equal(state.secretExposed,false);
    const caps=frontierReferenceCapabilities([{id:'openai',configured:true,model:'gpt-5.6-sol'}]);
    assert.equal(caps.productionModel,'gpt-5.6-sol');
    assert.equal(caps.benchmarkModel,'gpt-6-astra-2026-09-15');
  });
});

test('v96 comparator remains fail-closed without a configured OpenAI provider',()=>{
  const state=openAIFrontierReferenceState([{id:'openai',configured:false,model:'gpt-5.6-sol'}]);
  assert.equal(state.executable,false);
  assert.equal(state.reason,'openai_provider_not_configured');
  assert.equal(state.fallbackAllowed,false);
});
