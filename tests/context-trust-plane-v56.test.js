import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contextFrame, serializeContextFrame, buildTrustedContextHistory } from '../lib/context-trust-plane-v56.js';
import { isSafeAssistantOutput } from '../lib/context-output-firewall-v55.js';

const libraryAnswer=await readFile(new URL('../lib/library-answer-v52.js',import.meta.url),'utf8');

test('context plane creates typed non-user evidence frames',()=>{
  const frame=contextFrame({type:'library_evidence',trust:'verified_bibliographic_metadata',disclosure:'cite_metadata',source:'library-intelligence/v52',content:'[L1] The Art of War — Sun Tzu'});
  assert.equal(frame.type,'library_evidence');
  assert.equal(frame.disclosure,'cite_metadata');
  assert.match(serializeContextFrame(frame),/WAE_CONTEXT_V56/);
});

test('library evidence is transported through internal history, not concatenated into the user question',()=>{
  assert.match(libraryAnswer,/buildTrustedContextHistory/);
  assert.doesNotMatch(libraryAnswer,/message:`\$\{message\}\$\{library\.context\}`/);
  assert.match(libraryAnswer,/message,\s*\n\s*history/);
  assert.match(libraryAnswer,/type:'library_evidence'/);
});

test('typed context history preserves original user message and isolates evidence in a separate frame',()=>{
  const history=buildTrustedContextHistory([{role:'user',content:'¿Quién escribió El arte de la guerra?'}],[{type:'library_evidence',trust:'verified_bibliographic_metadata',disclosure:'cite_metadata',content:'[L1] The Art of War — Sun Tzu'}]);
  assert.equal(history[0].content,'¿Quién escribió El arte de la guerra?');
  assert.match(history.at(-1).content,/WAE_CONTEXT_V56/);
  assert.doesNotMatch(history[0].content,/WAE_CONTEXT_V56/);
});

test('output firewall blocks typed context envelope if a model tries to echo it',()=>{
  assert.equal(isSafeAssistantOutput('[WAE_CONTEXT_V56 type=library_evidence] internal [/WAE_CONTEXT_V56]'),false);
  assert.equal(isSafeAssistantOutput('Sun Tzu es tradicionalmente atribuido como autor de El arte de la guerra.'),true);
});
