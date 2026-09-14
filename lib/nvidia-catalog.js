export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export const NVIDIA_KEY_ENV = 'NVIDIA_API_KEY';

export const NVIDIA_CHAT_MODELS = Object.freeze([
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    role: 'agentic_fast',
    contextTokens: 1048576,
    reasoning: true,
    tools: true,
    structuredOutput: true,
    multimodal: false,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    role: 'agentic_reasoning',
    contextTokens: 1048576,
    reasoning: true,
    tools: true,
    structuredOutput: true,
    multimodal: false,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    role: 'frontier_reasoning',
    contextTokens: 1048576,
    reasoning: true,
    tools: true,
    structuredOutput: true,
    multimodal: false,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    role: 'omni_reasoning',
    contextTokens: 262144,
    reasoning: true,
    tools: true,
    structuredOutput: true,
    multimodal: true,
  },
]);

export const NVIDIA_AUXILIARY_MODELS = Object.freeze([
  { id: 'nvidia/nemotron-3-embed-1b', kind: 'embedding' },
  { id: 'nvidia/nemotron-3.5-content-safety', kind: 'safety' },
  { id: 'nvidia/riva-translate-4b-instruct-v2', kind: 'translation' },
  { id: 'nvidia/ising-calibration-1.5-31b', kind: 'domain_vlm' },
  { id: 'nvidia/cosmos3-nano', kind: 'world_video' },
  { id: 'nvidia/cosmos3-nano-reasoner', kind: 'vision_reasoning' },
  { id: 'nvidia/synthetic-video-detector', kind: 'synthetic_video_detection' },
  { id: 'nvidia/active-speaker-detection', kind: 'active_speaker_detection' },
  { id: 'nvidia/ising-calibration-1-35b-a3b', kind: 'domain_vlm' },
  { id: 'nvidia/nemotron-voicechat', kind: 'voice_chat' },
  { id: 'nvidia/cosmos-transfer2.5-2b', kind: 'video_to_world' },
  { id: 'nvidia/riva-translate-4b-instruct-v1_1', kind: 'translation' },
  { id: 'nvidia/streampetr', kind: 'autonomous_driving' },
  { id: 'nvidia/llama-3.1-nemotron-safety-guard-8b-v3', kind: 'safety' },
  { id: 'nvidia/bnr', kind: 'audio_denoising' },
  { id: 'nvidia/magpie-tts-zeroshot', kind: 'text_to_speech' },
  { id: 'nvidia/sparsedrive', kind: 'autonomous_driving' },
  { id: 'nvidia/bevformer', kind: 'autonomous_driving' },
  { id: 'nvidia/studiovoice', kind: 'speech_enhancement' },
  { id: 'nvidia/kumo-relational', kind: 'structured_data' },
]);

export const NVIDIA_FREE_ENDPOINT_CATALOG = Object.freeze([
  ...NVIDIA_CHAT_MODELS.map(model => ({ ...model, lane: 'chat' })),
  ...NVIDIA_AUXILIARY_MODELS.map(model => ({ ...model, lane: 'auxiliary' })),
]);

export function nvidiaConfigured(env = process.env) {
  return typeof env?.[NVIDIA_KEY_ENV] === 'string' && env[NVIDIA_KEY_ENV].trim().length > 0;
}

export function nvidiaCatalogSummary(env = process.env) {
  return {
    provider: 'nvidia_nim',
    configured: nvidiaConfigured(env),
    publicBranding: false,
    endpointClass: 'development_trial',
    learningMode: 'feedback_evals_adaptive_routing',
    baseModelWeightsTrained: false,
    chatModels: NVIDIA_CHAT_MODELS.length,
    auxiliaryModels: NVIDIA_AUXILIARY_MODELS.length,
    totalFreeEndpoints: NVIDIA_FREE_ENDPOINT_CATALOG.length,
  };
}
