import capacityChatV61 from './capacity-chat-v61.js';
import { observeQualityOutcome, PERFORMANCE_ROUTER_VERSION } from '../lib/provider-mesh-v62.js';
import { SUPREMACY_BENCHMARK_VERSION } from '../lib/supremacy-benchmark-v62.js';

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return false;
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(target,prop,value){if(prop==='statusCode'){code=Number(value)||code;return true}target[prop]=value;return true}
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

export default async function capacityChatV62(req,res){
  const buffered=bufferedResponse(res);
  await capacityChatV61(req,buffered.proxy);
  if(res.writableEnded||!buffered.hasJson)return;
  const payload=buffered.payload;
  if(buffered.code<400&&payload&&typeof payload==='object'){
    const mesh=payload.provider_mesh||payload?.response?.metadata?.providerMesh||null;
    observeQualityOutcome({route:mesh,payload});
    res.setHeader('X-WAE-Performance-Router',PERFORMANCE_ROUTER_VERSION);
    res.setHeader('X-WAE-Benchmark-Arena',SUPREMACY_BENCHMARK_VERSION);
  }
  return res.status(buffered.code).json(payload);
}
