import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeLocalReply, nativeBrainStatus } from '../lib/native-brain-v1.js';

test('native brain identifies itself as an owned orchestration core',()=>{
  const status=nativeBrainStatus();
  assert.equal(status.version,'wae-native-brain/v1');
  assert.equal(status.ready,true);
  assert.equal(status.localKernel,true);
  assert.match(status.architecture,/native-orchestrator/);
});

test('native kernel answers the exact solar-system regression without any provider',()=>{
  const reply=nativeLocalReply('¿Sabes cuántos planetas hay en el sistema solar?');
  assert.match(reply,/8 planetas/i);
  assert.match(reply,/Mercurio/);
  assert.match(reply,/Neptuno/);
});

test('native kernel preserves basic stable knowledge when inference engines are unavailable',()=>{
  assert.match(nativeLocalReply('¿Sabes qué es un termostato?'),/temperatura/i);
  assert.match(nativeLocalReply('¿Cómo funciona la fotosíntesis?'),/energía/i);
});

test('native kernel performs bounded deterministic arithmetic',()=>{
  assert.match(nativeLocalReply('12 * 7'),/84/);
  assert.match(nativeLocalReply('10 / 0'),/dividir entre cero/i);
});
