import { createHash } from 'node:crypto';

export const TOOL_FABRIC_VERSION='universal-tool-fabric/v65-github-intelligence';
export const TOOL_CONTRACT_SCHEMA='universal-tool-contract/v1';

const text=(value,max=500)=>String(value??'').trim().slice(0,max);
const bool=(value)=>Boolean(value);
const sha256=(value)=>createHash('sha256').update(String(value??'')).digest('hex');

const configured={
  tavily:()=>bool(process.env.TAVILY_API_KEY),
  github:()=>bool(process.env.GITHUB_TOKEN),
  supabase:()=>bool(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),
  local:()=>true,
  disabled:()=>false,
};

export const TOOL_DEFINITIONS=Object.freeze([
  {
    id:'web.search',version:'1.0.0',provider:'tavily',capabilities:['web_search','deep_research'],actions:['search'],
    riskLevel:'low',sideEffect:'read',approval:'none',tenantScope:'session',timeoutMs:30000,maxInputChars:12000,
    input:{type:'object',required:['query'],properties:{query:{type:'string',maxLength:12000}}},
    output:{type:'object',properties:{sources:{type:'array',maxItems:12}}},
    tags:['web','research','read'],
  },
  {
    id:'github.code_search',version:'1.0.0',provider:'github',capabilities:['software_engineering'],actions:['search_code'],
    riskLevel:'low',sideEffect:'read',approval:'none',tenantScope:'session',timeoutMs:30000,maxInputChars:12000,
    input:{type:'object',required:['query'],properties:{query:{type:'string',maxLength:12000},repository:{type:'string',maxLength:240}}},
    output:{type:'object',properties:{matches:{type:'array',maxItems:20}}},
    tags:['github','code','read'],
  },
  {
    id:'github.repository_evaluate',version:'1.0.0',provider:'github',capabilities:['software_engineering'],actions:['evaluate_repository'],
    riskLevel:'low',sideEffect:'read',approval:'none',tenantScope:'session',timeoutMs:30000,maxInputChars:5000,
    input:{type:'object',required:['repository'],properties:{repository:{type:'string',maxLength:300},strategicNeed:{type:'string',maxLength:1200}}},
    output:{type:'object',properties:{schema:{type:'string'},repository:{type:'object'},gates:{type:'object'},score:{type:'object'},registryCandidate:{type:'object'}}},
    tags:['github','open-source','repository','license','supply-chain','read'],
  },
  {
    id:'memory.recall',version:'1.0.0',provider:'supabase',capabilities:['memory','projects','personalization'],actions:['recall'],
    riskLevel:'low',sideEffect:'read',approval:'none',tenantScope:'user',timeoutMs:12000,maxInputChars:12000,
    input:{type:'object',required:['query'],properties:{query:{type:'string',maxLength:12000},limit:{type:'integer',minimum:1,maximum:12}}},
    output:{type:'object',properties:{items:{type:'array',maxItems:12}}},
    tags:['memory','context','read'],
  },
  {
    id:'intent.execute_ir',version:'1.0.0',provider:'supabase',capabilities:['work_mode','multiagent_engineering'],actions:['execute_intent'],
    riskLevel:'low',sideEffect:'none',approval:'none',tenantScope:'session',timeoutMs:35000,maxInputChars:30000,
    input:{type:'object',required:['task'],properties:{task:{type:'string',maxLength:30000}}},
    output:{type:'object',properties:{content:{type:'string'},attestation:{type:'object'}}},
    tags:['planning','compute','deterministic'],
  },
  {
    id:'text.inspect',version:'1.0.0',provider:'local',capabilities:['file_analysis','conversation_reasoning'],actions:['inspect_text'],
    riskLevel:'low',sideEffect:'none',approval:'none',tenantScope:'session',timeoutMs:1500,maxInputChars:120000,
    input:{type:'object',required:['content'],properties:{content:{type:'string',maxLength:120000},name:{type:'string',maxLength:240}}},
    output:{type:'object',properties:{name:{type:'string'},characters:{type:'integer'},lines:{type:'integer'},words:{type:'integer'},sha256:{type:'string'},preview:{type:'string'}}},
    tags:['file','text','local','compute'],
  },
  {
    id:'data.csv_profile',version:'1.0.0',provider:'local',capabilities:['advanced_data_analysis','file_analysis','spreadsheets'],actions:['profile_csv'],
    riskLevel:'low',sideEffect:'none',approval:'none',tenantScope:'session',timeoutMs:2500,maxInputChars:200000,
    input:{type:'object',required:['content'],properties:{content:{type:'string',maxLength:200000},delimiter:{type:'string',maxLength:1}}},
    output:{type:'object',properties:{rows:{type:'integer'},columns:{type:'integer'},headers:{type:'array'},sample:{type:'array'},nullCounts:{type:'object'}}},
    tags:['csv','data','local','compute'],
  },
  {
    id:'computer.control',version:'0.0.0',provider:'disabled',capabilities:['computer_use'],actions:['click','type','navigate'],
    riskLevel:'critical',sideEffect:'external_write',approval:'human',tenantScope:'session',timeoutMs:0,maxInputChars:0,
    input:{type:'object'},output:{type:'object'},tags:['blocked','computer-use'],
  },
  {
    id:'browser.cloud',version:'0.0.0',provider:'disabled',capabilities:['cloud_browser'],actions:['open','click','form_submit'],
    riskLevel:'high',sideEffect:'external_write',approval:'human',tenantScope:'session',timeoutMs:0,maxInputChars:0,
    input:{type:'object'},output:{type:'object'},tags:['blocked','browser'],
  },
  {
    id:'terminal.exec',version:'0.0.0',provider:'disabled',capabilities:['terminal_code_execution'],actions:['exec'],
    riskLevel:'critical',sideEffect:'write',approval:'human',tenantScope:'session',timeoutMs:0,maxInputChars:0,
    input:{type:'object'},output:{type:'object'},tags:['blocked','terminal'],
  },
]);

