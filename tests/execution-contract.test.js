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

test('server and capability contract expose governed execution and tool discovery',async()=>{
  const server=await read('server.js');
  const capabilities=await read('api/capabilities.js');
  assert.match(server,/\/api\/execute/);
  assert.match(server,/executeHandler/);
  assert.match(server,/\/api\/tools/);
  assert.match(server,/toolsHandler/);
  assert.match(capabilities,/executionPlaneSnapshot/);
  assert.match(capabilities,/toolFabricSnapshot/);
  assert.match(capabilities,/endpoint:'\/api\/execute'/);
});

test('progressive chrome loads live tool-fabric status instead of relying on static count',async()=>{
  const progressive=await read('progressive-boot-v23.js');
  const client=await read('capability-client-v36.js');
  assert.match(progressive,/capability-client-v36\.js\?v=38/);
  assert.match(progressive,/v38-tool-fabric/);
  assert.match(client,/enabledToolCount/);
  assert.match(client,/WAE_TOOL_FABRIC/);
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

test('execution API runs safe local text primitive only when content is supplied',async()=>{
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'},body:{capability:'file_analysis',action:'inspect_text',task:'Analiza contenido',input:{name:'a.txt',content:'uno dos tres'},sessionId:'contract-local'}};
  const res=responseHarness();
  await executeHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.payload.success,true);
  assert.equal(res.payload.tool.id,'text.inspect');
  assert.equal(res.payload.result.words,3);
});
