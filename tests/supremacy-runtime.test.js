import test from 'node:test';
import assert from 'node:assert/strict';
import { __resetSupremacyCacheForTests, semanticCacheEligible, semanticCacheLookup, semanticCacheStore, shouldRunChallenger, selectBestCandidate } from '../lib/supremacy-runtime.js';

test('semantic cache is user-scoped and finds close paraphrases',()=>{
  __resetSupremacyCacheForTests();
  semanticCacheStore({message:'Explica arquitectura SaaS multi tenant segura',userKey:'u1',mode:'analysis',provider:'auto',text:'Respuesta A',model:'m1',actualProvider:'p1',quality:{score:.82,pass:true},sources:[]});
  const hit=semanticCacheLookup({message:'Explica una arquitectura SaaS multi tenant segura',userKey:'u1',mode:'analysis',provider:'auto',threshold:.75});
  assert.equal(hit?.text,'Respuesta A');
  assert.ok(hit.similarity>=.75);
  const other=semanticCacheLookup({message:'Explica una arquitectura SaaS multi tenant segura',userKey:'u2',mode:'analysis',provider:'auto',threshold:.75});
  assert.equal(other,null);
});

test('semantic cache refuses sensitive and research requests',()=>{
  assert.equal(semanticCacheEligible({message:'Cuál es la dosis de este medicamento',mode:'general',provider:'auto'}),false);
  assert.equal(semanticCacheEligible({message:'Investiga noticias actuales de IA',mode:'research',provider:'auto'}),false);
  assert.equal(semanticCacheEligible({message:'Explica arquitectura hexagonal',mode:'analysis',provider:'auto'}),true);
});

test('challenger only activates for weak non-trivial answers',()=>{
  assert.equal(shouldRunChallenger({message:'Analiza esta arquitectura empresarial y prioriza riesgos principales para producción',mode:'analysis',quality:{score:.61,pass:false},degraded:false,requestedProvider:'auto'}),true);
  assert.equal(shouldRunChallenger({message:'Analiza esta arquitectura empresarial y prioriza riesgos principales para producción',mode:'analysis',quality:{score:.81,pass:true},degraded:false,requestedProvider:'auto'}),false);
});

test('reranker selects the highest quality candidate',()=>{
  const best=selectBestCandidate([
    {text:'A',quality:{score:.62},sources:[],degraded:false},
    {text:'B',quality:{score:.84},sources:[],degraded:false}
  ]);
  assert.equal(best.text,'B');
});
