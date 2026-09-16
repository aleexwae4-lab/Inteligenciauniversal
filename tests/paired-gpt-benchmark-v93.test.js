import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAIRED_GPT_BENCHMARK_VERSION,
  DEFAULT_REFERENCE_ID,
  DEFAULT_TARGET_ID,
  buildOpenAIRequest,
  buildUniversalRequest,
  extractOpenAIText,
  extractOpenAISources,
  extractUniversalAnswer,
  extractUniversalSources,
  estimateOpenAICostUsd,
  benchmarkRunManifest,
} from '../lib/paired-gpt-benchmark-v93.js';

test('v93 pins the strongest current GPT reference explicitly',()=>{
  assert.equal(PAIRED_GPT_BENCHMARK_VERSION,'paired-gpt-benchmark/v93');
  assert.equal(DEFAULT_REFERENCE_ID,'gpt-6-astra');
  assert.equal(DEFAULT_TARGET_ID,'universal-core-v92');
});

test('research cases give GPT web search and request source provenance',()=>{
  const body=buildOpenAIRequest({mode:'research',prompt:'Investiga el estado actual de WebGPU'},{model:'gpt-6-astra',reasoningEffort:'high'});
  assert.equal(body.model,'gpt-6-astra');
  assert.equal(body.reasoning.effort,'high');
  assert.deepEqual(body.tools,[{type:'web_search_preview'}]);
  assert.deepEqual(body.include,['web_search_call.action.sources']);
  assert.equal(body.store,false);
});

test('non-research cases do not grant web tools to the reference',()=>{
  const body=buildOpenAIRequest({mode:'analysis',prompt:'Calcula 19 x 37'});
  assert.equal(body.tools,undefined);
  assert.equal(body.include,undefined);
});

test('Universal Core gets the identical prompt and research capability only when required',()=>{
  const research=buildUniversalRequest({id:'research-01',mode:'research',prompt:'PROMPT EXACTO'});
  const general=buildUniversalRequest({id:'instruction-01',mode:'general',prompt:'PROMPT EXACTO'});
  assert.equal(research.message,'PROMPT EXACTO');
  assert.equal(research.task,'PROMPT EXACTO');
  assert.equal(research.web_enabled,true);
  assert.equal(general.message,'PROMPT EXACTO');
  assert.equal(general.web_enabled,false);
  assert.equal(research.provider,'auto');
});

test('extractors retain visible answers and deduplicate sources',()=>{
  assert.equal(extractUniversalAnswer({reply:' respuesta '}),'respuesta');
  assert.deepEqual(extractUniversalSources({sources:[{url:'https://a.example'}],web_sources:['https://a.example','https://b.example']}),['https://a.example','https://b.example']);
  const openAI={output:[
    {type:'web_search_call',action:{sources:[{url:'https://c.example'},{url:'https://d.example'}]}},
    {type:'message',content:[{type:'output_text',text:'GPT answer',annotations:[{type:'url_citation',url:'https://c.example'}]}]},
  ]};
  assert.equal(extractOpenAIText(openAI),'GPT answer');
  assert.deepEqual(extractOpenAISources(openAI),['https://c.example','https://d.example']);
});

test('Astra cost estimator uses the pinned pricing snapshot',()=>{
  assert.equal(estimateOpenAICostUsd({input_tokens:1000,output_tokens:200,input_tokens_details:{cached_tokens:0}},'gpt-6-astra'),.02);
  assert.equal(estimateOpenAICostUsd({input_tokens:1000,output_tokens:200,input_tokens_details:{cached_tokens:500}},'gpt-6-astra'),.0155);
});

test('run manifest forbids simulated references and global superiority claims',()=>{
  const manifest=benchmarkRunManifest({targetUrl:'https://example.test'});
  assert.equal(manifest.referenceId,'gpt-6-astra');
  assert.equal(manifest.policy.simulatedReferenceForbidden,true);
  assert.equal(manifest.policy.benchmarkScopedClaimsOnly,true);
  assert.equal(manifest.policy.sameImmutablePrompt,true);
});
