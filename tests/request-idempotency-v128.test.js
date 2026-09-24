import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientRequestKeyV128,requestIdentityV128,requestFingerprintV128,requestMetaV128,isExpiredRequestV128,REQUEST_IDEMPOTENCY_VERSION} from '../supabase/functions/wae-local-voice-demo-v61/request-idempotency-v128.js';

const sid='11111111-1111-4111-8111-111111111111',otherSid='22222222-2222-4222-8222-222222222222';
const key='req_abcdefgh12345678';
test('retry key is explicit and malformed keys fail without logging secrets',()=>{
  assert.equal(clientRequestKeyV128(undefined),null);
  assert.equal(clientRequestKeyV128(''),null);
  assert.equal(clientRequestKeyV128(key),key);
  for(const invalid of ['short','new id with spaces','a'.repeat(129),42,{}]){
    assert.throws(()=>clientRequestKeyV128(invalid),error=>error.status===422&&error.message==='invalid_client_request_id');
  }
});
test('same session and key reuse stable UUIDs; different keys or sessions cannot collide',async()=>{
  const a=await requestIdentityV128(sid,key),same=await requestIdentityV128(sid,key);
  const otherKey=await requestIdentityV128(sid,'req_abcdefgh12345679');
  const otherSession=await requestIdentityV128(otherSid,key);
  assert.deepEqual(a,same);
  for(const field of ['userId','assistantId','conversationId']){
    assert.match(a[field],/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(a[field],otherKey[field]);
    assert.notEqual(a[field],otherSession[field]);
  }
  assert.equal(new Set([a.userId,a.assistantId,a.conversationId]).size,3);
  assert.equal(await requestIdentityV128(sid,null),null);
});
test('fingerprint binds original content, mode, web and attachments but not transport streaming',async()=>{
  const payload={message:'Hola',mode:'research',web_enabled:true,attachments:[{name:'a.pdf'}],internal_context:'context'};
  const a=await requestFingerprintV128(payload),b=await requestFingerprintV128({...payload});
  assert.equal(a,b);
  assert.match(a,/^[0-9a-f]{64}$/);
  for(const changed of [{...payload,message:'Adiós'},{...payload,mode:'general'},{...payload,attachments:[]},{...payload,web_enabled:false},{...payload,internal_context:'different'}]){
    assert.notEqual(await requestFingerprintV128(changed),a);
  }
  assert.equal(REQUEST_IDEMPOTENCY_VERSION,'wae-request-idempotency/v128');
});
test('lease is finite; failed attempts are eligible for recovery',()=>{
  const meta=requestMetaV128({key,fingerprint:'a',requestId:'b'});
  assert.equal(meta.status,'generating');
  assert.equal(isExpiredRequestV128(meta),false);
  assert.equal(isExpiredRequestV128({...meta,status:'failed'}),true);
  assert.equal(isExpiredRequestV128({...meta,lease_until:'2000-01-01T00:00:00Z'}),true);
});
test('active Edge explicitly deduplicates messages and responses using database UUID constraints',()=>{
  const edge=readFileSync(new URL('../supabase/functions/wae-local-voice-demo-v61/index-v63.ts',import.meta.url),'utf8');
  assert.match(edge,/import \{clientRequestKeyV128,requestIdentityV128,requestFingerprintV128,requestMetaV128,isExpiredRequestV128\}/);
  assert.match(edge,/if\(action==='chat'\)\{const replay=await replayClientRequestV128\(db,sid,body,origin\)/);
  assert.match(edge,/const userId=identity\?\.userId\|\|crypto\.randomUUID\(\)/);
  assert.match(edge,/assistantId=ctx\.identity\?\.assistantId\|\|crypto\.randomUUID\(\)/);
  assert.match(edge,/if\(!identity\|\|ur\.error\.code!=='23505'\)/);
  assert.match(edge,/if\(!isExpiredRequestV128\(old\)\)throw retryConflictV128/);
  assert.match(edge,/\.eq\('content_json',JSON\.stringify\(old\)\)\.select\('id'\)/);
  assert.match(edge,/return jsonResponse\(409,\{success:false,error:'request_in_progress'/);
  assert.match(edge,/const fingerprint=await requestFingerprintV128\(retryInputV128\(body,q\)\)/);
  assert.match(edge,/const accepted=assessCandidateV127\(q,assistant\.content/);
  assert.match(edge,/for\(const ev of verifiedDeliveryEventsV126\(response,speechText/);
  assert.doesNotMatch(edge,/if\(action==='chat'&&body\.stream!==true\)/);
});
