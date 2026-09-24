import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {retrieveResearch,researchCapabilities} from '../lib/live-research-v119.js';
import {createRoom,readRoom,updateRoom,collaborationCapabilities} from '../lib/live-collaboration-v119.js';
import {runtimeHealth} from '../lib/runtime.js';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('v119 reports honest multi-source research and collaboration capabilities',()=>{
 const r=researchCapabilities(),c=collaborationCapabilities(),h=runtimeHealth();
 assert.equal(r.academic.configured,true);assert.equal(r.encyclopedia.configured,true);
 assert.equal(r.googleWorkspace.connected,false);assert.equal(r.secretsExposed,false);
 assert.equal(c.persistent,false);assert.equal(c.ttlHours,6);assert.equal(c.googleWorkspaceConnected,false);
 assert.equal(h.research.version,r.version);assert.equal(h.collaboration.version,c.version);
});
test('unconfigured general web is distinct from the keyless recent-news index',async()=>{
 const oldFetch=globalThis.fetch,existing=process.env.TAVILY_API_KEY;delete process.env.TAVILY_API_KEY;
 let url='';globalThis.fetch=async(input)=>{url=String(input);return{ok:true,json:async()=>({articles:[{title:'News index entry',url:'https://example.org/news',seendate:'20260921T210000Z'},{title:'Unsafe URL',url:'javascript:alert(1)'}]})}};
 try{
  const news=await retrieveResearch('Noticias de hoy sobre energía',{mode:'auto'});
  assert.equal(news.ok,true);assert.equal(news.provider,'gdelt');assert.equal(news.results.length,1);
  assert.equal(news.results[0].publishedAt,'2026-09-21T21:00:00Z');assert.match(url,/api.gdeltproject.org/);
  assert.match(news.limitation,/no certifica hechos/);
  const forced=await retrieveResearch('Noticias de hoy sobre energía',{mode:'web'});
  assert.equal(forced.ok,false);assert.equal(forced.code,'general_web_not_configured');assert.deepEqual(forced.results,[]);
  await assert.rejects(retrieveResearch('a',{mode:'academic'}),e=>e.code==='research_bad_query');
 }finally{globalThis.fetch=oldFetch;if(existing!==undefined)process.env.TAVILY_API_KEY=existing}
});
test('public academic retrieval uses keyless Crossref, actual returned bibliographic metadata and safe URLs',async()=>{
 const old=globalThis.fetch,oldKey=process.env.OPENALEX_API_KEY;delete process.env.OPENALEX_API_KEY;
 let url='';
 globalThis.fetch=async(input)=>{url=String(input);return{ok:true,json:async()=>({message:{items:[{title:['Real source'],DOI:'10.1000/example',published:{'date-parts':[[2024,3,4]]}},{title:['Invalid'],URL:'javascript:alert(1)'}]}})}};
 try{
  const result=await retrieveResearch('climate engineering',{mode:'academic'});
  assert.match(url,/api.crossref.org\/works/);assert.equal(result.provider,'crossref');
  assert.equal(result.results.length,1);assert.equal(result.results[0].url,'https://doi.org/10.1000/example');
  assert.equal(result.results[0].publishedAt,'2024-3-4');
  assert.ok(result.results[0].retrievedAt);
 }finally{globalThis.fetch=old;if(oldKey!==undefined)process.env.OPENALEX_API_KEY=oldKey}
});
test('public general web retrieval does not interpolate caller-controlled URLs or send key to client',async()=>{
 const old=globalThis.fetch,oldKey=process.env.TAVILY_API_KEY;process.env.TAVILY_API_KEY='test-secret';
 let options;
 globalThis.fetch=async(_url,opts)=>{options=opts;return{ok:true,json:async()=>({results:[{title:'Valid',url:'https://example.org/story',content:'Verified extract'},{title:'Invalid',url:'javascript:alert(1)',content:'bad'}]})}};
 try{
  const result=await retrieveResearch('valid query',{mode:'web'});
  assert.equal(result.results.length,1);assert.equal(result.provider,'tavily');
  assert.ok(options.body.includes('test-secret'));assert.ok(!JSON.stringify(result).includes('test-secret'));
 }finally{globalThis.fetch=old;if(oldKey===undefined)delete process.env.TAVILY_API_KEY;else process.env.TAVILY_API_KEY=oldKey}
});
test('shared documents require an unguessable invitation and block stale overwrite',()=>{
 const created=createRoom({title:'Proyecto',text:'versión inicial'});
 assert.equal(created.text,'versión inicial');assert.equal(created.revision,0);
 assert.equal(created.persistent,false);
 assert.throws(()=>readRoom({id:created.id,secret:'invalid'}),e=>e.code==='room_not_found');
 const latest=updateRoom({id:created.id,secret:created.secret,text:'revisión nueva',revision:0});
 assert.equal(latest.ok,true);assert.equal(latest.revision,1);
 const conflict=updateRoom({id:created.id,secret:created.secret,text:'borrador antiguo',revision:0});
 assert.equal(conflict.ok,false);assert.equal(conflict.code,'revision_conflict');
 assert.equal(readRoom({id:created.id,secret:created.secret}).text,'revisión nueva');
 assert.throws(()=>updateRoom({id:created.id,secret:created.secret,text:'x'.repeat(90001),revision:1}),e=>e.code==='invalid_room_text');
});
test('research and collaboration endpoints exist without changing chat, history or the Premium interface',()=>{
 const server=read('server.js'),client=read('live-workspace-v119.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(server,/\['\/api\/research', researchHandler\]/);
 assert.match(server,/\['\/api\/collaboration', collaborationHandler\]/);
 assert.match(client,/revision:state.revision/);assert.match(client,/Conflicto/);
 assert.match(client,/if\(e.value===state.last\)/);assert.match(client,/stream\(\)/);
 assert.match(client,/navigator.clipboard.writeText/);
 assert.match(html,/live-workspace-v119\.js\?v=1/);
 assert.match(sw,/live-workspace-v119\.js\?v=1/);
 assert.match(sw,/wae-universal-render-waeweb-v44/);
 assert.match(html,/runtime-client\.js\?v=24&industrial=v115&professional=v116&world=v117&chatfix=v118/);
});
test('research sources become real tool context, but explicit no-web remains respected',()=>{
 const tools=read('lib/tools.js'),runtime=read('lib/runtime.js');
 assert.match(tools,/retrieveResearch\(q,\{mode\}\)/);
 assert.match(runtime,/const gatheredSources=toolResults/);
 assert.match(runtime,/const realSources=/);
 assert.match(runtime,/sources:realSources/);
 assert.match(runtime,/payload.web_enabled!==false && !/);
 assert.match(runtime,/publicResearch\?\['public_research'\]/);
});
