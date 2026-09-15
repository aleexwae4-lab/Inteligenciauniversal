import capacityChatV58 from './capacity-chat-v58.js';
import { applyAnswerIntelligence, ANSWER_INTELLIGENCE_VERSION } from '../lib/answer-intelligence-v60.js';

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
    set(target,prop,value){
      if(prop==='statusCode'){code=Number(value)||code;return true}
      target[prop]=value;return true;
    }
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

export default async function capacityChatV60(req,res){
  const buffered=bufferedResponse(res);
  await capacityChatV58(req,buffered.proxy);
  if(res.writableEnded)return;
  if(!buffered.hasJson)return;
  let payload=buffered.payload;
  if(buffered.code<400&&payload&&typeof payload==='object'){
    payload=applyAnswerIntelligence(payload);
    const gate=String(payload?.answer_intelligence?.gate||'PASS');
    res.setHeader('X-WAE-Answer-Intelligence',ANSWER_INTELLIGENCE_VERSION);
    res.setHeader('X-WAE-Answer-Gate',gate);
    res.setHeader('X-WAE-Citation-Coverage',String(payload?.answer_intelligence?.citation_coverage??1));
  }
  return res.status(buffered.code).json(payload);
}