function providerConfigured(provider){return (configured[provider]||configured.disabled)()}

function publicDefinition(tool){
  const isConfigured=providerConfigured(tool.provider);
  return{
    schema:TOOL_CONTRACT_SCHEMA,
    id:tool.id,version:tool.version,provider:tool.provider,capabilities:[...tool.capabilities],actions:[...tool.actions],
    riskLevel:tool.riskLevel,sideEffect:tool.sideEffect,approval:tool.approval,tenantScope:tool.tenantScope,
    timeoutMs:tool.timeoutMs,maxInputChars:tool.maxInputChars,input:tool.input,output:tool.output,tags:[...tool.tags],
    configured:isConfigured,enabled:isConfigured&&tool.provider!=='disabled',
    contractHash:sha256(JSON.stringify({id:tool.id,version:tool.version,input:tool.input,output:tool.output,actions:tool.actions,sideEffect:tool.sideEffect,approval:tool.approval})),
  };
}

export function toolFabricSnapshot(){
  const tools=TOOL_DEFINITIONS.map(publicDefinition);
  return{
    version:TOOL_FABRIC_VERSION,
    contractSchema:TOOL_CONTRACT_SCHEMA,
    policy:{failClosed:true,defaultDeny:true,mutationsEnabled:false,clientApprovalTrusted:false,toolOutputIsUntrusted:true,rawSecretsExposed:false},
    toolCount:tools.length,
    configuredToolCount:tools.filter((tool)=>tool.configured).length,
    enabledToolCount:tools.filter((tool)=>tool.enabled).length,
    blockedToolCount:tools.filter((tool)=>tool.provider==='disabled').length,
    tools,
  };
}

export function getToolDefinition(id){
  const wanted=text(id,160).toLowerCase();
  const tool=TOOL_DEFINITIONS.find((item)=>item.id===wanted);
  return tool?publicDefinition(tool):null;
}

