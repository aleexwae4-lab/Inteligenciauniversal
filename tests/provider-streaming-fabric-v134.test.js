import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {streamOpenAI,streamAnthropic,streamGemini,streamOpenAICompatible,streamingContract,PROVIDER_STREAMING_VERSION} from '../lib/provider-streaming-v134.js';
import {providerCircuitOpen,providerCircuitFailure,providerCircuitSuccess,providerCircuitSnapshot} from '../lib/provider-breaker-v134.js';
import {runtimeHealth} from '../lib/runtime.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function sseResponse(blocks){
  const encoder=new TextEncoder();
  const stream=new ReadableStream({
    start(controller){
      for(const block of blocks)controller.enqueue(encoder.encode(block));
      controller.close();
    }
  });
  return new Response(stream,{status:200,headers:{'Content-Type':'text/event-stream'}});
}

test('v134 OpenAI Responses adapter accumulates verified deltas and reports TTFT without exposing text events',async()=>{
  const previous=globalThis.fetch,events=[];
  globalThis.fetch=async()=>sseResponse([
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hola"}\n\n',
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" mundo"}\n\n',
    'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_1","usage":{"output_tokens":2}}}\n\n'
  ]);
  try{
    const result=await streamOpenAI({url:'https://example.invalid',headers:{},model:'test-model',input:[],onProviderEvent:event=>events.push(event)});
    assert.equal(result.text,'Hola mundo');
    assert.equal(result.responseId,'resp_1');
    assert.equal(result.streaming.transport,'sse');
    assert.equal(result.streaming.chunks,2);
    assert.ok(Number.isFinite(result.streaming.ttftMs));
    assert.equal(events.length,1);
    assert.equal(events[0].type,'first_token');
    assert.equal('text' in events[0],false);
  }finally{globalThis.fetch=previous}
});

test('v134 Anthropic, Gemini and OpenAI-compatible adapters parse only public text deltas',async()=>{
  const previous=globalThis.fetch;
  try{
    globalThis.fetch=async()=>sseResponse([
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"A"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"B"}}\n\n'
    ]);
    assert.equal((await streamAnthropic({url:'https://example.invalid',headers:{},model:'m',system:'s',messages:[],maxTokens:10})).text,'AB');

    globalThis.fetch=async()=>sseResponse([
      'data: {"candidates":[{"content":{"parts":[{"text":"C"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"D"}]}}],"usageMetadata":{"totalTokenCount":2}}\n\n'
    ]);
    const gemini=await streamGemini({url:'https://example.invalid',headers:{},model:'m',body:{}});
    assert.equal(gemini.text,'CD');
    assert.equal(gemini.usage.totalTokenCount,2);

    globalThis.fetch=async()=>sseResponse([
      'data: {"id":"chat_1","choices":[{"delta":{"content":"E"}}]}\n\n',
      'data: {"id":"chat_1","choices":[{"delta":{"content":"F"}}],"usage":{"completion_tokens":2}}\n\n',
      'data: [DONE]\n\n'
    ]);
    const compatible=await streamOpenAICompatible({provider:'openrouter',url:'https://example.invalid',headers:{},model:'m',messages:[]});
    assert.equal(compatible.text,'EF');
    assert.equal(compatible.responseId,'chat_1');
  }finally{globalThis.fetch=previous}
});

test('v134 circuit breaker opens after repeated transport failures and resets on success',()=>{
  const id='v134-test-provider-'+Date.now();
  assert.equal(providerCircuitOpen(id),false);
  providerCircuitFailure(id,'timeout');
  providerCircuitFailure(id,'timeout');
  assert.equal(providerCircuitOpen(id),false);
  providerCircuitFailure(id,'timeout');
  assert.equal(providerCircuitOpen(id),true);
  const row=providerCircuitSnapshot([{id,configured:true,model:'m',streaming:true}])[0];
  assert.equal(row.circuit,'open');
  assert.equal(row.failureCount,3);
  providerCircuitSuccess(id);
  assert.equal(providerCircuitOpen(id),false);
});

test('v134 registry marks only verified direct providers as stream-capable and health publishes the fabric',()=>{
  const providers=runtimeHealth().providers;
  for(const id of ['openai','anthropic','gemini','xai','openrouter'])assert.equal(providers.find(p=>p.id===id)?.streaming,true,id);
  for(const id of ['wae_edge','wae_supabase'])assert.equal(providers.find(p=>p.id===id)?.streaming,false,id);
  const contract=runtimeHealth().providerStreaming;
  assert.equal(contract.version,PROVIDER_STREAMING_VERSION);
  assert.equal(contract.transport,'sse');
  assert.equal(contract.contentRelease,'withheld-until-quality-gate');
  assert.equal(Array.isArray(runtimeHealth().providerOperations),true);
});

test('v134 stream gateway forwards sanitized provider telemetry but never provider text deltas',()=>{
  const api=read('api/chat-stream.js');
  assert.match(api,/onProviderEvent:event=>/);
  assert.match(api,/safeProviderEvent/);
  assert.match(api,/sse\(res,'provider',safe\)/);
  assert.doesNotMatch(api,/out\.text\s*=/);
  assert.doesNotMatch(api,/body\.message[^\n]*sse\(res,'provider'/);
});

test('v134 browser renders TTFT and automatic provider recovery without rendering partial model text',()=>{
  const app=read('app.js');
  assert.match(app,/wae:provider-progress/);
  assert.match(app,/Primer token recibido/);
  assert.match(app,/Proveedor aislado · buscando alternativa/);
  assert.match(app,/Respuesta rechazada por calidad · reintentando/);
  assert.match(app,/parsed\.event==='provider'/);
  assert.doesNotMatch(app,/parsed\.event==='token'/);
});

test('v134 PWA publishes the same provider-streaming app asset',()=>{
  const html=read('index.html'),sw=read('sw.js');
  const appAsset=html.match(/\.\/app\.js\?[^"'<>\s]+/)?.[0];
  assert.ok(appAsset);
  assert.match(appAsset,/providerstream=v134/);
  assert.ok(sw.includes(appAsset));
  assert.match(sw,/provider-stream-v134/);
});

test('v134 provider router contains stream-first selection plus quality gate and breaker after accumulation',()=>{
  const providers=read('lib/providers.js');
  assert.match(providers,/p\.streaming&&streamCallers\[p\.id\]/);
  assert.match(providers,/qualityFailure = degradedAnswer\(result\?\.text\)/);
  assert.match(providers,/providerCircuitSuccess\(p\.id\)/);
  assert.match(providers,/providerCircuitFailure\(p\.id,code\)/);
  assert.match(read('lib/provider-streaming-v134.js'),/type:'first_token'/);
});
