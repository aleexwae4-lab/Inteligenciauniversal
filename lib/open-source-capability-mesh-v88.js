export const OPEN_SOURCE_CAPABILITY_MESH_VERSION='open-source-capability-mesh/v88';
export const OPEN_SOURCE_TOOL_CONTRACT='open-source-tool-contract/v1';

const text=(value,max=4000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const bool=(value)=>Boolean(value);
const arr=(value)=>Array.isArray(value)?value:[];
const baseUrl=(value)=>String(value||'').trim().replace(/\/$/,'');
const clamp=(value,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):fallback));

const PROJECTS=Object.freeze([
  {id:'searxng',name:'SearXNG',repo:'searxng/searxng',license:'AGPL-3.0-or-later',class:'metasearch',capabilities:['web_search','deep_research'],activation:'SEARXNG_BASE_URL',commercialUse:true,networkCopyleft:true},
  {id:'ollama',name:'Ollama',repo:'ollama/ollama',license:'MIT',class:'local_model_runtime',capabilities:['conversation_reasoning','embeddings','local_inference'],activation:'OLLAMA_BASE_URL',commercialUse:true},
  {id:'llama_cpp',name:'llama.cpp',repo:'ggml-org/llama.cpp',license:'MIT',class:'local_model_runtime',capabilities:['conversation_reasoning','local_inference'],activation:'LLAMACPP_BASE_URL',commercialUse:true},
  {id:'qdrant',name:'Qdrant',repo:'qdrant/qdrant',license:'Apache-2.0',class:'vector_database',capabilities:['vector_search','memory','knowledge_retrieval'],activation:'QDRANT_URL',commercialUse:true},
  {id:'meilisearch',name:'Meilisearch Community Edition',repo:'meilisearch/meilisearch',license:'MIT',class:'search_engine',capabilities:['full_text_search','knowledge_retrieval'],activation:'MEILI_URL',commercialUse:true,edition:'community'},
  {id:'mcp_typescript',name:'Model Context Protocol TypeScript SDK',repo:'modelcontextprotocol/typescript-sdk',license:'Apache-2.0/MIT',class:'tool_protocol',capabilities:['mcp_external_tools','connected_apps'],activation:'MCP_SERVER_URL',commercialUse:true},
  {id:'playwright',name:'Playwright',repo:'microsoft/playwright',license:'Apache-2.0',class:'browser_automation',capabilities:['cloud_browser','computer_use'],activation:'PLAYWRIGHT_SERVICE_URL',commercialUse:true,runtimeRequired:true},
  {id:'tesseract',name:'Tesseract OCR',repo:'tesseract-ocr/tesseract',license:'Apache-2.0',class:'ocr',capabilities:['ocr','vision','file_analysis'],activation:'TESSERACT_SERVICE_URL',commercialUse:true,runtimeRequired:true},
  {id:'docling',name:'Docling',repo:'docling-project/docling',license:'MIT',class:'document_intelligence',capabilities:['file_analysis','document_ingestion','knowledge_retrieval'],activation:'DOCLING_SERVICE_URL',commercialUse:true,runtimeRequired:true,modelLicensesSeparate:true},
  {id:'tree_sitter',name:'Tree-sitter',repo:'tree-sitter/tree-sitter',license:'MIT',class:'code_parser',capabilities:['software_engineering','code_analysis'],activation:'TREE_SITTER_SERVICE_URL',commercialUse:true,runtimeRequired:true},
  {id:'whisper_cpp',name:'whisper.cpp',repo:'ggml-org/whisper.cpp',license:'MIT',class:'speech_to_text',capabilities:['voice','transcription'],activation:'WHISPER_CPP_SERVICE_URL',commercialUse:true,runtimeRequired:true},
  {id:'vllm',name:'vLLM',repo:'vllm-project/vllm',license:'Apache-2.0',class:'model_serving',capabilities:['conversation_reasoning','local_inference'],activation:'VLLM_BASE_URL',commercialUse:true,runtimeRequired:true},
  {id:'transformers',name:'Transformers',repo:'huggingface/transformers',license:'Apache-2.0',class:'model_runtime',capabilities:['local_inference','embeddings','vision','audio'],activation:'HF_LOCAL_RUNTIME_URL',commercialUse:true,runtimeRequired:true,modelLicensesSeparate:true},
  {id:'duckdb',name:'DuckDB',repo:'duckdb/duckdb',license:'MIT',class:'analytics_database',capabilities:['advanced_data_analysis','sql_analytics'],activation:'DUCKDB_SERVICE_URL',commercialUse:true,runtimeRequired:true},
  {id:'apache_tika',name:'Apache Tika',repo:'apache/tika',license:'Apache-2.0',class:'document_parser',capabilities:['file_analysis','document_ingestion'],activation:'TIKA_SERVICE_URL',commercialUse:true,runtimeRequired:true},
]);

