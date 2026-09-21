import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inferCognitivePolicy, evaluateAnswer, routingPrefix } from '../lib/quality.js';
import { nativeBrainReply, nativeBrainStatus, NATIVE_BRAIN_VERSION } from '../lib/native-brain-v5.js';

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
  assert.equal(q.requirementCoverage.pass,true);
});

test('la estructura no rescata una respuesta irrelevante',()=>{
  const q=evaluateAnswer({
    question:'Explica en cinco puntos una arquitectura SaaS multi-tenant segura',
    answer:'1. Compra fruta fresca.\n2. Lava los utensilios.\n3. Prepara la mesa.\n4. Sirve la comida.\n5. Guarda las sobras correctamente.',
    mode:'analysis'
  });
  assert.equal(q.pass,false);
  assert.ok(q.reasons.includes('low_relevance'));
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
  assert.ok(q.reasons.includes('missing_requirement:sources'));
  assert.equal(q.pass,false);
});

test('respuesta elegante pero sin tabla solicitada no puede aprobar',()=>{
  const q=evaluateAnswer({
    question:'Compara PostgreSQL y SQLite en una tabla para una app SaaS.',
    answer:'PostgreSQL ofrece concurrencia robusta, extensiones y mejor escalabilidad para SaaS. SQLite es simple, embebido y excelente para desarrollo local o cargas pequeñas. PostgreSQL suele ser la mejor opción cuando crece la concurrencia.',
    mode:'analysis'
  });
  assert.equal(q.requirementCoverage.hardFailure,true);
  assert.ok(q.reasons.includes('missing_requirement:table'));
  assert.equal(q.pass,false);
  assert.ok(q.score<0.68);
});

test('misma comparación puede aprobar cuando cumple la tabla verificable',()=>{
  const q=evaluateAnswer({
    question:'Compara PostgreSQL y SQLite en una tabla para una app SaaS.',
    answer:'| Motor | Concurrencia | Escala SaaS | Uso recomendado |\n|---|---|---|---|\n| PostgreSQL | Alta | Alta | Producción multiusuario |\n| SQLite | Baja a media | Limitada | Desarrollo local y cargas pequeñas |\n\nPostgreSQL prioriza concurrencia y escalabilidad; SQLite prioriza simplicidad y portabilidad.',
    mode:'analysis'
  });
  assert.equal(q.requirementCoverage.pass,true);
  assert.ok(q.signals.requirements>=1);
  assert.equal(q.pass,true);
});

test('native brain v5 activa consejo de calidad, memoria contextual y autorreparación',()=>{
  const status=nativeBrainStatus();
  assert.equal(status.version,NATIVE_BRAIN_VERSION);
  assert.equal(status.qualityCouncil,true);
  assert.equal(status.selfRepair,true);
  assert.equal(status.memoryAwareRouting,true);
  assert.equal(status.contextDependentFollowups,true);
  for(const lane of ['quality-council','memory-context','quality-self-repair','verified-rescue'])assert.equal(status.lanes.includes(lane),true);
});

test('native brain v5 elimina la selección first-value y conserva kernel determinista',async()=>{
  const source=readFileSync(new URL('../lib/native-brain-v5.js',import.meta.url),'utf8');
  assert.match(source,/Promise\.allSettled\(candidates\)/);
  assert.match(source,/repairInstruction\(originalQuality\)/);
  assert.doesNotMatch(source,/Promise\.any\(\[knowledge,reference,generation\]\)/);
  const result=await nativeBrainReply({message:'12 * 7',mode:'general',userKey:'quality-test'});
  assert.equal(result.native_path,'local-kernel-first');
  assert.equal(result.native_brain,NATIVE_BRAIN_VERSION);
  assert.match(result.reply,/84/);
});

test('la interfaz visible usa native brain v5 de servidor antes del cerebro local',()=>{
  const canonical=readFileSync(new URL('../canonical-brain-v106.js',import.meta.url),'utf8');
  const interfaceBrain=readFileSync(new URL('../mobile-brain-v110.js',import.meta.url),'utf8');
  assert.match(canonical,/canonical-brain\/v112-server-first/);
  assert.match(canonical,/xhrJson\('\/api\/native-brain\/chat'/);
  assert.match(canonical,/serverFirst:true/);
  assert.match(canonical,/localPrimary:false/);
  assert.match(interfaceBrain,/interface-brain\/v112-server-first/);
  assert.match(interfaceBrain,/xhr\.open\('POST','\/api\/native-brain\/chat'/);
  assert.match(interfaceBrain,/contextExplicit:true/);
  assert.match(interfaceBrain,/localPrimary:false/);
});

test('la interfaz envía continuidad explícita y no duplica el turno actual en history',()=>{
  const canonical=readFileSync(new URL('../canonical-brain-v106.js',import.meta.url),'utf8');
  const interfaceBrain=readFileSync(new URL('../mobile-brain-v110.js',import.meta.url),'utf8');
  for(const source of [canonical,interfaceBrain]){
    assert.match(source,/conversation_id:conversationId/);
    assert.match(source,/sessionId/);
    assert.match(source,/history:/);
    assert.match(source,/(?:items|list)\.at\(-1\).*role==='user'/s);
  }
});

test('v117 rejects an unrelated definition even when the answer is lengthy',()=>{
  const result=evaluateAnswer({
    question:'¿Qué es la neuroplasticidad?',
    answer:'La maladaptación se refiere a cambios poco útiles para el organismo. Puede describir cambios en conducta o respuestas que dificultan el bienestar. Este párrafo explica algo distinto de lo que se preguntó y no debería pasar por su longitud.',
    mode:'general'
  });
  assert.equal(result.pass,false);
  assert.equal(result.critical,true);
  assert.ok(result.reasons.includes('definition_topic_missing'));
});

test('v117 rejects generic clarification as a substitute for a clear definition',()=>{
  const result=evaluateAnswer({
    question:'¿Qué es la neuroplasticidad?',
    answer:'Necesito más contexto sobre neuroplasticidad para responderte. ¿Podrías especificar qué aspecto deseas conocer?',
    mode:'general'
  });
  assert.equal(result.pass,false);
  assert.ok(result.reasons.includes('definition_deflected'));
});

test('v117 permits a definition that addresses the requested concept',()=>{
  const result=evaluateAnswer({
    question:'¿Qué es la neuroplasticidad?',
    answer:'La neuroplasticidad es la capacidad del sistema nervioso para reorganizar conexiones y modificar su funcionamiento a partir de la experiencia, el aprendizaje o una lesión. No implica que cualquier cambio sea necesariamente beneficioso.',
    mode:'general'
  });
  assert.equal(result.reasons.includes('definition_topic_missing'),false);
  assert.equal(result.reasons.includes('definition_deflected'),false);
});
