import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUserIntent, formatIntentInterpretation } from '../lib/input-intelligence.js';

test('repairs clip transcription from electrical context',()=>{
  const intent=normalizeUserIntent('Dime qué es un iodo, un what, una resistencia, voltaje, generador, aislante y frecuencia');
  assert.equal(intent.changed,true);
  assert.equal(intent.domain,'electricity');
  assert.match(intent.text,/\bdiodo\b/i);
  assert.match(intent.text,/\bwatt\b/i);
  assert.doesNotMatch(intent.text,/\bwhat\b/i);
  assert.ok(intent.confidence>=.85);
});

test('does not rewrite iodine in chemistry context',()=>{
  const intent=normalizeUserIntent('Qué es el yodo como elemento químico y cuál es su número atómico');
  assert.equal(intent.changed,false);
  assert.equal(intent.text,intent.original);
});

test('does not rewrite ordinary English what with weak electrical evidence',()=>{
  const intent=normalizeUserIntent('What is voltage?');
  assert.equal(intent.changed,false);
  assert.equal(intent.text,'What is voltage?');
});

test('does not rewrite ordinary English what even with multiple electrical terms',()=>{
  const intent=normalizeUserIntent('What is voltage and resistance in an electric circuit?');
  assert.equal(intent.changed,false);
  assert.equal(intent.text,intent.original);
});

test('repairs Spanish article plus what as watt inside strong electrical context',()=>{
  const intent=normalizeUserIntent('Dime qué es un what, voltaje, resistencia y corriente en un circuito');
  assert.equal(intent.changed,true);
  assert.match(intent.text,/un watt/i);
  assert.doesNotMatch(intent.text,/un what/i);
});

test('repairs ohm transcription only inside strong electrical context',()=>{
  const intent=normalizeUserIntent('Explícame voltaje, resistencia y omios en un circuito');
  assert.equal(intent.changed,true);
  assert.match(intent.text,/ohmios/i);
});

test('produces a compact non-secret interpretation hint',()=>{
  const intent=normalizeUserIntent('un iodo, un what, resistencia, voltaje y generador');
  const hint=formatIntentInterpretation(intent);
  assert.match(hint,/iodo.*diodo/i);
  assert.match(hint,/what.*watt/i);
  assert.doesNotMatch(hint,/prompt|chain.of.thought|razonamiento interno/i);
});
