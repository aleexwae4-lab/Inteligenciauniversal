import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NVIDIA_BASE_URL,
  NVIDIA_KEY_ENV,
  NVIDIA_CHAT_MODELS,
  NVIDIA_AUXILIARY_MODELS,
  nvidiaConfigured,
  nvidiaCatalogSummary,
} from '../lib/nvidia-catalog.js';

test('NVIDIA catalog uses OpenAI-compatible NIM endpoint without embedding credentials', () => {
  assert.equal(NVIDIA_BASE_URL, 'https://integrate.api.nvidia.com/v1');
  assert.equal(NVIDIA_KEY_ENV, 'NVIDIA_API_KEY');
  assert.equal(nvidiaConfigured({}), false);
  assert.equal(nvidiaConfigured({ NVIDIA_API_KEY: 'nvapi-test' }), true);
});

test('current general-purpose NVIDIA lanes are represented under Universal Core', () => {
  const ids = NVIDIA_CHAT_MODELS.map(x => x.id);
  assert.ok(ids.includes('nvidia/nemotron-3.5-lightning-30b-a3b'));
  assert.ok(ids.includes('nvidia/nemotron-3-super-120b-a12b'));
  assert.ok(ids.includes('nvidia/nemotron-3-ultra-550b-a55b'));
  assert.ok(ids.includes('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'));
  assert.ok(!ids.includes('nvidia/nvidia-nemotron-nano-9b-v2'));
});

test('specialized NVIDIA models stay out of the chat pool', () => {
  const kinds = new Set(NVIDIA_AUXILIARY_MODELS.map(x => x.kind));
  assert.ok(kinds.has('embedding'));
  assert.ok(kinds.has('safety'));
  assert.ok(kinds.has('translation'));
  assert.ok(kinds.has('voice_chat'));
  assert.ok(kinds.has('vision_reasoning'));
});

test('learning contract is eval-driven and does not claim base-weight training', () => {
  const summary = nvidiaCatalogSummary({});
  assert.equal(summary.publicBranding, false);
  assert.equal(summary.learningMode, 'feedback_evals_adaptive_routing');
  assert.equal(summary.baseModelWeightsTrained, false);
});
