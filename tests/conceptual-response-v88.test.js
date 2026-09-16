import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFactualFocus, deterministicFocusedReply } from '../lib/knowledge/focused-factual-v83.js';
import { explicitResearchIntent, knowledgeUsable } from '../api/capacity-chat-v83.js';
import { deterministicKnowledgeFallback } from '../lib/knowledge/knowledge-answer-v1.js';

function encyclopedicRecord({title='Biosfera',abstract,score=.9,url='https://es.wikipedia.org/wiki/Biosfera'}={}){
  return {
    title,
    abstract,
    focused_score:score,
    source:{id:'wikipedia',canonical_url:url,retrieved_at:'2026-09-16T00:00:00Z'},
    quality:{scientific:{integrity:{usable_for_supporting_claims:true}}}
  };
}

test('v88 extracts the exact concepts seen in the mobile recordings',()=>{
  assert.equal(extractFactualFocus('¿Qué es la biosfera?').normalized,'biosfera');
  assert.equal(extractFactualFocus('¿Qué es la atmósfera?').normalized,'atmosfera');
  const metaphysics=extractFactualFocus('¿Qué es universo en la metafísica?');
  assert.ok(metaphysics.coreTokens.includes('universo'));
  assert.ok(metaphysics.coreTokens.includes('metafisica'));
});

test('v88 focused fallback is coherent, single-source and never exposes internal K markers',()=>{
  const focus=extractFactualFocus('¿Qué es la biosfera?');
  const fallback=deterministicFocusedReply([
    encyclopedicRecord({abstract:'La biosfera es el sistema formado por el conjunto de los seres vivos de la Tierra y sus interrelaciones. Se extiende por las zonas del planeta donde existe vida.'}),
    encyclopedicRecord({title:'Otro registro',abstract:'Texto secundario que no debe mezclarse con la definición principal.',score:.7,url:'https://example.test/otro'})
  ],focus);
  assert.equal(fallback.strong,true);
  assert.match(fallback.reply,/biosfera es el sistema/i);
  assert.doesNotMatch(fallback.reply,/\[K\d+\]/);
  assert.doesNotMatch(fallback.reply,/Otro registro/i);
  assert.equal(fallback.cited.length,1);
});

test('v88 normal chat rejects the bibliographic diagnostic fallback from the second recording',()=>{
  const payload={
    success:true,
    reply:'Recuperé evidencia verificable, pero la capa generativa no completó una síntesis suficientemente sustentada. Universal (metafísica) — unclassified [K2]',
    citation_gate_fallback:true,
    quality:{critical:false}
  };
  const body={message:'¿Qué es universo en la metafísica?',mode:'general'};
  assert.equal(explicitResearchIntent(body),false);
  assert.equal(knowledgeUsable(payload,body),false);
});

test('v88 preserves evidence fallback only for explicit research requests',()=>{
  const record=encyclopedicRecord({title:'Estudio de ejemplo',abstract:'Resumen de evidencia.',score:.8,url:'https://example.test/study'});
  const reply=deterministicKnowledgeFallback({records:[record]});
  const payload={success:true,reply,citation_gate_fallback:true,quality:{critical:false}};
  const body={message:'Investiga estudios y dame fuentes sobre este tema',mode:'research'};
  assert.equal(explicitResearchIntent(body),true);
  assert.equal(knowledgeUsable(payload,body),true);
});

test('forbidden diagnostic tokens stay out of ordinary coherent fallback',()=>{
  const focus=extractFactualFocus('¿Qué es la atmósfera?');
  const fallback=deterministicFocusedReply([
    encyclopedicRecord({title:'Atmósfera terrestre',url:'https://es.wikipedia.org/wiki/Atm%C3%B3sfera_terrestre',abstract:'La atmósfera terrestre es la capa de gases que rodea la Tierra. Permite procesos esenciales como el clima y protege parcialmente la superficie de radiación y meteoroides.'})
  ],focus);
  for(const forbidden of [/\[K\d+\]/i,/\bunclassified\b/i,/capa generativa no completó/i,/registros utilizables/i]){
    assert.doesNotMatch(fallback.reply,forbidden);
  }
}