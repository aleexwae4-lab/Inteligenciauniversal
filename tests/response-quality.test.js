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

test('ordinary Four Agreements answer never gets unrelated references appended', () => {
  const answer='Los cuatro acuerdos son: sé impecable con tus palabras, no tomes nada personalmente...';
  const unrelated=[
    {title:'CDC dog import requirements',url:'https://www.cdc.gov/dogs/'},
    {title:'OpenAI sign in and SSO configuration',url:'https://help.openai.com/en/articles/sso'},
    {title:'Google account security',url:'https://developers.google.com/account'}
  ];
  assert.equal(appendSourceLinks(answer,unrelated,'¿Conoces el libro de los 4 acuerdos?'),answer);
  assert.equal(appendSourceLinks(answer,unrelated,'¿Conoces el libro de los 4 acuerdos? Dame fuentes.'),answer);
  assert.equal(appendSourceLinks(answer,[{title:'Los cuatro acuerdos',url:'https://example.org/cuatro-acuerdos'}],'¿Conoces el libro de los 4 acuerdos?'),answer);
});

test('explicit sources require topical agreement and safe unique URLs', () => {
 const answer='Los cuatro acuerdos fueron escritos por Miguel Ruiz.';
 const reply=appendSourceLinks(answer,[
  {title:'Requisitos CDC para importar perros',url:'https://www.cdc.gov/importation'},
  {title:'Los cuatro acuerdos — edición original',url:'https://example.org/libro/cuatro-acuerdos'},
  {title:'Los cuatro acuerdos — duplicado',url:'https://example.org/libro/cuatro-acuerdos'},
  {title:'Los cuatro acuerdos — inseguro',url:'javascript:alert(1)'},
  {title:'OpenAI SSO',url:'https://help.openai.com/en/articles/sso'}
 ],'¿Conoces el libro de los 4 acuerdos? Dame fuentes.');
 assert.match(reply,/Fuentes relacionadas/);
 assert.equal((reply.match(/example\.org\/libro\/cuatro-acuerdos/g)||[]).length,1);
 assert.doesNotMatch(reply,/cdc\.gov|help\.openai\.com|javascript:/);
 assert.equal(appendSourceLinks('Texto',[],'Fuentes sobre diabetes'),'Texto');
});

test('primary and fallback routes both keep evidence without disturbing existing UI', () => {
  const client = readFileSync(new URL('../runtime-client.js', import.meta.url),'utf8');
  const backend = readFileSync(new URL('../lib/runtime.js', import.meta.url),'utf8');
  const providers = readFileSync(new URL('../lib/providers.js', import.meta.url),'utf8');
  assert.match(client,/web_enabled:useWeb/);
  assert.match(client,/withRetrievedSources\(data.reply,data.web_sources,incoming.message\)/);
  assert.match(backend,/const realSources=\[\.\.\.\(generated.sources\|\|\[\]\),\.\.\.gatheredSources\]/);
  assert.match(backend,/appendSourceLinks\(generated.text, realSources, message\)/);
  assert.match(providers,/web_enabled:webEnabled/);
});


test('provider fallback rejects the exact degraded non-answer observed in production', () => {
  const providers = readFileSync(new URL('../lib/providers.js', import.meta.url),'utf8');
  assert.match(providers,/la ruta generativa avanzada no esta disponible/);
  assert.match(providers,/no existe evidencia publica suficiente para responder sin inventar/);
  assert.match(providers,/degraded_runtime_placeholder/);
  const gate=providers.indexOf('const qualityFailure = degradedAnswer');
  const success=providers.indexOf('return { ...result, provider:result.provider');
  assert.ok(gate>0 && success>gate,'quality gate must execute before provider success');
});

test('quality gate does not turn lack of public evidence into a universal chat requirement', () => {
  const runtime = readFileSync(new URL('../lib/runtime.js', import.meta.url),'utf8');
  assert.match(runtime,/needsWebResearch\(message, mode\)/);
  assert.doesNotMatch(runtime,/no existe evidencia pública suficiente/i);
});