const TOOL_DEFINITIONS=Object.freeze([
  {id:'oss.searxng.search',project:'searxng',capabilities:['web_search','deep_research'],actions:['search'],riskLevel:'low',sideEffect:'read',approval:'none',timeoutMs:15000,maxInputChars:12000,input:{required:['query']}},
  {id:'oss.ollama.chat',project:'ollama',capabilities:['conversation_reasoning','local_inference'],actions:['chat'],riskLevel:'low',sideEffect:'none',approval:'none',timeoutMs:45000,maxInputChars:30000,input:{required:['prompt']}},
  {id:'oss.ollama.embed',project:'ollama',capabilities:['embeddings'],actions:['embed'],riskLevel:'low',sideEffect:'none',approval:'none',timeoutMs:30000,maxInputChars:50000,input:{required:['input']}},
  {id:'oss.llamacpp.chat',project:'llama_cpp',capabilities:['conversation_reasoning','local_inference'],actions:['chat'],riskLevel:'low',sideEffect:'none',approval:'none',timeoutMs:45000,maxInputChars:30000,input:{required:['prompt']}},
  {id:'oss.qdrant.query',project:'qdrant',capabilities:['vector_search','memory','knowledge_retrieval'],actions:['query'],riskLevel:'low',sideEffect:'read',approval:'none',timeoutMs:15000,maxInputChars:200000,input:{required:['vector']}},
  {id:'oss.meilisearch.search',project:'meilisearch',capabilities:['full_text_search','knowledge_retrieval'],actions:['search'],riskLevel:'low',sideEffect:'read',approval:'none',timeoutMs:12000,maxInputChars:12000,input:{required:['query']}},
  {id:'oss.mcp.discover',project:'mcp_typescript',capabilities:['mcp_external_tools','connected_apps'],actions:['discover'],riskLevel:'low',sideEffect:'read',approval:'none',timeoutMs:12000,maxInputChars:2000,input:{required:[]}},
  {id:'oss.mcp.call_read',project:'mcp_typescript',capabilities:['mcp_external_tools','connected_apps'],actions:['call_read'],riskLevel:'medium',sideEffect:'read',approval:'none',timeoutMs:20000,maxInputChars:20000,input:{required:['name']}},
]);

const projectById=(id)=>PROJECTS.find(project=>project.id===id)||null;
const envConfigured=(name)=>bool(name&&process.env[name]);

export function openSourceProjects(){
  return PROJECTS.map(project=>({
    ...project,
    configured:envConfigured(project.activation),
    enabled:envConfigured(project.activation)&&project.runtimeRequired!==true,
    zeroLicenseCost:true,
    apiFeeRequired:false,
  }));
}

function publicTool(tool){
  const project=projectById(tool.project);
  const configured=Boolean(project&&envConfigured(project.activation));
  return{
    schema:OPEN_SOURCE_TOOL_CONTRACT,
    id:tool.id,
    provider:`oss:${tool.project}`,
    project:tool.project,
    repository:project?.repo||null,
    license:project?.license||'unknown',
    capabilities:[...tool.capabilities],
    actions:[...tool.actions],
    riskLevel:tool.riskLevel,
    sideEffect:tool.sideEffect,
    approval:tool.approval,
    timeoutMs:tool.timeoutMs,
    maxInputChars:tool.maxInputChars,
    configured,
    enabled:configured,
    zeroLicenseCost:true,
    apiFeeRequired:false,
  };
}

export function openSourceMeshSnapshot(){
  const projects=openSourceProjects();
  const tools=TOOL_DEFINITIONS.map(publicTool);
  return{
    version:OPEN_SOURCE_CAPABILITY_MESH_VERSION,
    contract:OPEN_SOURCE_TOOL_CONTRACT,
    policy:{zeroLicenseCostOnly:true,noPaidApiRequired:true,failClosed:true,unconfiguredNeverAdvertisedAsActive:true,networkCopyleftDeclared:true,modelLicensesCheckedSeparately:true,mutationsEnabled:false},
    projectCount:projects.length,
    configuredProjectCount:projects.filter(item=>item.configured).length,
    activeProjectCount:projects.filter(item=>item.enabled).length,
    executableToolCount:tools.length,
    configuredToolCount:tools.filter(item=>item.configured).length,
    projects,
    tools,
  };
}

