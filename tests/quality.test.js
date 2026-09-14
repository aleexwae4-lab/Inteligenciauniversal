import test from 'node:test';
import assert from 'node:assert/strict';
import { inferCognitivePolicy, evaluateAnswer, routingPrefix } from '../lib/quality.js';

test('detecta investigación actual automáticamente',()=>{
  const p=inferCognitivePolicy('¿Cuál es la reforma fiscal más reciente en México?','general');
  assert.equal(p.mode,'research');
  assert.equal(p.autoResearch,true);
  assert.match(routingPrefix(p),/evidencia web reciente/i);
});

test('detecta ingeniería de software',()=>{
  const p=inferCognitivePolicy('Corrige este bug de TypeScript en mi API','general');
  assert.equal(p.mode,'code');
  assert.equal(p.autoResearch,false);
});

test('bloquea respuestas de fallo genéricas',()=>{
  const q=evaluateAnswer({question:'¿Quién eres?',answer:'No pude completar esta respuesta en este intento. Puedes volver a intentarlo.'});
  assert.equal(q.critical,true);
  assert.ok(q.score<0.1);
  assert.ok(q.reasons.includes('failure_phrase'));
});

test('premia una respuesta estructurada solicitada',()=>{
  const q=evaluateAnswer({
    question:'Explica en cinco puntos una arquitectura SaaS multi-tenant segura',
    answer:'1. Aísla cada tenant con tenant_id y políticas RLS.\n2. Aplica RBAC y sesiones seguras.\n3. Registra auditoría inmutable.\n4. Escala servicios y datos por particiones.\n5. Mantén backups cifrados, pruebas de restauración y objetivos RPO/RTO.',
    mode:'analysis'
  });
  assert.equal(q.pass,true);
  assert.ok(q.signals.structure>=1);
});

test('investigación sin evidencia queda por debajo del estándar premium',()=>{
  const q=evaluateAnswer({
    question:'Investiga las noticias actuales del mercado de IA',
    answer:'El mercado de IA está creciendo rápidamente y existen muchas empresas compitiendo.',
    mode:'research',
    sources:[]
  });
  assert.ok(q.signals.evidence<0.65);
  assert.ok(q.reasons.includes('insufficient_evidence'));
});
