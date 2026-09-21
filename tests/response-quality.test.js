import test from 'node:test';
import assert from 'node:assert/strict';
import { needsWebResearch, appendSourceLinks, QUALITY_GUIDANCE } from '../lib/response-quality.js';
import { readFileSync } from 'node:fs';

test('freshness detection preserves normal chat and honors explicit no-web requests', () => {
  assert.equal(needsWebResearch('Explícame recursión'), false);
  assert.equal(needsWebResearch('¿Qué noticias hay hoy?'), true);
  assert.equal(needsWebResearch('Verifica las fuentes actuales'), true);
  assert.equal(needsWebResearch('Investiga un tema', 'research'), true);
  assert.equal(needsWebResearch('No uses la web, explica lo que sabes'), false);
});

test('quality rubric distinguishes generated claims and actual retrieval evidence', () => {
  assert.match(QUALITY_GUIDANCE, /URLs presentes en la evidencia recuperada/);
  assert.match(QUALITY_GUIDANCE, /No declares pruebas o despliegues no ejecutados/);
});

test('source appendix deduplicates links and rejects non-web schemes', () => {
  const reply = appendSourceLinks('Resultado', [
    { title:'Ejemplo',url:'https://example.org/doc' },
    { title:'Duplicado',url:'https://example.org/doc' },
    { title:'Peligro',url:'javascript:alert(1)' },
    { title:'Otra fuente',url:'https://example.net' }
  ]);
  assert.match(reply, /Fuentes recuperadas/);
  assert.equal((reply.match(/example.org\/doc/g)||[]).length,1);
  assert.match(reply,/example.net/);
  assert.doesNotMatch(reply,/javascript:/);
  assert.equal(appendSourceLinks('Texto',[]),'Texto');
});

test('primary and fallback routes both keep evidence without disturbing existing UI', () => {
  const client = readFileSync(new URL('../runtime-client.js', import.meta.url),'utf8');
  const backend = readFileSync(new URL('../lib/runtime.js', import.meta.url),'utf8');
  const providers = readFileSync(new URL('../lib/providers.js', import.meta.url),'utf8');
  assert.match(client,/web_enabled:useWeb/);
  assert.match(client,/withRetrievedSources\(data.reply,data.web_sources\)/);
  assert.match(backend,/appendSourceLinks\(generated.text, generated.sources\)/);
  assert.match(providers,/web_enabled:webEnabled/);
});
