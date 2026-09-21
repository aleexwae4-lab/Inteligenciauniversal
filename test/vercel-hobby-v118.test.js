import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import router from '../api/index.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Hobby build emits one API function and only allowlisted static assets',()=>{
  const config=JSON.parse(read('vercel.json'));
  const functions=config.builds.filter(x=>x.use==='@vercel/node');
  assert.deepEqual(functions,[{src:'api/index.js',use:'@vercel/node'}]);
  assert.ok(config.builds.some(x=>x.src==='index.html'&&x.use==='@vercel/static'));
  assert.ok(config.builds.some(x=>x.src==='voice-client.js'));
  assert.ok(config.builds.some(x=>x.src==='premium-v117.js'));
  assert.ok(config.builds.some(x=>x.src==='assets/**'));
  assert.equal(config.builds.some(x=>x.src==='server.js'),false);
  assert.equal(config.builds.some(x=>x.src==='.env.example'),false);
  assert.equal(config.routes[0].dest,'/api/index.js?wae_route=$1');
});
test('every root API entry remains an importable router target, without dynamic path traversal',()=>{
  const source=read('api/index.js');
  const apiNames=readdirSync(new URL('../api/',import.meta.url)).filter(x=>x.endsWith('.js')&&x!=='index.js').map(x=>x.slice(0,-3));
  for(const name of apiNames)assert.ok(source.includes(JSON.stringify(name)+':()=>import('+JSON.stringify('./'+name+'.js')+')'),name);
  assert.match(source,/Object\.prototype\.hasOwnProperty\.call\(routes,name\)/);
});
test('single router rejects routes not in the allowlist',async()=>{
  const events=[];
  const res={status(code){events.push(code);return this},json(value){events.push(value);return value}};
  await router({query:{wae_route:'__proto__'},method:'GET'},res);
  assert.deepEqual(events,[404,{error:'not_found'}]);
});
test('router syntax and existing frontend entrypoints remain valid',()=>{
  for(const path of ['api/index.js','app.js','premium-v117.js']){
    const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL('../'+path,import.meta.url))],{encoding:'utf8'});
    assert.equal(result.status,0,path+': '+(result.stderr||result.stdout));
  }
});
