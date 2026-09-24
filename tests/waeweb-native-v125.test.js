import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {waewebSettings,requestWaeweb} from '../lib/waeweb-connect.js';
import {searchWaewebEvidence,normalizeWaewebResults,waewebConfigured} from '../lib/waeweb-research-v125.js';
import {runTools,formatToolContext,toolRegistry} from '../lib/tools.js';
import {retrieveResearch,researchCapabilities} from '../lib/live-research-v119.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const token='native-waeweb-test-'+'k'.repeat(48);
const cfg={WAEWEB_CONNECT_ENABLED:'true',WAEWEB_CONNECT_BASE_URL:'https://waeweb.vercel.app/',
 WAEWEB_CONNECT_CLIENT_ID:'inteligenciauniversal',WAEWEB_CONNECT_TOKEN:token};
const result={
 ok:true,contract:'waeweb-connect/v1',status:'complete',query:'Anthropic engineers',
 results:[{title:'Anthropic engineering analysis',url:'https://example.org/anthropic-engineering',
  snippet:'Analysis of engineering roles; sample, not company census.',source:'External article',date:'2026-06-15'},
  {title:'Invalid url',url:'javascript:alert(1)',snippet:'bad',source:'Injected'},
  {title:'Same result',url:'https://example.org/anthropic-engineering',snippet:'duplicate',source:'Duplicate'}],
 sources:['External article'],failedSources:[],fetchedAt:'2026-09-23T00:00:00Z'
};
async function withEnv(changes,fn){
 const keys=['WAEWEB_CONNECT_ENABLED','WAEWEB_CONNECT_BASE_URL','WAEWEB_CONNECT_CLIENT_ID',
 'WAEWEB_CONNECT_TOKEN','TAVILY_API_KEY'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]])),previous=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,changes);
 try{return await fn()}finally{
  globalThis.fetch=previous;
  for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v}
 }
}
test('native connector requires feature switch, HTTPS, client id and machine token',()=>{
 assert.equal(waewebSettings({}),null);
 assert.equal(waewebSettings({...cfg,WAEWEB_CONNECT_ENABLED:'false'}),null);
 assert.equal(waewebSettings({...cfg,WAEWEB_CONNECT_TOKEN:'short'}),null);
 assert.equal(waewebSettings({...cfg,WAEWEB_CONNECT_CLIENT_ID:'waeosgreen'}),null);
 assert.equal(waewebSettings({...cfg,WAEWEB_CONNECT_BASE_URL:'http://localhost/'}),null);
 assert.equal(waewebSettings(cfg).id,'inteligenciauniversal');
});
test('actual WAEWEB Connect/v1 HTTP contract is consumed with server-only credential',async()=>{
 let url,options;
 const transport=async(u,o)=>{url=u;options=o;return Response.json(result)};
 const evidence=await searchWaewebEvidence('Anthropic engineers',{transport,env:cfg});
 assert.equal(url,'https://waeweb.vercel.app/api/connect/v1/search');
 assert.equal(options.headers.authorization,'Bearer '+token);
 assert.equal(options.headers['x-waeweb-client'],'inteligenciauniversal');
 assert.equal(options.redirect,'error');
 assert.deepEqual(JSON.parse(options.body),{query:'Anthropic engineers',type:'all',fresh:true});
 assert.equal(evidence.results.length,1);
 assert.equal(evidence.results[0].url,'https://example.org/anthropic-engineering');
 assert.equal(evidence.results[0].publishedAt,'2026-06-15');
 assert.equal(evidence.results[0].source,'WAEWEB · External article');
 assert.equal(evidence.status,'complete');
 assert.doesNotMatch(JSON.stringify(evidence),new RegExp(token));
 await assert.rejects(()=>searchWaewebEvidence('q',{transport,env:cfg}),{code:'waeweb_query_out_of_range'});
 await assert.rejects(()=>searchWaewebEvidence('a'.repeat(181),{transport,env:cfg}),{code:'waeweb_query_out_of_range'});
});
test('partial WAEWEB evidence is usable but explicitly labeled non-exhaustive',()=>{
 const partial=normalizeWaewebResults({...result,status:'partial',failedSources:['Brave']},'Anthropic engineers');
 assert.equal(partial.results.length,1);
 assert.match(partial.results[0].scope,/partial/);
 assert.deepEqual(partial.failedSources,['Brave']);
 assert.match(partial.limitation,/parcial/);
 assert.throws(()=>normalizeWaewebResults({...result,ok:false,error:'no_sources_available'}),/waeweb_search_contract_invalid/);
 assert.throws(()=>normalizeWaewebResults({...result,contract:'wrong'}),/waeweb_search_contract_invalid/);
});
test('configured chat researches via WAEWEB before Tavily; empty/partial or unavailable preserve fallback',async()=>{
 await withEnv({...cfg,TAVILY_API_KEY:'test-only-tavily'},async()=>{
  let calls=[];
  globalThis.fetch=async(input,options)=>{
   calls.push(String(input));
   if(String(input).includes('/api/connect/v1/search'))return Response.json(result);
   if(String(input).includes('api.tavily.com'))return Response.json({results:[{title:'Anthropic another report',url:'https://example.org/anthropic-other',content:'other'}]});
   throw Error('unexpected external fetch');
  };
  const agent={tools:['web_search']};
  const one=await runTools({agent,message:'Anthropic engineers',requestedTools:['web_search']});
  assert.deepEqual(one.map(x=>x.tool),['waeweb_search']);
  assert.equal(one[0].data.length,1);
  assert.match(formatToolContext(one),/WAEWEB/);
  assert.equal(calls.length,1);
  calls=[];
  globalThis.fetch=async(input)=>{
   calls.push(String(input));
   if(String(input).includes('/api/connect/v1/search'))return Response.json({...result,status:'partial',failedSources:['Brave']});
   if(String(input).includes('api.tavily.com'))return Response.json({results:[{title:'Anthropic another report',url:'https://example.org/anthropic-other',content:'other'}]});
   throw Error('unexpected external fetch');
  };
  const partial=await runTools({agent,message:'Anthropic engineers',requestedTools:['web_search']});
  assert.deepEqual(partial.map(x=>x.tool),['waeweb_search','web_search']);
  assert.equal(partial[0].coverage.status,'partial');
  assert.equal(calls.length,2);
  globalThis.fetch=async input=>String(input).includes('/api/connect/v1/search')
   ?Response.json({error:'connect_disabled'},{status:503})
   :Response.json({results:[{title:'Anthropic another report',url:'https://example.org/anthropic-other',content:'other'}]});
  const failed=await runTools({agent,message:'Anthropic engineers',requestedTools:['web_search']});
  assert.deepEqual(failed.map(x=>x.tool),['waeweb_search','web_search']);
  assert.equal(failed[0].ok,false);
  assert.equal(failed[1].ok,true);
  assert.equal(formatToolContext(failed).includes('connect_disabled'),false);
 });
});
test('disabled connector causes no new request and preserves pre-existing public research',async()=>{
 await withEnv({WAEWEB_CONNECT_ENABLED:'false'},async()=>{
  assert.equal(waewebConfigured(),false);
  assert.equal(toolRegistry().find(x=>x.id==='waeweb_search').configured,false);
  let url;
  globalThis.fetch=async input=>{url=String(input);return Response.json({query:{search:[{title:'Article',pageid:12,snippet:'context'}]}})};
  const r=await retrieveResearch('Article',{mode:'encyclopedia'});
  assert.equal(r.provider,'wikimedia');
  assert.match(url,/wikipedia.org/);
 });
});
test('workspace research prefers actual WAEWEB provider when configured; no browser secrets',async()=>{
 await withEnv(cfg,async()=>{
  let endpoint;
  globalThis.fetch=async(input)=>{endpoint=String(input);return Response.json(result)};
  const response=await retrieveResearch('Anthropic engineers',{mode:'web'});
  assert.equal(response.provider,'waeweb-connect/v1');
  assert.equal(response.results[0].url,'https://example.org/anthropic-engineering');
  assert.match(endpoint,/api\/connect\/v1\/search$/);
  assert.equal(researchCapabilities().waewebConnect.configured,true);
  assert.equal(researchCapabilities().waewebConnect.liveVerified,false);
  assert.doesNotMatch(JSON.stringify(researchCapabilities()),new RegExp(token));
 });
 const client=read('runtime-client.js'),runtime=read('lib/runtime.js'),api=read('api/research.js');
 assert.match(client,/waewebResearchReady\(init.signal\)/);
 assert.match(client,/info\?\.waewebConnect\?\.configured===true/);
 assert.match(runtime,/x!=='waeweb_search'/);
 assert.match(runtime,/waeweb_search\|web_search\|public_research/);
 assert.match(api,/researchCapabilities/);
 assert.doesNotMatch(client,/WAEWEB_CONNECT_TOKEN|x-waeweb-client|Bearer \+cfg\.token/);
});
test('release gate includes connector tests, refuses invented LIVE assertion and preserves PWA cache',()=>{
 const pkg=JSON.parse(read('package.json')),sw=read('sw.js'),html=read('index.html');
 assert.match(pkg.scripts.check,/tests\/waeweb-native-v125\.test\.js/);
 assert.match(pkg.scripts.check,/node --check lib\/waeweb-connect\.js/);
 assert.match(sw,/wae-universal-render-waeweb-public-v45/);
 assert.match(html,/waeweb=v125/);
 assert.match(sw,/waeweb=v125/);
});
