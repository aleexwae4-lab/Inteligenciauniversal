import { providerRegistry } from './providers.js';

export const FRONTIER_REFERENCE_VERSION='frontier-reference/v96';
export const FRONTIER_REFERENCE_PROVIDER='openai';
export const DEFAULT_OPENAI_FRONTIER_MODEL='gpt-6-astra';

const clean=(value,max=160)=>String(value??'').trim().slice(0,max);
const providerId=value=>clean(value,80).toLowerCase();

export function openAIFrontierBenchmarkModel(){
  return clean(process.env.OPENAI_BENCHMARK_MODEL||DEFAULT_OPENAI_FRONTIER_MODEL,160);
}

export function openAIFrontierReferenceState(registry=providerRegistry()){
  const row=(Array.isArray(registry)?registry:[]).find(item=>providerId(item?.id)===FRONTIER_REFERENCE_PROVIDER)||null;
  const model=openAIFrontierBenchmarkModel();
  const versioned=Boolean(model&&/\d/.test(model));
  const configured=row?.configured===true;
  return{
    version:FRONTIER_REFERENCE_VERSION,
    provider:FRONTIER_REFERENCE_PROVIDER,
    configured,
    model:model||null,
    referenceId:versioned?`${FRONTIER_REFERENCE_PROVIDER}:${model.toLowerCase()}`:null,
    versioned,
    executable:configured&&versioned,
    exactExecution:true,
    fallbackAllowed:false,
    decoupledFromProductionModel:true,
    ordinaryProviderModel:clean(row?.model,160)||null,
    reason:configured&&versioned?'ready':configured?'reference_model_not_versioned':'openai_provider_not_configured',
    secretExposed:false,
  };
}

export function frontierReferenceCapabilities(registry=providerRegistry()){
  const state=openAIFrontierReferenceState(registry);
  return{
    version:FRONTIER_REFERENCE_VERSION,
    provider:state.provider,
    benchmarkModel:state.model,
    referenceId:state.referenceId,
    configured:state.configured,
    executable:state.executable,
    exactExecution:true,
    fallbackAllowed:false,
    decoupledFromProductionModel:true,
    productionModel:state.ordinaryProviderModel,
    benchmarkModelEnvironment:'OPENAI_BENCHMARK_MODEL',
    baseModelTraining:false,
  };
}
