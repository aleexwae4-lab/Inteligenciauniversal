import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import nativeBrainHandler from '../api/native-brain.js';

function harness(message){
  const headers=new Map();
  const req={method:'POST',headers:{},body:{message,mode:'general'}};
  const res={
    statusCode:200,body:null,
    setHeader(key,value){headers.set(String(key).toLowerCase(),value);return this},
    status(code){this.statusCode=code;return this},
    json(payload){this.body=payload;return this}
  };
  return {req,res,headers};
}

test('the exact unanswered mobile capability turn resolves on the server without an external provider',async()=>{
  const {req,res,headers}=harness('Cuales son tus capacidades?');
  await nativeBrainHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.native_path,'grounded-self-awareness-v120');
  assert.equal(headers.get('x-wae-fast-path'),'grounded-self-awareness-v120');
  assert.match(res.body.reply,/Ingenier[ií]a|Razonamiento/i);
  assert.match(res.body.reply,/Universal Core|capacidades/i);
  assert.ok(res.body.reply.length>200);
  assert.equal(res.body.response.content,res.body.reply);
  assert.equal(res.body.speech_text,res.body.reply);
  assert.equal(res.body.self_awareness.identityOwner,'WAE OS Enterprise');
});

test('self identity answers are not replaced by generic provider branding',async()=>{
  const {req,res}=harness('¿Qué eres?');
  await nativeBrainHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.match(res.body.reply,/Universal Core/);
  assert.match(res.body.reply,/WAE OS Enterprise/);
});

test('accepted turns preserve a visible terminal outcome and a one-tap retry',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const mobile=readFileSync(new URL('../mobile-safe-composer.js',import.meta.url),'utf8');
  assert.match(app,/No recib[ií] una respuesta completa/);
  assert.match(app,/data\.waeRetry/);
  assert.match(app,/finally\{releaseTurnUI\(\)\}/);
  assert.match(mobile,/Clear the mobile draft only after/);
  assert.match(mobile,/data\.aiBusy==='true'/);
});
