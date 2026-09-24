/* Universal Core v128 — explicit, session-scoped retry identity.
 * Optional client_request_id. Never infer that repeating the same question is a retry.
 * User/assistant primary keys provide database-enforced deduplication without new tables.
 */
export const REQUEST_IDEMPOTENCY_VERSION='wae-request-idempotency/v128';
export function clientRequestKeyV128(value){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string'||!/^[A-Za-z0-9_-]{16,128}$/.test(value)){
    throw Object.assign(new Error('invalid_client_request_id'),{status:422});
  }
  return value;
}
async function scopedUuidV128(value){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
export async function requestIdentityV128(sessionId,key){
  if(!key)return null;
  const namespace='wae-request/v128:'+String(sessionId)+':'+key;
  const [userId,assistantId,conversationId]=await Promise.all([
    scopedUuidV128(namespace+':user'),scopedUuidV128(namespace+':assistant'),scopedUuidV128(namespace+':conversation')
  ]);
  return{key,userId,assistantId,conversationId};
}
export async function requestFingerprintV128({message='',mode='general',web_enabled=false,attachments=[],internal_context=''}={}){
  const text=JSON.stringify([message,mode,web_enabled===true,attachments,internal_context]);
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function requestMetaV128({key,fingerprint,requestId,leaseMinutes=10}){
  return{schema:'assistant-response/v1',kind:'user',idempotency_key:key,fingerprint,status:'generating',lease_id:requestId,lease_until:new Date(Date.now()+leaseMinutes*60000).toISOString()};
}
export function isExpiredRequestV128(meta,now=Date.now()){
  return !!meta&&(meta.status==='failed'||!Number.isFinite(Date.parse(meta.lease_until))||Date.parse(meta.lease_until)<now);
}
