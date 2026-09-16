import { callInternalSupabaseRpc, internalSupabaseTransportState } from './internal-supabase-rpc-v74.js';

export const EXECUTION_LEDGER_VERSION='execution-receipt-ledger/v75';
const RPC_NAME='wae_record_execution_receipt_v75';

function text(value,max=180){return String(value??'').replace(/[\r\n\t]+/g,' ').slice(0,max)}
function cleanBase(value=''){return String(value||'').trim().replace(/\/$/,'')}
function receiptRow(receipt={}){const row={...(receipt&&typeof receipt==='object'?receipt:{})};delete row.schema;return row}

export function executionLedgerState(env=process.env){
  const base=Boolean(env.SUPABASE_URL);
  const serviceRole=Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  const publishable=Boolean(env.SUPABASE_PUBLISHABLE_KEY);
  const bridgeToken=Boolean(env.WAE_RUNTIME_BRIDGE_TOKEN);
  return{
    version:EXECUTION_LEDGER_VERSION,
    configured:base&&(serviceRole||(publishable&&bridgeToken)),
    directServiceRole:base&&serviceRole,
    bridgeReady:base&&(serviceRole||publishable)&&bridgeToken,
    rlsBypassExposed:false,
    rawSecretsExposed:false,
  };
}

async function persistDirect(row,{env,fetchImpl}){
  const base=cleanBase(env.SUPABASE_URL),key=String(env.SUPABASE_SERVICE_ROLE_KEY||'');
  if(!base||!key)return{persisted:false,reason:'service_role_unconfigured'};
  try{
    const response=await fetchImpl(`${base}/rest/v1/universal_execution_receipts_v37`,{
      method:'POST',
      headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify(row),
      signal:AbortSignal.timeout(10_000),
    });
    return response.ok
      ?{persisted:true,version:EXECUTION_LEDGER_VERSION,transport:'service_role_direct'}
      :{persisted:false,reason:`ledger_http_${response.status}`,transport:'service_role_direct'};
  }catch(error){
    return{persisted:false,reason:text(error?.message||'ledger_transport_failure'),transport:'service_role_direct'};
  }
}

async function persistBridge(row,{env,rpcCaller}){
  if(!env.SUPABASE_URL||!(env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_PUBLISHABLE_KEY)||!env.WAE_RUNTIME_BRIDGE_TOKEN){
    return{persisted:false,reason:'receipt_bridge_unconfigured'};
  }
  try{
    const result=await rpcCaller({
      functionName:RPC_NAME,
      body:{p_token:String(env.WAE_RUNTIME_BRIDGE_TOKEN),p_receipt:row},
      timeoutMs:5_000,
      clientInfo:'wae-execution-ledger-v75',
    });
    const payload=result?.payload;
    if(result?.ok===true&&payload?.ok===true&&payload?.persisted===true){
      return{persisted:true,version:EXECUTION_LEDGER_VERSION,transport:'token_bridge_v75',receiptId:payload.receipt_id||null};
    }
    return{persisted:false,reason:text(payload?.error||result?.error||'receipt_bridge_rejected'),transport:'token_bridge_v75'};
  }catch(error){
    return{persisted:false,reason:text(error?.message||'receipt_bridge_failure'),transport:'token_bridge_v75'};
  }
}

export async function persistExecutionReceipt(receipt,{env=process.env,fetchImpl=globalThis.fetch,rpcCaller=callInternalSupabaseRpc}={}){
  const row=receiptRow(receipt);
  if(!row.id||!row.capability_id||!row.adapter||!row.action||!row.status||!row.request_hash){
    return{persisted:false,reason:'invalid_receipt_contract'};
  }

  if(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY&&typeof fetchImpl==='function'){
    const direct=await persistDirect(row,{env,fetchImpl});
    if(direct.persisted)return direct;
  }

  const bridged=await persistBridge(row,{env,rpcCaller});
  if(bridged.persisted)return bridged;

  return{persisted:false,reason:bridged.reason||'ledger_unconfigured',transport:bridged.transport||'none'};
}

export function executionLedgerCapabilities(){
  const state=executionLedgerState();
  const transport=internalSupabaseTransportState();
  return{
    ...state,
    internalRpcConfigured:transport.configured,
    internalRpcLeastPrivilegeReady:transport.leastPrivilegeReady,
    persistencePolicy:'service-role-direct-first; authenticated private-token bridge fallback; fail closed on invalid bridge token',
  };
}
