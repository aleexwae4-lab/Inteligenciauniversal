/* Universal Core v125 — deterministic completed-answer verification.
 * Pure, provider-independent and content-minimizing: returns signals, never the answer body.
 */
export const RESPONSE_VERIFIER_VERSION='wae-response-verifier/v125';

const leakPatterns=[
  /<\/?analysis>/i,/\bchain[- ]of[- ]thought\b/i,/\binternal (?:prompt|reasoning|system message)\b/i,
  /\bBEGIN_(?:SYSTEM|DEVELOPER)_PROMPT\b/i
];
const refusalLike=/^(?:i (?:can't|cannot|won't)|no puedo|no puedo ayudar|lo siento[,.:]? no puedo)\b/i;

export function verifyCompletedAnswerV125(question='',text='',options={}){
  const value=String(text??'').trim();
  const words=value?value.split(/\s+/).filter(Boolean).length:0;
  const requestedJson=options.structured===true;
  let jsonOk=null;
  if(requestedJson){try{const parsed=JSON.parse(value);jsonOk=!!parsed&&typeof parsed==='object'&&!Array.isArray(parsed)}catch{jsonOk=false}}
  const internalLeak=leakPatterns.some(rx=>rx.test(value));
  const refusal=refusalLike.test(value);
  const exactEcho=String(question??'').trim().length>24&&value===String(question??'').trim();
  const ok=!!value&&!internalLeak&&!exactEcho&&jsonOk!==false;
  return{
    ok,
    reason:!value?'empty_answer':internalLeak?'internal_leak':exactEcho?'question_echo':jsonOk===false?'invalid_structured_answer':null,
    signals:{nonempty:!!value,word_count:words,internal_leak:internalLeak,question_echo:exactEcho,refusal_like:refusal,structured_json_valid:jsonOk}
  };
}
