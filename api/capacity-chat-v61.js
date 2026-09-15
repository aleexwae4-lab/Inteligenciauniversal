import capacityChatV60 from './capacity-chat-v60.js';
import { applyQualityReliability, QUALITY_RELIABILITY_VERSION } from '../lib/quality-reliability-v61.js';

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

export default async function capacityChatV61(req,res){
  const buffered=bufferedResponse(res);
  await capacityChatV60(req,buffered.proxy);
  if(res.writableEnded||!buffered.hasJson)return;
  let payload=buffered.payload;
  if(buffered.code<400&&payload&&typeof payload==='object'){
    payload=applyQualityReliability(payload,{prompt:req?.body?.message||req?.body?.prompt||''});
    const q=payload.quality_reliability||{};
    res.setHeader('X-WAE-Quality-Reliability',QUALITY_RELIABILITY_VERSION);
    res.setHeader('X-WAE-Quality-Score',String(q.score??0));
    res.setHeader('X-WAE-Quality-Grade',String(q.grade||'UNKNOWN'));
  }
  return res.status(buffered.code).json(payload);
}
