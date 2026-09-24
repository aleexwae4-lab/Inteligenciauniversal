/* Universal Core v124 — one integrity check for the canonical completed answer.
 * Never regard a blank, rejected or structurally invalid model response as success.
 * No network calls, shared state, provider claims or invented fallback text.
 */
export const ANSWER_INTEGRITY_VERSION='wae-answer-integrity/v124';

export function acceptAnswerV124(question='',raw='',cleanOutput=(text)=>String(text??''),validate=()=>({ok:true,required:false,text:''})){
  if(typeof raw!=='string'||!raw.trim())return{ok:false,reason:'empty_provider_answer',text:''};
  const cleaned=cleanOutput(raw);
  if(typeof cleaned!=='string'||!cleaned.trim())return{ok:false,reason:'rejected_or_empty_answer',text:''};
  const checked=validate(question,cleaned);
  if(!checked?.ok)return{ok:false,reason:'structured_output_contract_failed:'+String(checked?.reason||'invalid').slice(0,100),text:''};
  const text=checked.required?checked.text:cleaned;
  if(typeof text!=='string'||!text.trim())return{ok:false,reason:'empty_validated_answer',text:''};
  return{ok:true,reason:null,text};
}
