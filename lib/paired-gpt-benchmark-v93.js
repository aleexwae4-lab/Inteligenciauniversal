export const PAIRED_GPT_BENCHMARK_VERSION='paired-gpt-benchmark/v93';
export const DEFAULT_TARGET_ID='universal-core-v92';
export const DEFAULT_REFERENCE_ID='gpt-6-astra';
export const DEFAULT_REASONING_EFFORT='high';
export const OPENAI_PRICING_SNAPSHOT='2026-09-16';

const MODEL_PRICING=Object.freeze({
  'gpt-6-astra':{inputPerMillion:10,cachedInputPerMillion:1,outputPerMillion:50},
  'gpt-5.6-sol':{inputPerMillion:4,cachedInputPerMillion:.4,outputPerMillion:20},
});

const str=value=>typeof value==='string'?value.trim():'';
const finite=value=>Number.isFinite(Number(value))?Number(value):0;

export function extractUniversalAnswer(payload={}){
  const candidates=[payload?.reply,payload?.answer,payload?.text,payload?.output_text,payload?.response?.content,payload?.response?.text,payload?.response?.answer];
  return candidates.map(str).find(Boolean)||'';
}

function sourceValue(item){
  if(typeof item==='string')return item.trim();
  if(!item||typeof item!=='object')return'';
  return str(item.url)||str(item.uri)||str(item.href)||str(item.source_url)||str(item.title)||str(item.name);
}

function uniqueSources(items=[]){
  return [...new Set((Array.isArray(items)?items:[]).map(sourceValue).filter(Boolean))].slice(0,20);
}

export function extractUniversalSources(payload={}){
  return uniqueSources([
    ...(Array.isArray(payload?.sources)?payload.sources:[]),
    ...(Array.isArray(payload?.web_sources)?payload.web_sources:[]),
    ...(Array.isArray(payload?.response?.sources)?payload.response.sources:[]),
    ...(Array.isArray(payload?.response?.metadata?.sources)?payload.response.metadata.sources:[]),
    ...(Array.isArray(payload?.citations)?payload.citations:[]),
  ]);
}

export function extractOpenAIText(payload={}){
  if(str(payload?.output_text))return str(payload.output_text);
  const parts=[];
  for(const item of Array.isArray(payload?.output)?payload.output:[]){
    if(item?.type!=='message')continue;
    for(const part of Array.isArray(item?.content)?item.content:[]){
      if(part?.type==='output_text'&&str(part?.text))parts.push(str(part.text));
    }
  }
  return parts.join('\n').trim();
}

export function extractOpenAISources(payload={}){
  const sources=[];
  for(const item of Array.isArray(payload?.output)?payload.output:[]){
    if(item?.type==='web_search_call'){
      const action=item?.action||{};
      if(Array.isArray(action.sources))sources.push(...action.sources);
      if(Array.isArray(item.sources))sources.push(...item.sources);
    }
    if(item?.type==='message'){
      for(const part of Array.isArray(item?.content)?item.content:[]){
        for(const annotation of Array.isArray(part?.annotations)?part.annotations:[]){
          if(annotation?.type==='url_citation')sources.push(annotation?.url||annotation?.url_citation?.url||annotation);
        }
      }
    }
  }
  return uniqueSources(sources);
}

export function estimateOpenAICostUsd(usage={},model=DEFAULT_REFERENCE_ID){
  const pricing=MODEL_PRICING[String(model||'').trim()];
  if(!pricing)return null;
  const input=finite(usage?.input_tokens),output=finite(usage?.output_tokens),cached=Math.min(input,finite(usage?.input_tokens_details?.cached_tokens));
  const uncached=Math.max(0,input-cached);
  return Number(((uncached*pricing.inputPerMillion+cached*pricing.cachedInputPerMillion+output*pricing.outputPerMillion)/1_000_000).toFixed(8));
}

export function buildOpenAIRequest(testCase={},options={}){
  const model=str(options.model)||DEFAULT_REFERENCE_ID;
  const reasoningEffort=str(options.reasoningEffort)||DEFAULT_REASONING_EFFORT;
  const research=String(testCase?.mode||'general')==='research';
  const body={
    model,
    input:String(testCase?.prompt||''),
    reasoning:{effort:reasoningEffort},
    store:false,
  };
  if(research){
    body.tools=[{type:'web_search_preview'}];
    body.include=['web_search_call.action.sources'];
  }
  return body;
}

export function buildUniversalRequest(testCase={},options={}){
  const prompt=String(testCase?.prompt||'');
  const mode=String(testCase?.mode||'general');
  return{
    message:prompt,
    task:prompt,
    mode,
    web_enabled:mode==='research',
    provider:'auto',
    benchmark:true,
    benchmark_case_id:String(testCase?.id||''),
    userKey:String(options.userKey||`paired-benchmark-${testCase?.id||'case'}`).slice(0,160),
    history:[],
  };
}

export function benchmarkRunManifest({targetId=DEFAULT_TARGET_ID,referenceId=DEFAULT_REFERENCE_ID,targetUrl='',reasoningEffort=DEFAULT_REASONING_EFFORT,commitSha='',referenceMode='direct_api'}={}){
  return{
    schema:'paired-gpt-benchmark-run/v1',
    version:PAIRED_GPT_BENCHMARK_VERSION,
    targetId:String(targetId),
    referenceId:String(referenceId),
    targetUrl:String(targetUrl),
    targetCommit:String(commitSha||''),
    referenceMode:String(referenceMode),
    referenceReasoningEffort:String(reasoningEffort),
    openAIPricingSnapshot:OPENAI_PRICING_SNAPSHOT,
    policy:{sameImmutablePrompt:true,blindDeterministicScoring:true,rawOutputsRetained:true,simulatedReferenceForbidden:true,referenceIdentityExcludedFromScoring:true,benchmarkScopedClaimsOnly:true},
  };
}
