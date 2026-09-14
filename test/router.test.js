import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTask,capabilityRequirements,rankModels,effectiveCircuit,estimateCostMicrounits,promotionGate} from '../lib/adaptive-router.js';

const base={provider:'x',model_name:'m',access_tier:'FREE',effective_health:'healthy',circuit_state:'CLOSED',streaming_capable:true,context_window:32768,quality_score:85,reliability_score:90,ewma_latency_ms:3000,ewma_ttft_ms:600,cost_profile:{input_per_million:0,output_per_million:0}};

test('simple chat uses FAST path',()=>assert.equal(classifyTask({message:'Hola'}).path,'FAST'));
test('research uses DEEP path',()=>assert.equal(classifyTask({message:'Investiga el estado del arte y contrasta fuentes'}).category,'research'));
test('explicit web research is classified separately',()=>assert.equal(classifyTask({message:'Busca en la web fuentes actualizadas'}).category,'web_research'));
test('tool execution is classified without a heavy model',()=>assert.equal(classifyTask({message:'Exporta este resultado a PDF'}).category,'tool_execution'));
test('multimodal intent is classified',()=>assert.equal(classifyTask({message:'Analiza esta imagen y la captura'}).category,'multimodal'));
test('document attachment requests RAG preparation',()=>{const task=classifyTask({message:'Resume el documento',attachments:[{name:'x.pdf'}]});const req=capabilityRequirements(task,{attachments:[{name:'x.pdf'}]});assert.equal(task.category,'document_analysis');assert.equal(req.files,true);assert.equal(req.rag,true)});
test('offline provider is excluded before inference',()=>{const task=classifyTask({message:'Hola'}),req=capabilityRequirements(task);const ranked=rankModels([{...base,provider:'offline',effective_health:'offline',circuit_state:'OPEN'},{...base,provider:'healthy'}],task,req);assert.equal(ranked[0].provider,'healthy');assert.ok(!ranked.some(x=>x.provider==='offline'))});
test('healthy low latency beats degraded model on FAST path',()=>{const task=classifyTask({message:'Hola'}),req=capabilityRequirements(task);const ranked=rankModels([{...base,provider:'fast',ewma_latency_ms:1200,ewma_ttft_ms:250},{...base,provider:'degraded',effective_health:'degraded',ewma_latency_ms:700,ewma_ttft_ms:180,quality_score:88}],task,req);assert.equal(ranked[0].provider,'fast')});
test('open circuit is excluded',()=>assert.equal(effectiveCircuit({...base,circuit_state:'OPEN'}),'OPEN'));
test('cost engine uses configured pricing',()=>assert.equal(estimateCostMicrounits({access_tier:'PAID',cost_profile:{input_per_million:1,output_per_million:2}},1000,500),2000));
test('cost engine records grounded FREE tier as zero',()=>assert.equal(estimateCostMicrounits({access_tier:'FREE',cost_profile:{}},1000,500),0));
test('promotion gate blocks critical regressions',()=>{const r=promotionGate({quality:90,error_rate:.01,p95_latency:10000,p95_ttft:3000},{quality:89,error_rate:.02,p95_latency:8000,p95_ttft:2000,security_regressions:0});assert.equal(r.pass,false);assert.ok(r.reasons.includes('error_rate_regression'))});
