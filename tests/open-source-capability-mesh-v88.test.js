import test from 'node:test';
import assert from 'node:assert/strict';
import { openSourceMeshSnapshot, executeOpenSourceTool, getOpenSourceToolDefinition, OPEN_SOURCE_CAPABILITY_MESH_VERSION } from '../lib/open-source-capability-mesh-v88.js';
import { toolFabricSnapshot, resolveTool, TOOL_FABRIC_V88_VERSION } from '../lib/tool-fabric-v88.js';
import { executeCapability, executionPlaneSnapshot, EXECUTION_PLANE_V88_VERSION } from '../lib/execution-plane-v88.js';

function jsonResponse(payload,{status=200,headers={}}={}){
  const lower=Object.fromEntries(Object.entries(headers).map(([key,value])=>[key.toLowerCase(),value]));
  return{
    ok:status>=200&&status<300,status,
    async text(){return JSON.stringify(payload)},
    headers:{get(name){return lower[String(name).toLowerCase()]??null}},
  };
}

async function withEnv(values,work){
  const previous={};
  for(const [key,value] of Object.entries(values)){previous[key]=process.env[key];if(value===null||value===undefined)delete process.env[key];else process.env[key]=String(value)}
  try{return await work()}finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
}

test('v88 registers a zero-license-cost open-source capability portfolio without claiming inactive runtimes',()=>{
  const mesh=openSourceMeshSnapshot();
  assert.equal(mesh.version,OPEN_SOURCE_CAPABILITY_MESH_VERSION);
  assert.equal(mesh.policy.zeroLicenseCostOnly,true);
  assert.equal(mesh.policy.noPaidApiRequired,true);
  assert.ok(mesh.projectCount>=15);
  assert.ok(mesh.executableToolCount>=8);
  for(const project of mesh.projects){
    assert.equal(project.zeroLicenseCost,true);
    assert.equal(project.apiFeeRequired,false);
    assert.ok(project.repo.includes('/'));
    assert.ok(project.license);
  }
  for(const id of ['searxng','ollama','llama_cpp','qdrant','meilisearch','mcp_typescript','playwright','tesseract','docling','tree_sitter']){
    assert.ok(mesh.projects.some(project=>project.id===id),id);
  }
});

test('v88 tool fabric preserves the base fabric and appends OSS tools',()=>{
  const fabric=toolFabricSnapshot();
  assert.equal(fabric.version,TOOL_FABRIC_V88_VERSION);
  assert.equal(fabric.policy.zeroCostOpenSourcePreferred,true);
  assert.equal(fabric.policy.paidApiAutoActivation,false);
  assert.ok(fabric.tools.some(tool=>tool.id==='text.inspect'));
  assert.ok(fabric.tools.some(tool=>tool.id==='oss.searxng.search'));
  assert.ok(fabric.tools.some(tool=>tool.id==='oss.ollama.chat'));
  assert.equal(getOpenSourceToolDefinition('oss.qdrant.query')?.sideEffect,'read');
});

test('unknown capability falls back safely instead of crashing the v88 router',()=>{
  assert.doesNotThrow(()=>resolveTool('capability_that_does_not_exist','none'));
  assert.equal(resolveTool('capability_that_does_not_exist','none'),null);
});

test('configured SearXNG becomes the preferred zero-cost web-search route and executes through a fake transport',async()=>{
  await withEnv({SEARXNG_BASE_URL:'https://searx.example.test'},async()=>{
    const route=resolveTool('web_search','search');
    assert.equal(route?.id,'oss.searxng.search');
    const calls=[];
    const result=await executeOpenSourceTool('oss.searxng.search',{query:'Universal Core',limit:2},{fetchImpl:async(url)=>{
      calls.push(String(url));
      return jsonResponse({results:[
        {title:'Result A',url:'https://example.com/a',content:'A',score:0.9},
        {title:'Result B',url:'https://example.com/b',content:'B',score:0.8},
      ]});
    }});
    assert.equal(result.success,true);
    assert.equal(result.result.results.length,2);
    assert.match(calls[0],/format=json/);
    assert.match(calls[0],/q=Universal\+Core/);
  });
});

test('explicit Ollama tool execution is routed by the v88 execution plane without paid API dependency',async()=>{
  await withEnv({OLLAMA_BASE_URL:'http://ollama.test',OLLAMA_MODEL:'qwen-local'},async()=>{
    const execution=await executeCapability({
      toolId:'oss.ollama.chat',
      capability:'conversation_reasoning',
      action:'chat',
      task:'Explica la arquitectura',
      input:{prompt:'Explica la arquitectura'},
      userKey:'u-v88',sessionId:'s-v88',
      fetchImpl:async(url,options)=>{
        assert.equal(String(url),'http://ollama.test/api/chat');
        const body=JSON.parse(options.body);
        assert.equal(body.model,'qwen-local');
        return jsonResponse({model:'qwen-local',message:{content:'Respuesta local verificada por transporte.'},done:true});
      },
    });
    assert.equal(execution.success,true);
    assert.equal(execution.result.content,'Respuesta local verificada por transporte.');
    assert.equal(execution.tool.apiFeeRequired,false);
    assert.equal(execution.receipt.side_effect,'none');
  });
});

test('v88 execution plane exposes OSS adapters but keeps unconfigured services inactive',()=>{
  const plane=executionPlaneSnapshot();
  assert.equal(plane.version,EXECUTION_PLANE_V88_VERSION);
  assert.equal(plane.policy.zeroCostOpenSourcePreferred,true);
  assert.ok(plane.adapters.some(adapter=>adapter.toolId==='oss.mcp.discover'));
  const playwright=plane.openSource.projects.find(project=>project.id==='playwright');
  assert.ok(playwright);
  if(!process.env.PLAYWRIGHT_SERVICE_URL)assert.equal(playwright.enabled,false);
});
