import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchWaewebPublic,normalizePublicSearch,waewebPublicConfigured,WAEWEB_PUBLIC_ORIGIN} from '../lib/waeweb-public-v126.js';
import {searchWaeweb,waewebSearchConfigured,waewebConfigured} from '../lib/waeweb-research-v125.js';
import {runTools,toolRegistry} from '../lib/tools.js';
import {retrieveResearch,researchCapabilities} from '../lib/live-research-v119.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const token='private-sentinel-'+ 'Z'.repeat(48);
const enabled={WAEWEB_PUBLIC_SEARCH_ENABLED:'true'};
const input={
 query:'Anthropic engineers',results:[
 {title:'Anthropic engineering survey',url:'https://example.org/anthropic-survey',
  snippet:'1,680 engineering roles across public profiles (not an official census)',
  source:'Brave',date:'2026-06-15'},
 {title:'Duplicate',url:'https://example.org/anthropic-survey',snippet:'duplicate',source:'Google'},
 {title:'Unsafe',url:'javascript:alert(1)',snippet:'bad',source:'Injected'}],
 sources:['Brave','Google','SearXNG'],failedSources:[],
 fetchedAt:'2026-09-24T00:00:00Z',webCoverage:'general-index',searchCoverage:{generalIndexes:['Brave','Google','SearXNG']}
};
const mock=()=>Response.json(input,{headers:{'content-type':'application/json'}});
async function withEnv(settings,fn){
 const keys=['WAEWEB_PUBLIC_SEARCH_ENABLED','WAEWEB_CONNECT_ENABLED','WAEWEB_CONNECT_BASE_URL',
 'WAEWEB_CONNECT_CLIENT_ID','WAEWEB_CONNECT_TOKEN','TAVILY_API_KEY'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const priorFetch=globalThis.fetch;
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,settings);
 try{return await fn()}finally{
  globalThis.fetch=priorFetch;
  for(const [k,v] of Object.entries(original))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
}
test('public adapter is explicit opt-in and never accepts arbitrary origins or private credentials',async()=>{
 assert.equal(WAEWEB_PUBLIC_ORIGIN,'https://waeweb.onrender.com');
 assert.equal(waewebPublicConfigured({}),false);
 assert.equal(waewebPublicConfigured(enabled),true);
 let observed=null;
 const transport=async(url,opts)=>{observed={url,opts};return mock()};
 const response=await searchWaewebPublic('Anthropic engineers',{env:enabled,transport});
 assert.equal(response.transport,'waeweb-public-readonly/v1');
 assert.equal(response.results.length,1);
 assert.equal(response.results[0].source,'WAEWEB · Brave');
 assert.equal(response.results[0].publishedAt,'2026-06-15');
 assert.equal(response.generalIndex,true);
 assert.equal(response.status,'complete');
 assert.ok(observed.url.startsWith(WAEWEB_PUBLIC_ORIGIN+'/api/search?'));
 assert.equal(new URL(observed.url).searchParams.get('q'),'Anthropic engineers');
 assert.equal(new URL(observed.url).searchParams.get('fresh'),'1');
 assert.equal(observed.opts.method,'GET');
 assert.equal(observed.opts.redirect,'error');
 assert.equal(observed.opts.headers.authorization,undefined);
 assert.doesNotMatch(observed.url,/token|Bearer|Z{10}/);
 assert.doesNotMatch(JSON.stringify(response),/private-sentinel/);
});
test('public API fail-closed on invalid query, unavailable sources, invalid payload and non JSON',async()=>{
 await assert.rejects(searchWaewebPublic('Anthropic engineers',{env:{}}),{code:'waeweb_public_not_enabled'});
 await assert.rejects(searchWaewebPublic('a',{env:enabled}),{code:'waeweb_public_invalid_query'});
 await assert.rejects(searchWaewebPublic('X'.repeat(181),{env:enabled}),{code:'waeweb_public_invalid_query'});
 await assert.rejects(searchWaewebPublic('bad\nprompt',{env:enabled}),{code:'waeweb_public_invalid_query'});
 assert.throws(()=>normalizePublicSearch({...input,sources:['Google no configurado'],failedSources:['Brave']},'Anthropic engineers'),/waeweb_public_sources_unavailable/);
 assert.throws(()=>normalizePublicSearch({...input,results:[] ,error:'search failed'},'Anthropic engineers'),/waeweb_public_contract_invalid/);
 await assert.rejects(searchWaewebPublic('Anthropic engineers',{env:enabled,transport:async()=>Response.json({error:'unavailable'},{status:503})}),{code:'waeweb_public_http_503'});
 await assert.rejects(searchWaewebPublic('Anthropic engineers',{env:enabled,transport:async()=>new Response('<html>bad</html>',{headers:{'content-type':'text/html'}})}),{code:'waeweb_public_invalid_content_type'});
 await assert.rejects(searchWaewebPublic('Anthropic engineers',{env:enabled,transport:async()=>new Response('X'.repeat(260*1024),{headers:{'content-type':'application/json'}})}),{code:'waeweb_public_too_large'});
});
test('public WAEWEB specialized/partial index is never misrepresented as complete general web',()=>{
 const specialized=normalizePublicSearch({...input,webCoverage:'limited',sources:['Wikipedia','Google no configurado'],failedSources:['Brave']},'Anthropic engineers');
 assert.equal(specialized.generalIndex,false);
 assert.equal(specialized.status,'partial');
 assert.match(specialized.limitation,/no equivale a cobertura/);
 assert.ok(specialized.results[0].url.startsWith('https://example.org/'));
 const zero=normalizePublicSearch({...input,results:[]},'Anthropic engineers');
 assert.equal(zero.status,'complete');
 assert.equal(zero.results.length,0);
});
test('private machine Connect retains priority; public is a distinct failover only',async()=>{
 const env={...enabled,WAEWEB_CONNECT_ENABLED:'true',WAEWEB_CONNECT_BASE_URL:'https://waeweb.onrender.com/',
 WAEWEB_CONNECT_CLIENT_ID:'inteligenciauniversal',WAEWEB_CONNECT_TOKEN:token};
 let privateCount=0,publicCount=0;
 const first=await searchWaeweb('Anthropic engineers',{env,
  privateSearch:async()=>{privateCount++;return {status:'complete',results:[{title:'Private'}]};},
  publicSearch:async()=>{publicCount++;return {status:'complete',results:[{title:'Public'}]};}
 });
 assert.equal(first.results[0].title,'Private');assert.equal(privateCount,1);assert.equal(publicCount,0);
 const fallback=await searchWaeweb('Anthropic engineers',{env,
  privateSearch:async()=>{throw Error('private offline');},
  publicSearch:async()=>{publicCount++;return {status:'partial',results:[{title:'Public'}]};}
 });
 assert.equal(fallback.results[0].title,'Public');assert.equal(publicCount,1);
 assert.equal(waewebConfigured(enabled),false);
 assert.equal(waewebSearchConfigured(enabled),true);
});
test('native chat prefers public WAEWEB, skips redundant providers for complete relevant web',async()=>{
 await withEnv({...enabled,TAVILY_API_KEY:'unused-test-key'},async()=>{
  let urls=[];globalThis.fetch=async(url)=>{
   urls.push(String(url));
   if(String(url).includes('/api/search'))return mock();
   if(String(url).includes('tavily'))return Response.json({results:[]});
   throw Error('unexpected fetch '+url);
  };
  assert.equal(toolRegistry().find(x=>x.id==='waeweb_search').configured,true);
  const result=await runTools({agent:{tools:['web_search']},message:'Anthropic engineers',requestedTools:['web_search']});
  assert.deepEqual(result.map(x=>x.tool),['waeweb_search']);
  assert.equal(result[0].coverage.transport,'waeweb-public-readonly/v1');
  assert.equal(urls.length,1);
  assert.equal(result[0].data[0].source,'WAEWEB · Brave');
 });
});
test('public partial/outage yields previous search fallback, not an empty synthetic success',async()=>{
 await withEnv({...enabled,TAVILY_API_KEY:'test-key'},async()=>{
  const urls=[];globalThis.fetch=async url=>{
   urls.push(String(url));
   return String(url).includes('/api/search')
    ?Response.json({...input,webCoverage:'limited',sources:['Wikipedia','Google no configurado'],failedSources:['Brave']})
    :Response.json({results:[{title:'Anthropic independent index',url:'https://example.org/anthropic-other',content:'other'}]});
  };
  const partial=await runTools({agent:{tools:['web_search']},message:'Anthropic engineers',requestedTools:['web_search']});
  assert.deepEqual(partial.map(x=>x.tool),['waeweb_search','web_search']);
  assert.equal(partial[0].coverage.status,'partial');
  assert.equal(urls.length,2);
  globalThis.fetch=async url=>String(url).includes('/api/search')
   ?Response.json({error:'unavailable'},{status:503})
   :Response.json({results:[{title:'Anthropic independent index',url:'https://example.org/anthropic-other',content:'other'}]});
  const down=await runTools({agent:{tools:['web_search']},message:'Anthropic engineers',requestedTools:['web_search']});
  assert.equal(down[0].ok,false);
  assert.equal(down[1].ok,true);
 });
});
test('Workspace and browser recognize public mode but never confuse it with private machine auth',async()=>{
 await withEnv(enabled,async()=>{
  globalThis.fetch=async()=>mock();
  const result=await retrieveResearch('Anthropic engineers',{mode:'web'});
  assert.equal(result.provider,'waeweb-public-readonly/v1');
  assert.equal(result.results[0].provider,'waeweb-public-readonly/v1');
  assert.equal(researchCapabilities().waewebPublic.configured,true);
  assert.equal(researchCapabilities().waewebPublic.liveVerified,false);
  assert.equal(researchCapabilities().waewebConnect.configured,false);
 });
 const client=read('runtime-client.js'),tools=read('lib/tools.js'),api=read('api/research.js');
 assert.match(client,/info\?\.waewebPublic\?\.configured===true/);
 assert.match(tools,/searchWaeweb\(message\)/);
 assert.match(api,/researchCapabilities/);
 assert.doesNotMatch(client,/WAEWEB_PUBLIC_SEARCH_ENABLED|WAEWEB_CONNECT_TOKEN/);
});
test('production release gate includes public adapter and live canary, leaves UI and first-turn intact',()=>{
 const pkg=JSON.parse(read('package.json')),sw=read('sw.js'),html=read('index.html');
 assert.match(pkg.scripts.check,/tests\/waeweb-public-v126\.test\.js/);
 assert.match(pkg.scripts.check,/node --check lib\/waeweb-public-v126\.js/);
 assert.match(sw,/wae-universal-render-waeweb-public-v45/);
 assert.match(html,/waewebpublic=v126/);
 assert.match(sw,/waewebpublic=v126/);
 assert.match(read('scripts/waeweb-public-live-canary.mjs'),/waewebPublicConfigured\(\)/);
 assert.match(read('runtime-client.js'),/chatWithSessionRepair\(chatPayload,init\.signal\)/);
});