export function getOpenSourceToolDefinition(id){
  const wanted=String(id||'').trim().toLowerCase();
  const tool=TOOL_DEFINITIONS.find(item=>item.id===wanted);
  return tool?publicTool(tool):null;
}

export function resolveOpenSourceTool(capability,action=''){
  const cap=String(capability||'').trim().toLowerCase();
  const act=String(action||'').trim().toLowerCase();
  const candidates=TOOL_DEFINITIONS.filter(item=>item.capabilities.includes(cap)&&(!act||item.actions.includes(act)));
  const configured=candidates.find(item=>publicTool(item).configured);
  return publicTool(configured||candidates[0]||null);
}

export function validateOpenSourceToolInput(toolId,input={}){
  const raw=TOOL_DEFINITIONS.find(item=>item.id===String(toolId||'').trim().toLowerCase());
  if(!raw)return{ok:false,error:'oss_tool_not_found'};
  const payload=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  for(const key of raw.input?.required||[]){
    const value=payload[key];
    if(value===undefined||value===null||value==='')return{ok:false,error:'oss_tool_input_required',field:key};
  }
  if(raw.id==='oss.qdrant.query'&&(!Array.isArray(payload.vector)||!payload.vector.length||payload.vector.some(value=>!Number.isFinite(Number(value)))))return{ok:false,error:'oss_vector_required',field:'vector'};
  if(JSON.stringify(payload).length>raw.maxInputChars)return{ok:false,error:'oss_tool_payload_too_large',maxInputChars:raw.maxInputChars};
  return{ok:true,tool:publicTool(raw)};
}

async function fetchJson(url,options={},timeoutMs=15000,fetchImpl=fetch){
  const response=await fetchImpl(url,{...options,signal:options.signal||AbortSignal.timeout(timeoutMs)});
  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{data={raw:text(raw,12000)}}
  if(!response.ok)throw Object.assign(new Error(text(data?.error?.message||data?.error||data?.message||`http_${response.status}`,500)),{status:response.status,data});
  return{data,response};
}

function normalizeSearch(items=[],limit=8){
  return arr(items).slice(0,limit).map(item=>({
    title:text(item?.title||item?.name||'Resultado',500),
    url:text(item?.url||item?.link||'',1800),
    snippet:text(item?.content||item?.snippet||item?.text||'',1800),
    score:Number.isFinite(Number(item?.score))?Number(item.score):null,
    engine:text(item?.engine||item?.source||'',120)||null,
  })).filter(item=>/^https?:\/\//i.test(item.url));
}

async function executeSearxng(input,fetchImpl){
  const base=baseUrl(process.env.SEARXNG_BASE_URL);
  const params=new URLSearchParams({q:text(input.query,12000),format:'json'});
  if(input.language)params.set('language',text(input.language,20));
  if(input.categories)params.set('categories',text(input.categories,120));
  if(input.time_range)params.set('time_range',text(input.time_range,20));
  const {data}=await fetchJson(`${base}/search?${params}`,{headers:{Accept:'application/json','User-Agent':'WAE-Universal-Core/88'}},15000,fetchImpl);
  const limit=clamp(input.limit,1,12,8);
  return{results:normalizeSearch(data?.results,limit),suggestions:arr(data?.suggestions).slice(0,8).map(value=>text(value,200)),query:text(input.query,12000),engine:'searxng'};
}

async function executeOllamaChat(input,fetchImpl){
  const base=baseUrl(process.env.OLLAMA_BASE_URL);
  const model=text(input.model||process.env.OLLAMA_MODEL,200);
  if(!model)throw new Error('OLLAMA_MODEL no configurado');
  const messages=[];
  if(input.system)messages.push({role:'system',content:text(input.system,12000)});
  messages.push({role:'user',content:text(input.prompt,30000)});
  const {data}=await fetchJson(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages,stream:false,options:input.options&&typeof input.options==='object'?input.options:undefined})},45000,fetchImpl);
  const content=text(data?.message?.content||data?.response||'',50000);
  if(!content)throw new Error('ollama_empty_response');
  return{content,model:data?.model||model,done:data?.done===true,prompt_eval_count:data?.prompt_eval_count||null,eval_count:data?.eval_count||null};
}

