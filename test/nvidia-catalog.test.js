import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NVIDIA_BASE_URL,
  NVIDIA_KEY_ENV,
  NVIDIA_CHAT_MODELS,
  NVIDIA_AUXILIARY_MODELS,
  NVIDIA_FREE_ENDPOINT_CATALOG,
  nvidiaConfigured,
  nvidiaCatalogSummary,
} from '../lib/nvidia-catalog.js';

test('NVIDIA fabric uses the NIM API without embedding credentials', () => {
  assert.equal(NVIDIA_BASE_URL, 'https://integrate.api.nvidia.com/v1');
  assert.equal(NVIDIA_KEY_ENV, 'NVIDIA_API_KEY');
  assert.equal(nvidiaConfigured({}), false);
  assert.equal(nvidiaConfigured({ NVIDIA_API_KEY: 'nvapi-test' }), true);
});

test('general-purpose NVIDIA lanes are classified under Universal Core', () => {
  const ids = NVIDIA_CHAT_MODELS.map(x => x.id);
  assert.deepEqual(ids.sort(), [
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    'nvidia/nemotron-3-super-120b-a12b',
    'nvidia/nemotron-3-ultra-550b-a55b',
    'nvidia/nemotron-3.5-lightning-30b-a3b',
  ].sort());
});

test('specialized NVIDIA endpoints stay out of the general chat lane', () => {
  const ids = new Set(NVIDIA_AUXILIARY_MODELS.map(x => x.id));
  const kinds = new Set(NVIDIA_AUXILIARY_MODELS.map(x => x.kind));
  assert.equal(NVIDIA_CHAT_MODELS.length, 4);
  assert.equal(NVIDIA_AUXILIARY_MODELS.length, 20);
  assert.equal(NVIDIA_FREE_ENDPOINT_CATALOG.length, 24);
  assert.ok(ids.has('nvidia/synthetic-video-detector'));
  assert.ok(ids.has('nvidia/active-speaker-detection'));
  assert.ok(ids.has('nvidia/bnr'));
  assert.ok(ids.has('nvidia/studiovoice'));
  assert.ok(ids.has('nvidia/magpie-tts-zeroshot'));
  assert.ok(ids.has('nvidia/llama-3.1-nemotron-safety-guard-8b-v3'));
  assert.ok(!ids.has('nvidia/lipsync'));
  assert.ok(kinds.has('embedding'));
  assert.ok(kinds.has('safety'));
  assert.ok(kinds.has('translation'));
  assert.ok(kinds.has('voice_chat'));
  assert.ok(kinds.has('vision_reasoning'));
  assert.ok(kinds.has('autonomous_driving'));
  assert.ok(kinds.has('speech_enhancement'));
});

test('learning is evidence-driven and never claims base-weight training', () => {
  const summary = nvidiaCatalogSummary({});
  assert.equal(summary.publicBranding, false);
  assert.equal(summary.endpointClass, 'development_trial');
  assert.equal(summary.learningMode, 'feedback_evals_adaptive_routing');
  assert.equal(summary.baseModelWeightsTrained, false);
  assert.equal(summary.totalFreeEndpoints, 24);
});
