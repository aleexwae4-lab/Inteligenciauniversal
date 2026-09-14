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
  { id: 'nvidia/nemotron-voicechat', kind: 'voice_chat' },
  { id: 'nvidia/cosmos3-nano', kind: 'world_video' },
  { id: 'nvidia/cosmos3-nano-reasoner', kind: 'vision_reasoning' },
  { id: 'nvidia/cosmos-transfer2.5-2b', kind: 'video_to_world' },
  { id: 'nvidia/ising-calibration-1.5-31b', kind: 'domain_vlm' },
  { id: 'nvidia/kumo-relational', kind: 'structured_data' },
  { id: 'nvidia/lipsync', kind: 'media' },
]);

export function nvidiaConfigured(env = process.env) {
  return typeof env?.[NVIDIA_KEY_ENV] === 'string' && env[NVIDIA_KEY_ENV].trim().length > 0;
}

export function nvidiaCatalogSummary(env = process.env) {
  return {
    provider: 'nvidia_nim',
    configured: nvidiaConfigured(env),
    publicBranding: false,
    learningMode: 'feedback_evals_adaptive_routing',
    baseModelWeightsTrained: false,
    chatModels: NVIDIA_CHAT_MODELS.length,
    auxiliaryModels: NVIDIA_AUXILIARY_MODELS.length,
  };
}
