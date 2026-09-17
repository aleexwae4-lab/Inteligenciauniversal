import capacityChatV101, { capacityChatV101Capabilities } from './capacity-chat-v101.js';
import { applyAdaptiveAssetIntelligenceV102, adaptiveAssetVersionsV102, ADAPTIVE_ASSET_INTELLIGENCE_V102 } from '../lib/adaptive-asset-intelligence-v102.js';

export const CAPACITY_CHAT_V102='capacity-chat/v102-adaptive-asset-intelligence';

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return false;
      if(prop==='headersSent')return false;
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(target,prop,value){if(prop==='statusCode'){code=Number(value)||code;return true}target[prop]=value;return true}
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

export function adaptRequestV102(body={}){return applyAdaptiveAssetIntelligenceV102(body)}

function decorate(payload={},publicContext,path='adaptive-v102'){
  if(!payload||typeof payload!=='object')return payload;
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{...payload,adaptive_asset_intelligence:publicContext,response:{...response,metadata:{...(response.metadata||{}),adaptiveAssetIntelligence:{version:ADAPTIVE_ASSET_INTELLIGENCE_V102,path,assetType:publicContext?.asset?.type||'actionable_answer',workingDomain:publicContext?.context?.working_domain||'general',orchestration:publicContext?.capability_router?.orchestration||'single_core'}}}};
}

export default async function capacityChatV102(req,res){
  const rawBody=req.body&&typeof req.body==='object'?{...req.body}:{};
  const adapted=adaptRequestV102(rawBody);
  req.body=adapted.body;
  const buffered=bufferedResponse(res);
  try{await capacityChatV101(req,buffered.proxy)}catch(error){return res.status(500).json({error:'ADAPTIVE_PIPELINE_FAILURE',message:String(error?.message||error).slice(0,240),recoverable:true})}
  if(res.writableEnded)return;
  res.setHeader('X-WAE-Adaptive-Asset-Intelligence',ADAPTIVE_ASSET_INTELLIGENCE_V102);
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V102);
  const assetType=adapted.publicContext?.asset?.type;
  if(assetType)res.setHeader('X-WAE-Asset-Type',String(assetType).slice(0,80));
  if(!buffered.hasJson)return res.status(buffered.code||502).json({error:'ADAPTIVE_PIPELINE_EMPTY',message:'Universal Core no recibió un payload serializable del pipeline cognitivo.',recoverable:true});
  if(buffered.code>=400)return res.status(buffered.code).json(buffered.payload);
  return res.status(buffered.code).json(decorate(buffered.payload,adapted.publicContext,'v102->v101'));
}

export function capacityChatV102Capabilities(){
  return{release:CAPACITY_CHAT_V102,previous:capacityChatV101Capabilities(),adaptive:adaptiveAssetVersionsV102(),policy:{operatorAndTaskContextSeparated:true,explicitIdentityBeatsInference:true,hypotheticalOrganizationDoesNotBecomeIdentity:true,adaptiveProfessionalWorkspace:true,specialistCapabilityRouting:true,explicitScopeMemoryPartitioning:true,assetOrientedResponses:true,adaptiveQualityContract:true,currentFactsRequireLiveEvidence:true,externalActionsRequireToolEvidence:true}};
}
