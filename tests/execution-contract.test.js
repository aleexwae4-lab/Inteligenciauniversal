import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import executeHandler from '../api/execute.js';

const read=(name)=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

function responseHarness(){
  return{
    statusCode:200,headers:{},payload:null,
    setHeader(name,value){this.headers[name]=value},
    status(code){this.statusCode=code;return this},
    json(payload){this.payload=payload;return this},
  };
}

test('server and capability contract expose the governed execution plane',async()=>{
  const server=await read('server.js');
  const capabilities=await read('api/capabilities.js');
  assert.match(server,/\/api\/execute/);
  assert.match(server,/executeHandler/);
  assert.match(capabilities,/executionPlaneSnapshot/);
  assert.match(capabilities,/endpoint:'\/api\/execute'/);
});

test('progressive chrome loads live capability status instead of relying on static count',async()=>{
  const progressive=await read('progressive-boot-v23.js');
  const client=await read('capability-client-v36.js');
  assert.match(progressive,/capability-client-v36\.js\?v=37/);
  assert.match(progressive,/v37-execution-plane/);
  assert.match(client,/configuredAdapterCount/);
  assert.match(client,/WAE_EXECUTION_PLANE/);
});

test('execution API fails closed for unsupported computer use',async()=>{
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'},body:{capability:'computer_use',action:'click',task:'Haz clic en guardar',sessionId:'contract-test'}};
  const res=responseHarness();
  await executeHandler(req,res);
  assert.equal(res.statusCode,422);
  assert.equal(res.payload.success,false);
  assert.equal(res.payload.status,'blocked');
  assert.equal(res.payload.error,'capability_not_executable');
  assert.equal(res.payload.receipt.error_code,'capability_not_executable');
});