export function resolveTool(capability,action){
  const cap=text(capability,120).toLowerCase();
  const requested=text(action,120).toLowerCase();
  const candidates=TOOL_DEFINITIONS.filter((tool)=>tool.capabilities.includes(cap)&&(requested?tool.actions.includes(requested):true));
  const enabled=candidates.find((tool)=>providerConfigured(tool.provider)&&tool.provider!=='disabled');
  const selected=enabled||candidates[0]||null;
  return selected?publicDefinition(selected):null;
}

export function validateToolInput(toolId,payload={}){
  const tool=TOOL_DEFINITIONS.find((item)=>item.id===text(toolId,160).toLowerCase());
  if(!tool)return{ok:false,error:'tool_not_found'};
  const input=payload&&typeof payload==='object'?payload:{};
  const required=Array.isArray(tool.input?.required)?tool.input.required:[];
  for(const key of required){if(input[key]===undefined||input[key]===null||input[key]==='')return{ok:false,error:'tool_input_required',field:key}}
  for(const [key,rule] of Object.entries(tool.input?.properties||{})){
    if(input[key]===undefined||input[key]===null)continue;
    if(rule.type==='string'&&typeof input[key]!=='string')return{ok:false,error:'tool_input_type',field:key,expected:'string'};
    if(rule.type==='integer'&&!Number.isInteger(input[key]))return{ok:false,error:'tool_input_type',field:key,expected:'integer'};
    if(typeof rule.maxLength==='number'&&String(input[key]).length>rule.maxLength)return{ok:false,error:'tool_input_too_large',field:key,maxLength:rule.maxLength};
    if(typeof rule.minimum==='number'&&Number(input[key])<rule.minimum)return{ok:false,error:'tool_input_range',field:key};
    if(typeof rule.maximum==='number'&&Number(input[key])>rule.maximum)return{ok:false,error:'tool_input_range',field:key};
  }
  const total=JSON.stringify(input).length;
  if(tool.maxInputChars>0&&total>tool.maxInputChars)return{ok:false,error:'tool_payload_too_large',maxInputChars:tool.maxInputChars};
  return{ok:true,tool:publicDefinition(tool)};
}

function splitCsvLine(line,delimiter){
  const values=[];let current='';let quoted=false;
  for(let i=0;i<line.length;i+=1){
    const char=line[i];
    if(char==='"'){
      if(quoted&&line[i+1]==='"'){current+='"';i+=1}else quoted=!quoted;
      continue;
    }
    if(char===delimiter&&!quoted){values.push(current);current='';continue}
    current+=char;
  }
  values.push(current);return values;
}

export function inspectText({content,name='document.txt'}={}){
  const value=String(content??'').slice(0,120000);
  const lines=value?value.split(/\r?\n/):[];
  const words=(value.match(/\S+/g)||[]).length;
  return{name:text(name,240)||'document.txt',characters:value.length,lines:lines.length,words,sha256:sha256(value),preview:value.slice(0,1200)};
}

export function profileCsv({content,delimiter=','}={}){
  const value=String(content??'').slice(0,200000);
  const sep=String(delimiter||',').slice(0,1)||',';
  const lines=value.split(/\r?\n/).filter((line)=>line.length>0).slice(0,5000);
  if(!lines.length)return{rows:0,columns:0,headers:[],sample:[],nullCounts:{}};
  const matrix=lines.map((line)=>splitCsvLine(line,sep));
  const headers=matrix[0].map((header,index)=>text(header,160)||`column_${index+1}`);
  const rows=matrix.slice(1);
  const nullCounts=Object.fromEntries(headers.map((header,index)=>[header,rows.reduce((count,row)=>count+((row[index]??'').trim()===''?1:0),0)]));
  const sample=rows.slice(0,5).map((row)=>Object.fromEntries(headers.map((header,index)=>[header,row[index]??''])));
  return{rows:rows.length,columns:headers.length,headers,sample,nullCounts,truncated:lines.length>=5000};
}
