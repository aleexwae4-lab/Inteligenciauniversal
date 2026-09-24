import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const api=readFileSync(new URL('../api/chat.js',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../lib/runtime.js',import.meta.url),'utf8');
const providers=readFileSync(new URL('../lib/providers.js',import.meta.url),'utf8');

test('HTTP API establishes one request identity and exposes it to a reconnecting client',()=>{
  assert.match(api,/req\.headers\?\.\['x-wae-request-id'\]/);
  assert.match(api,/body\.client_request_id/);
  assert.match(api,/res\.setHeader\('X-WAE-Request-Id',clientRequestId\)/);
  assert.match(api,/const requestBody=\{\.\.\.body,client_request_id:clientRequestId\}/);
  assert.match(api,/const runtimeBody=intent\.changed\?\{\.\.\.requestBody,message:intent\.text\}:requestBody/);
});

test('runtime propagates client_request_id into every quality-generation attempt',()=>{
  assert.match(runtime,/clientRequestId=\/\^\[A-Za-z0-9_-\]\{16,128\}\$\//);
  const calls=runtime.match(/generateWithFallback\(\{[^;]+?\}\)/gs)||[];
  assert.ok(calls.length>=4);
  for(const call of calls)assert.match(call,/clientRequestId/);
});

test('Edge adapter accepts upstream identity but still creates a safe key for legacy callers',()=>{
  assert.match(providers,/async function waeUniversalEdgeResponse\(\{ message, history, clientRequestId \}\)/);
  assert.match(providers,/const stableClientRequestId=\/\^\[A-Za-z0-9_-\]\{16,128\}\$\//);
  assert.match(providers,/'wae_'\+crypto\.randomUUID\(\)\.replaceAll\('-',\s*''\)/);
  assert.equal((providers.match(/clientRequestId:stableClientRequestId/g)||[]).length,2);
  assert.match(providers,/generateWithFallback\(\{ provider='auto', system, message, history=\[\], clientRequestId=null \}\)/);
  assert.match(providers,/callers\[p\.id\]\(\{model:p\.model,system:systemWithContract,message,history,clientRequestId\}\)/);
});

test('server never trusts malformed external request IDs',()=>{
  assert.match(api,/\/\^\[A-Za-z0-9_-\]\{16,128\}\$\//);
  assert.doesNotMatch(api,/clientRequestId=bodyRequestId\|\|headerRequestId/);
});
