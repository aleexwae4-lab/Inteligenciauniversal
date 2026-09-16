import capacityChatV88 from './capacity-chat-v88.js';
import { classifyUniversalKnowledge, UNIVERSAL_KNOWLEDGE_MESH_VERSION, universalKnowledgeCapabilities } from '../lib/universal-knowledge-mesh-v89.js';

export const CAPACITY_CHAT_V89='capacity-chat/v89-universal-knowledge-mesh';

export default async function capacityChatV89(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const classification=classifyUniversalKnowledge(body);
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V89);
  res.setHeader('X-WAE-Universal-Knowledge',classification.eligible?UNIVERSAL_KNOWLEDGE_MESH_VERSION:'bypass');

  if(!classification.eligible)return capacityChatV88(req,res);

  req.body={
    ...body,
    universal_knowledge:true,
    knowledge:true,
    fusion:true,
    ...(classification.current?{web_enabled:true}:{}),
    universal_knowledge_profile:{domains:classification.domains,packs:classification.packs,current:classification.current,research:classification.research}
  };
  return capacityChatV88(req,res);
}

export function capacityChatV89Capabilities(){
  return{
    release:CAPACITY_CHAT_V89,
    knowledge:universalKnowledgeCapabilities(),
    policy:{retrieveBeforeAnsweringFactualQueries:true,creativeTransformsBypass:true,verifyBeforeAccept:true,noOmniscienceClaim:true,noBaseModelTrainingClaim:true}
  };
}
