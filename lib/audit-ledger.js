import { createHash } from 'node:crypto';

export const AUDIT_LEDGER_VERSION='universal-audit-ledger/v38.1';
const DEFAULT_PROXY_PATH='/functions/v1/wae-production-certification-v72/execution-receipt';
const text=(value,max=4000)=>String(value??'').trim().slice(0,max);
const sha256=(value)=>createHash('sha256').update(String(value??'')).digest('hex');

function directConfig(){
  const base=text(process.env.SUPABASE_URL,500).replace(/\/$/,'');
  const key=text(process.env.SUPABASE_SERVICE_ROLE_KEY,4000);
  return{base,key,configured:Boolean(base&&key)};
}

function privateRuntimeMaterial(){
  const candidates=[
    process.env.WAE_RECEIPT_LEDGER_SECRET,
    process.env.WAE_SUPABASE_MACHINE_KEY,
    process.env.OPENAI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.XAI_API_KEY,
    process.env.OPENROUTER_API_KEY,
  ];
  return candidates.map((value)=>text(value,4000)).find(Boolean)||'';
}

function proxyConfig(){
  const base=text(process.env.SUPABASE_URL,500).replace(/\/$/,'');
  const publishable=text(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY,4000);
  const material=privateRuntimeMaterial();
  const token=material?sha256(`wae:v38:ledger:${material}`):'';
  const fingerprint=token?sha256(token):null;
  const url=text(process.env.WAE_RECEIPT_LEDGER_URL,1000)||(base?`${base}${DEFAULT_PROXY_PATH}`:'');
  return{url,publishable,token,fingerprint,configured:Boolean(url&&publishable&&token)};
}

export function auditLedgerSnapshot(){
  const direct=directConfig(),proxy=proxyConfig();
  return{
    version:AUDIT_LEDGER_VERSION,
    configured:direct.configured||proxy.configured,
    mode:direct.configured?'direct_service_role':proxy.configured?'authenticated_edge_proxy':'unconfigured',
    directConfigured:direct.configured,
    proxyConfigured:proxy.configured,
    authFingerprint:proxy.fingerprint,
    rawCredentialExposed:false,
  };
}

async function persistDirect(receipt,direct){
  const row={...receipt};delete row.schema;
  const response=await fetch(`${direct.base}/rest/v1/universal_execution_receipts_v37`,{
    method:'POST',
    headers:{apikey:direct.key,Authorization:`Bearer ${direct.key}`,'Content-Type':'application/json',Prefer:'return=minimal'},
    body:JSON.stringify(row),
    signal:AbortSignal.timeout(10000),
  });
  if(response.ok||response.status===409)return{persisted:true,channel:'direct_service_role',deduplicated:response.status===409};
  return{persisted:false,reason:`ledger_http_${response.status}`,channel:'direct_service_role'};
}

async function persistProxy(receipt,proxy){
  const response=await fetch(proxy.url,{
    method:'POST',
    headers:{
      apikey:proxy.publishable,
      Authorization:`Bearer ${proxy.publishable}`,
      'Content-Type':'application/json',
      'X-WAE-Ledger-Token':proxy.token,
      'X-Client-Info':'wae-universal-execution-ledger/v38.1',
    },
    body:JSON.stringify({receipt}),
    signal:AbortSignal.timeout(12000),
  });
  const payload=await response.json().catch(()=>({}));
  if(response.ok&&payload?.persisted===true)return{persisted:true,channel:'authenticated_edge_proxy',receiptId:payload.receipt_id||receipt.id,deduplicated:Boolean(payload.deduplicated)};
  return{persisted:false,reason:text(payload?.error||`ledger_proxy_http_${response.status}`,180),channel:'authenticated_edge_proxy'};
}

export async function persistExecutionReceipt(receipt){
  const direct=directConfig();
  try{
    if(direct.configured)return await persistDirect(receipt,direct);
    const proxy=proxyConfig();
    if(proxy.configured)return await persistProxy(receipt,proxy);
    return{persisted:false,reason:'ledger_unconfigured',channel:'none'};
  }catch(error){
    return{persisted:false,reason:text(error?.message||'ledger_transport_failure',180),channel:direct.configured?'direct_service_role':'authenticated_edge_proxy'};
  }
}