async function executeOllamaEmbed(input,fetchImpl){
  const base=baseUrl(process.env.OLLAMA_BASE_URL);
  const model=text(input.model||process.env.OLLAMA_EMBED_MODEL||process.env.OLLAMA_MODEL,200);
  if(!model)throw new Error('OLLAMA_EMBED_MODEL no configurado');
  const payload={model,input:Array.isArray(input.input)?input.input.map(value=>text(value,20000)):text(input.input,50000)};
  const {data}=await fetchJson(`${base}/api/embed`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},30000,fetchImpl);
  const embeddings=arr(data?.embeddings);
  if(!embeddings.length)throw new Error('ollama_embedding_empty');
  return{model:data?.model||model,embeddings,dimensions:Array.isArray(embeddings[0])?embeddings[0].length:null};
}

async function executeLlamaCpp(input,fetchImpl){
  const base=baseUrl(process.env.LLAMACPP_BASE_URL);
  const model=text(input.model||process.env.LLAMACPP_MODEL||'local',200);
  const messages=[];
  if(input.system)messages.push({role:'system',content:text(input.system,12000)});
  messages.push({role:'user',content:text(input.prompt,30000)});
  const headers={'Content-Type':'application/json'};
  if(process.env.LLAMACPP_API_KEY)headers.Authorization=`Bearer ${process.env.LLAMACPP_API_KEY}`;
  const {data}=await fetchJson(`${base}/v1/chat/completions`,{method:'POST',headers,body:JSON.stringify({model,messages,stream:false,temperature:Number.isFinite(Number(input.temperature))?Number(input.temperature):0.2})},45000,fetchImpl);
  const content=text(data?.choices?.[0]?.message?.content||'',50000);
  if(!content)throw new Error('llamacpp_empty_response');
  return{content,model:data?.model||model,usage:data?.usage||null};
}

async function executeQdrant(input,fetchImpl){
  const base=baseUrl(process.env.QDRANT_URL);
  const collection=text(input.collection||process.env.QDRANT_COLLECTION,240);
  if(!collection)throw new Error('QDRANT_COLLECTION no configurado');
  const headers={'Content-Type':'application/json'};
  if(process.env.QDRANT_API_KEY)headers['api-key']=process.env.QDRANT_API_KEY;
  const limit=clamp(input.limit,1,30,8);
  const body={query:input.vector.map(Number),limit,with_payload:input.with_payload!==false,with_vector:false};
  let response;
  try{
    response=await fetchJson(`${base}/collections/${encodeURIComponent(collection)}/points/query`,{method:'POST',headers,body:JSON.stringify(body)},15000,fetchImpl);
  }catch(error){
    if(Number(error?.status)!==404)throw error;
    response=await fetchJson(`${base}/collections/${encodeURIComponent(collection)}/points/search`,{method:'POST',headers,body:JSON.stringify({vector:body.query,limit,with_payload:body.with_payload,with_vector:false})},15000,fetchImpl);
  }
  const raw=response.data?.result?.points||response.data?.result||[];
  return{collection,points:arr(raw).slice(0,limit).map(item=>({id:item?.id,score:Number(item?.score??0),payload:item?.payload||null}))};
}

async function executeMeili(input,fetchImpl){
  const base=baseUrl(process.env.MEILI_URL);
  const index=text(input.index||process.env.MEILI_INDEX,240);
  if(!index)throw new Error('MEILI_INDEX no configurado');
  const headers={'Content-Type':'application/json'};
  if(process.env.MEILI_MASTER_KEY)headers.Authorization=`Bearer ${process.env.MEILI_MASTER_KEY}`;
  const limit=clamp(input.limit,1,30,10);
  const {data}=await fetchJson(`${base}/indexes/${encodeURIComponent(index)}/search`,{method:'POST',headers,body:JSON.stringify({q:text(input.query,12000),limit,attributesToHighlight:[]})},12000,fetchImpl);
  return{index,hits:arr(data?.hits).slice(0,limit),estimatedTotalHits:Number(data?.estimatedTotalHits||0),processingTimeMs:Number(data?.processingTimeMs||0)};
}

function parseMcpPayload(raw=''){
  const value=String(raw||'').trim();
  if(!value)return{};
  try{return JSON.parse(value)}catch{}
  const dataLines=value.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).filter(Boolean);
  for(const line of dataLines){try{return JSON.parse(line)}catch{}}
  return{raw:text(value,12000)};
}

