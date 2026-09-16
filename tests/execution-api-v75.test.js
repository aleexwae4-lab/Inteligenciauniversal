import test from 'node:test';
import assert from 'node:assert/strict';
import executeHandler from '../api/execute.js';

class ResponseMock {
  constructor(){this.statusCode=200;this.headers={};this.payload=null;}
  setHeader(name,value){this.headers[String(name).toLowerCase()]=value;}
  status(code){this.statusCode=code;return this;}
  json(payload){this.payload=payload;return this;}
}

test('execute API keeps unsupported actions fail-closed with v75 ledger contract',async()=>{
  const original={
    url:process.env.SUPABASE_URL,
    publishable:process.env.SUPABASE_PUBLISHABLE_KEY,
    service:process.env.SUPABASE_SERVICE_ROLE_KEY,
    bridge:process.env.WAE_RUNTIME_BRIDGE_TOKEN,
    origins:process.env.WAE_ALLOWED_ORIGINS,
  };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.WAE_RUNTIME_BRIDGE_TOKEN;
  delete process.env.WAE_ALLOWED_ORIGINS;
  try{
    const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'},body:{capability:'computer_use',action:'click',task:'unsupported action contract',sessionId:'v75-test'}};
    const res=new ResponseMock();
    await executeHandler(req,res);
    assert.equal(res.statusCode,422);
    assert.equal(res.payload.success,false);
    assert.equal(res.payload.status,'blocked');
    assert.equal(res.payload.error,'capability_not_executable');
    assert.equal(res.payload.receipt.schema,'universal-execution-receipt/v1');
    assert.equal(res.payload.receipt.side_effect,'none');
    assert.equal(res.payload.audit.persisted,false);
    assert.equal(typeof res.payload.audit.reason,'string');
  }finally{
    for(const [key,value] of Object.entries(original)){
      const envKey={url:'SUPABASE_URL',publishable:'SUPABASE_PUBLISHABLE_KEY',service:'SUPABASE_SERVICE_ROLE_KEY',bridge:'WAE_RUNTIME_BRIDGE_TOKEN',origins:'WAE_ALLOWED_ORIGINS'}[key];
      if(value===undefined)delete process.env[envKey];else process.env[envKey]=value;
    }
  }
});
