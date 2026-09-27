import { createHash } from 'node:crypto';

export const EXTERNAL_REFERENCE_ADAPTER_VERSION='external-reference-adapter/v1';

const sha256=value=>createHash('sha256').update(String(value??'')).digest('hex');
const clean=(value,max=200)=>String(value??'').trim().slice(0,max);

export function externalReferenceManifest({provider='',model='',source=''}={}){
  const referenceId=provider&&model?String(provider).trim().toLowerCase()+':'+String(model).trim().toLowerCase():'';
  return {
    schema:'universal-external-reference/v1',
    version:EXTERNAL_REFERENCE_ADAPTER_VERSION,
    referenceId:referenceId||null,
    provider:clean(provider,80)||null,
    model:clean(model,160)||null,
    source:clean(source,500)||null,
    exactVersionRequired:true,
    responseReceiptRequired:true,
    responseHashRequired:true,
    simulatedResponsesForbidden:true,
    paidApiProvisioning:false,
    claimPolicy:'Only compare after the exact external reference has supplied all paired responses with verifiable provenance. No inferred or simulated competitor results.'
  };
}

export function normalizeReferenceResponse({caseId='',promptHash='',answer='',provider='',model='',responseId='',observedAt='',responseHash=''}={}){
  const text=clean(answer,80000);
  return {
    caseId:clean(caseId,120),
    promptHash:clean(promptHash,128).toLowerCase(),
    answer:text,
    answerHash:sha256(text),
    provider:clean(provider,80).toLowerCase(),
    model:clean(model,160),
    responseId:clean(responseId,200),
    observedAt:clean(observedAt,80),
    suppliedResponseHash:clean(responseHash,128).toLowerCase()||null,
    hashMatches:!responseHash||sha256(text)===String(responseHash).trim().toLowerCase()
  };
}

export function validateExternalReferenceBatch({entries=[],suite=[]}={}){
  const cases=new Map((Array.isArray(suite)?suite:[]).map(x=>[x.id,x]));
  const seen=new Set();
  const invalid=[];
  const normalized=[];
  for(const entry of Array.isArray(entries)?entries:[]){
    const row=normalizeReferenceResponse(entry);
    const testCase=cases.get(row.caseId);
    if(!testCase){invalid.push({caseId:row.caseId,reason:'unknown_case'});continue}
    if(seen.has(row.caseId)){invalid.push({caseId:row.caseId,reason:'duplicate_case'});continue}
    if(row.promptHash!==String(testCase.promptHash||'').toLowerCase()){invalid.push({caseId:row.caseId,reason:'prompt_hash_mismatch'});continue}
    if(!row.answer){invalid.push({caseId:row.caseId,reason:'empty_answer'});continue}
    if(!row.provider||!row.model||!row.responseId||!row.observedAt){invalid.push({caseId:row.caseId,reason:'provenance_missing'});continue}
    if(!row.hashMatches){invalid.push({caseId:row.caseId,reason:'response_hash_mismatch'});continue}
    seen.add(row.caseId);
    normalized.push(row);
  }
  const complete=seen.size===cases.size&&cases.size>0;
  return {
    version:EXTERNAL_REFERENCE_ADAPTER_VERSION,
    complete,
    evaluatedCases:normalized.length,
    expectedCases:cases.size,
    invalid,
    claimAllowed:false,
    nextGate:complete&&invalid.length===0?'PAIR_WITH_UNIVERSAL_CORE_AND_RUN_CERTIFICATION':'SUPPLY_MISSING_VERIFIED_REFERENCE_RESPONSES'
  };
}