async function mcpPost(endpoint,payload,sessionId,fetchImpl){
  const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'};
  if(sessionId)headers['Mcp-Session-Id']=sessionId;
  if(process.env.MCP_AUTH_TOKEN)headers.Authorization=`Bearer ${process.env.MCP_AUTH_TOKEN}`;
  const response=await fetchImpl(endpoint,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
  const raw=await response.text();
  if(!response.ok)throw Object.assign(new Error(`mcp_http_${response.status}`),{status:response.status});
  return{data:parseMcpPayload(raw),sessionId:response.headers?.get?.('mcp-session-id')||sessionId||null};
}

async function initMcp(fetchImpl){
  const endpoint=baseUrl(process.env.MCP_SERVER_URL);
  const initialized=await mcpPost(endpoint,{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2026-07-28',capabilities:{},clientInfo:{name:'WAE Universal Core',version:'88'}}},null,fetchImpl);
  const sessionId=initialized.sessionId;
  await mcpPost(endpoint,{jsonrpc:'2.0',method:'notifications/initialized',params:{}},sessionId,fetchImpl).catch(()=>null);
  return{endpoint,sessionId,initialize:initialized.data};
}

async function executeMcpDiscover(input,fetchImpl){
  const initialized=await initMcp(fetchImpl);
  const listed=await mcpPost(initialized.endpoint,{jsonrpc:'2.0',id:2,method:'tools/list',params:{}},initialized.sessionId,fetchImpl);
  const tools=arr(listed.data?.result?.tools).slice(0,100).map(tool=>({name:text(tool?.name,180),description:text(tool?.description,1200),inputSchema:tool?.inputSchema||null,annotations:tool?.annotations||null}));
  return{serverInfo:initialized.initialize?.result?.serverInfo||null,protocolVersion:initialized.initialize?.result?.protocolVersion||null,tools};
}

function readOnlyAllowlist(){
  return new Set(String(process.env.MCP_READ_ONLY_TOOLS||'').split(',').map(value=>value.trim()).filter(Boolean));
}

async function executeMcpRead(input,fetchImpl){
  const name=text(input.name,180);
  if(!readOnlyAllowlist().has(name))throw Object.assign(new Error('mcp_tool_not_read_only_allowlisted'),{code:'MCP_TOOL_NOT_ALLOWLISTED'});
  const initialized=await initMcp(fetchImpl);
  const called=await mcpPost(initialized.endpoint,{jsonrpc:'2.0',id:3,method:'tools/call',params:{name,arguments:input.arguments&&typeof input.arguments==='object'?input.arguments:{}}},initialized.sessionId,fetchImpl);
  if(called.data?.error)throw new Error(text(called.data.error?.message||'mcp_tool_error',500));
  return{tool:name,result:called.data?.result||null};
}

const EXECUTORS={
  'oss.searxng.search':executeSearxng,
  'oss.ollama.chat':executeOllamaChat,
  'oss.ollama.embed':executeOllamaEmbed,
  'oss.llamacpp.chat':executeLlamaCpp,
  'oss.qdrant.query':executeQdrant,
  'oss.meilisearch.search':executeMeili,
  'oss.mcp.discover':executeMcpDiscover,
  'oss.mcp.call_read':executeMcpRead,
};

export async function executeOpenSourceTool(toolId,input={},options={}){
  const definition=getOpenSourceToolDefinition(toolId);
  if(!definition)return{success:false,status:'blocked',error:'oss_tool_not_found'};
  if(!definition.configured)return{success:false,status:'blocked',error:'oss_tool_unconfigured',tool:definition};
  const validation=validateOpenSourceToolInput(toolId,input);
  if(!validation.ok)return{success:false,status:'blocked',error:validation.error,field:validation.field||null,tool:definition};
  const executor=EXECUTORS[definition.id];
  if(!executor)return{success:false,status:'blocked',error:'oss_executor_not_implemented',tool:definition};
  const started=Date.now();
  try{
    const result=await executor(input,options.fetchImpl||fetch);
    return{success:true,status:'completed',tool:definition,result,latency_ms:Date.now()-started};
  }catch(error){
    return{success:false,status:'failed',error:text(error?.code||error?.message||'oss_tool_failed',300),http_status:Number(error?.status)||null,tool:definition,latency_ms:Date.now()-started};
  }
}
