/* Universal Core v127 — one provider-independent candidate gate.
 * No provider receives a success signal before both checks pass.
 * This pure function neither fabricates an answer nor records private text.
 */
import {acceptAnswerV124} from './answer-integrity-v124.js';
import {verifyCompletedAnswerV125} from './response-verifier-v125.js';
export const CANDIDATE_QUALITY_VERSION='wae-candidate-quality/v127';
export function assessCandidateV127(question='',raw='',cleanOutput=(x)=>String(x??''),validate=()=>({ok:true,required:false}),structured=false){
  const integrity=acceptAnswerV124(question,raw,cleanOutput,validate);
  if(!integrity.ok)return{ok:false,text:'',reason:integrity.reason,signals:null};
  const verification=verifyCompletedAnswerV125(question,integrity.text,{structured});
  if(!verification.ok)return{ok:false,text:'',reason:'response_verification_failed:'+verification.reason,signals:verification.signals};
  return{ok:true,text:integrity.text,reason:null,signals:verification.signals};
}
