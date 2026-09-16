import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldUseLiveData, retrieveLiveData, formatLiveDataContext, publicLiveDataMetadata, LIVE_DATA_MESH_VERSION } from '../lib/live-data-mesh-v58.js';

function okJson(payload){return{ok:true,status:200,async json(){return payload},async text(){return JSON.stringify(payload)},headers:{get(){return null}}}}

async function withEnv(values,work){
  const previous={};
  for(const [key,value] of Object.entries(values)){previous[key]=process.env[key];if(value===null||value===undefined)delete process.env[key];else process.env[key]=String(value)}
  try{return await work()}finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
}

test('detecta intención temporal sin exigir modo research',()=>{
  assert.equal(shouldUseLiveData({message:'¿Quién es el CEO actual y cuáles son las noticias recientes?',mode:'general'}),true);
  assert.equal(shouldUseLiveData({message:'Explícame qué es una API REST',mode:'general'}),false);
  assert.equal(shouldUseLiveData({message:'Investiga arquitectura de agentes',mode:'research'}),true);
});

test('fusiona GDELT y búsqueda web con provenance y timestamps',async()=>{
  const fakeFetch=async url=>{
    assert.match(String(url),/api\.gdeltproject\.org/);
    return okJson({articles:[{
      title:'AI systems release today',
      url:'https://news.example.com/ai-release',
      domain:'news.example.com',
      seendate:'20260915123000',
      language:'English',
      sourcecountry:'United States'
    }]});
  };
  const fakeWebSearch=async()=>[{
    title:'Live company update',url:'https://company.example.com/update',content:'Official update published today.',score:.91
  }];
  const live=await retrieveLiveData({
    message:'latest AI company news today unique-v58-test-1',mode:'general',force:true,fetchImpl:fakeFetch,webSearch:fakeWebSearch,maxResults:4
  });
  assert.equal(live.version,LIVE_DATA_MESH_VERSION);
  assert.equal(live.used,true);
  assert.equal(live.evidenceReady,true);
  assert.equal(live.failClosed,false);
  assert.equal(live.sourceCount,2);
  assert.equal(live.sources[0].key,'R1');
  assert.ok(live.sources.every(x=>x.retrieved_at));
  assert.ok(live.sources.some(x=>x.source==='gdelt-doc'));
  assert.ok(live.sources.some(x=>x.source==='tavily'));
  assert.match(formatLiveDataContext(live),/DATOS VIVOS VERIFICADOS/);
  const publicMeta=publicLiveDataMetadata(live);
  assert.equal(publicMeta.evidence_ready,true);
  assert.equal(publicMeta.source_count,2);
});

test('SearXNG configured locally participates in live retrieval as a zero-fee metasearch connector',async()=>{
  await withEnv({SEARXNG_BASE_URL:'https://searx.example.test',TAVILY_API_KEY:null},async()=>{
    const calls=[];
    const fakeFetch=async url=>{
      calls.push(String(url));
      if(String(url).includes('api.gdeltproject.org'))return okJson({articles:[]});
      if(String(url).startsWith('https://searx.example.test/search'))return okJson({results:[{
        title:'Official current update',url:'https://official.example.test/status',content:'Current status from a metasearch result.',score:.95,engine:'search-engine'
      }]});
      throw new Error(`unexpected_url:${url}`);
    };
    const live=await retrieveLiveData({message:'current system status unique-v88-searx-test',mode:'research',force:true,fetchImpl:fakeFetch,maxResults:4});
    assert.equal(live.evidenceReady,true);
    assert.ok(live.connectors.some(item=>item.id==='searxng'&&item.ok));
    assert.ok(live.sources.some(item=>item.source==='searxng'));
    assert.ok(calls.some(url=>url.startsWith('https://searx.example.test/search')));
  });
});

test('falla cerrado cuando no existe evidencia viva',async()=>{
  const failingFetch=async()=>{throw new Error('network_down')};
  const failingSearch=async()=>{throw new Error('search_down')};
  const live=await retrieveLiveData({
    message:'breaking live status unique-v58-test-2',mode:'research',force:true,fetchImpl:failingFetch,webSearch:failingSearch
  });
  assert.equal(live.used,true);
  assert.equal(live.evidenceReady,false);
  assert.equal(live.failClosed,true);
  assert.equal(live.sourceCount,0);
  assert.match(formatLiveDataContext(live),/no se recuperó evidencia reciente verificable/i);
});
