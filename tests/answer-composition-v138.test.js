import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ANSWER_COMPOSITION_VERSION,ANSWER_COMPOSITION_GUIDANCE,
  normalizeAnswerComposition,compositionIssue,compositionQuality,answerCompositionContract
} from '../lib/answer-composition-v138.js';
import {runtimeHealth,executeMission} from '../lib/runtime.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v138 normalizes presentation markup and repeated ordered steps before persistence',()=>{
  const input=[
    '1. Primer paso<br>Detalle directo.',
    '- Evidencia A',
    '',
    '1. Segundo paso',
    '- Evidencia B',
    '',
    '1. Tercer paso'
  ].join('\n');
  const out=normalizeAnswerComposition(input);
  assert.doesNotMatch(out,/<br/i);
  assert.match(out,/1\. Primer paso\nDetalle directo\./);
  assert.match(out,/2\. Segundo paso/);
  assert.match(out,/3\. Tercer paso/);
});

test('v138 preserves fenced code byte-for-byte while normalizing surrounding prose',()=>{
  const code='```html\n<div><br></div>\n1. do-not-renumber\n```';
  const input='1. Explica<br>primero.\n\n'+code+'\n\n1. Continúa.';
  const out=normalizeAnswerComposition(input);
  assert.ok(out.includes(code));
  assert.match(out,/1\. Explica\nprimero\./);
  assert.match(out,/1\. Continúa\./,'a new prose section after a code block may start its own list');
});

test('v138 rejects structurally broken fences and malformed markdown tables',()=>{
  assert.equal(compositionIssue('```js\nconst a=1;'),'composition_unclosed_fence');
  assert.equal(
    compositionIssue('| A | B |\n|---|---|\n| uno | dos | tres |'),
    'composition_table_columns'
  );
  assert.equal(compositionIssue('| A | B |\n|---|---|\n| uno | dos |'),'');
});

test('v138 composition metadata reports actual repairs rather than hiding them',()=>{
  const raw='1. Uno<br>Detalle\n- x\n1. Dos';
  const quality=compositionQuality(raw);
  assert.equal(quality.version,ANSWER_COMPOSITION_VERSION);
  assert.equal(quality.valid,true);
  assert.equal(quality.normalized,true);
  assert.equal(quality.orderedItems,2);
  assert.ok(quality.characters>10);
});

test('v138 runtime health advertises a pre-persistence composition contract',()=>{
  const health=runtimeHealth();
  assert.deepEqual(health.answerComposition,answerCompositionContract());
  assert.equal(health.answerComposition.runsBeforePersistence,true);
  assert.equal(health.answerComposition.preservesCodeFences,true);
  assert.match(ANSWER_COMPOSITION_GUIDANCE,/No emitas etiquetas HTML de presentación/);
});

test('v138 deterministic response envelope includes composition quality metadata',async()=>{
  const result=await executeMission({message:'Quién eres?',history:[]});
  assert.equal(result.composition.version,ANSWER_COMPOSITION_VERSION);
  assert.equal(result.response.metadata.compositionVersion,ANSWER_COMPOSITION_VERSION);
  assert.equal(result.response.metadata.compositionValid,true);
  assert.equal(typeof result.response.metadata.compositionNormalized,'boolean');
});

test('v138 generated runtime applies composition issue gate then normalizes before save',()=>{
  const runtime=read('lib/runtime.js');
  const providerGate=runtime.indexOf('compositionIssue(normalizeAnswerComposition(answer))');
  const rawReply=runtime.indexOf('const rawReply = removeRedundantParagraphs');
  const normalized=runtime.indexOf('const reply = normalizeAnswerComposition(rawReply)');
  const persistence=runtime.indexOf("trace.begin('persistence')");
  assert.ok(providerGate>0);
  assert.ok(rawReply>providerGate);
  assert.ok(normalized>rawReply);
  assert.ok(persistence>normalized);
  assert.match(runtime,/ANSWER_COMPOSITION_GUIDANCE/);
  assert.match(runtime,/composition=compositionQuality\(rawReply\)/);
});

test('v138 response envelope exports composition diagnostics without response content leakage',()=>{
  const envelope=read('lib/response-envelope-v131.js');
  assert.match(envelope,/compositionVersion/);
  assert.match(envelope,/compositionValid/);
  assert.match(envelope,/compositionNormalized/);
  assert.doesNotMatch(envelope,/compositionPrompt|compositionReasoning/);
});

test('v138 PWA publishes the exact mobile composition stylesheet',()=>{
  const html=read('index.html'),sw=read('sw.js');
  const asset=html.match(/\.\/wae-mobile-tables-v9\.css\?[^"'<>\s]+/)?.[0];
  assert.ok(asset);
  assert.match(asset,/composition=v138/);
  assert.ok(sw.includes(asset));
  assert.match(sw,/composition-v138/);
});
