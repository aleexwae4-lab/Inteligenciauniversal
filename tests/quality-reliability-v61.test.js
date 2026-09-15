import test from 'node:test';
import assert from 'node:assert/strict';
import {auditQualityReliability,applyQualityReliability,qualityReliabilityCapabilities} from '../lib/quality-reliability-v61.js';

test('v61 gives high score to relevant evidence-backed answers',()=>{
  const payload={reply:'La latencia P95 bajó 40 por ciento [W1].',web_sources:[{key:'W1',url:'https://example.com'}]};
  const out=applyQualityReliability(payload,{prompt:'¿Cuánto bajó la latencia P95?'});
  assert.equal(out.answer_intelligence.gate,'PASS');
  assert.equal(out.quality_reliability.score>=80,true);
  assert.equal(out.quality_reliability.critical_failure,false);
});

test('v61 fails closed on unsupported live factual claims',()=>{
  const payload={reply:'El precio actual es 99 pesos.',live_data:{used:true},response:{metadata:{liveDataMesh:'live-data-mesh/v58'}}};
  const out=applyQualityReliability(payload,{prompt:'¿Cuál es el precio actual?'});
  assert.equal(out.quality_reliability.critical_failure,true);
  assert.equal(out.quality_reliability.grade,'HOLD');
  assert.match(out.reply,/No puedo certificar/i);
});

test('v61 HOLD neutralizes stale voice components and actions',()=>{
  const payload={reply:'El precio actual es 99 pesos.',speech_text:'El precio actual es 99 pesos.',components:[{type:'metric',value:99}],actions:[{type:'buy'}],live_data:{used:true},response:{speechText:'El precio actual es 99 pesos.',components:[{type:'metric'}],actions:[{type:'buy'}],metadata:{liveDataMesh:'live-data-mesh/v58'}}};
  const out=applyQualityReliability(payload,{prompt:'¿Cuál es el precio actual?'});
  assert.equal(out.quality_reliability.critical_failure,true);
  assert.equal(out.speech_text,out.reply);
  assert.deepEqual(out.components,[]);
  assert.deepEqual(out.actions,[]);
  assert.equal(out.response.speechText,out.reply);
  assert.deepEqual(out.response.components,[]);
  assert.deepEqual(out.response.actions,[]);
});

test('v61 catches hard JSON instruction violations',()=>{
  const payload={reply:'El resultado es 42.'};
  const out=applyQualityReliability(payload,{prompt:'Devuelve SOLO JSON válido con {"result":number}.'});
  assert.equal(out.quality_reliability.critical_failure,true);
  assert.equal(out.quality_reliability.blockers.includes('invalid_json'),true);
});

test('v61 catches exact bullet counts and word limits',()=>{
  const audit=auditQualityReliability({reply:'- Uno\n- Dos\n- Tres'},{prompt:'Responde con exactamente 2 viñetas. Máximo 4 palabras.'});
  assert.equal(audit.critical_failure,true);
  assert.equal(audit.blockers.some(x=>x.startsWith('bullet_count_')),true);
});

test('v61 never advertises universal superiority without benchmark proof',()=>{
  const caps=qualityReliabilityCapabilities();
  assert.equal(caps.version,'quality-reliability/v61');
  assert.equal(caps.competitorClaimRequiresBenchmark,true);
  assert.equal(caps.universalSuperiorityClaim,false);
  assert.equal(caps.baseModelTraining,false);
});
