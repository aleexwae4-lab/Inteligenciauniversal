import crypto from 'node:crypto';
import { toolRegistry, executeTool } from './tools.js';

export const TOOL_FABRIC_VERSION='universal-tool-fabric/v1';
const MAX_TOOLS=3;

const INTENT_RULES=[
  {tool:'web_search',match:/\b(actual|actualidad|hoy|reciente|últim[oa]s?|noticia|mercado|precio|ley|jurisprudencia|norma|fuente|fuentes|investiga|investigación|web|buscar|verifica|evidencia)\b/i},
  {tool:'github_search',match:/\b(github|repo|repositorio|código|codigo|archivo|función|funcion|backend|frontend|api|bug|deploy|render|supabase|vercel|javascript|typescript|node|python)\b/i},
];

const hash=value=>crypto.createHash('sha256').update(String(value||'')).digest('hex').slice(0,16);

export function toolFabricRegistry(){
  return toolRegistry().map(({id,configured,readonly,risk,parallelSafe,timeoutMs,capabilities,description})=>({
    id,configured,readonly,risk,parallelSafe,timeoutMs,capabilities,description
  }));
}

export function planToolExecution({agent,message='',requestedTools=[]}={}){
  const manifest=toolFabricRegistry();
  const byId=Object.fromEntries(manifest.map(x=>[x.id,x]));
  const implicit=INTENT_RULES.filter(rule=>rule.match.test(String(message))).map(rule=>rule.tool);
  const desired=[...new Set([...(agent?.tools||[]),...(Array.isArray(requestedTools)?requestedTools:[]),...implicit])];
  const selected=[],denied=[];
  for(const id of desired){
    const tool=byId[id];
    if(!tool){denied.push({tool:id,reason:'unknown_tool'});continue}
    if(!tool.configured){denied.push({tool:id,reason:'not_configured'});continue}
    if(tool.readonly!==true){denied.push({tool:id,reason:'write_requires_explicit_approval'});continue}
    if(selected.length>=MAX_TOOLS){denied.push({tool:id,reason:'tool_budget_exceeded'});continue}
    selected.push(tool);
  }
  return{
    schema:TOOL_FABRIC_VERSION,
    policy:'least-privilege-readonly',
    maxTools:MAX_TOOLS,
    parallel:selected.every(x=>x.parallelSafe===true),
    selected,
    denied,
  };
}

async function invoke(tool,message){
  const started=Date.now(),receiptId=crypto.randomUUID();
  try{
    const data=await executeTool(tool.id,{message,query:message});
    return{
      result:{tool:tool.id,ok:true,data},
      receipt:{id:receiptId,tool:tool.id,ok:true,readonly:true,risk:tool.risk,durationMs:Date.now()-started,inputHash:hash(message),outputHash:hash(JSON.stringify(data)),observedAt:new Date().toISOString()}
    };
  }catch(error){
    return{
      result:{tool:tool.id,ok:false,error:String(error?.message||error).slice(0,500)},
      receipt:{id:receiptId,tool:tool.id,ok:false,readonly:true,risk:tool.risk,durationMs:Date.now()-started,inputHash:hash(message),outputHash:null,error:String(error?.message||error).slice(0,180),observedAt:new Date().toISOString()}
    };
  }
}

export async function runToolFabric({agent,message='',requestedTools=[]}={}){
  const plan=planToolExecution({agent,message,requestedTools});
  if(!plan.selected.length)return{schema:TOOL_FABRIC_VERSION,plan,results:[],receipts:[],elapsedMs:0};
  const started=Date.now();
  const executions=plan.parallel
    ? await Promise.all(plan.selected.map(tool=>invoke(tool,message)))
    : await plan.selected.reduce(async(accPromise,tool)=>{const acc=await accPromise;acc.push(await invoke(tool,message));return acc},Promise.resolve([]));
  return{
    schema:TOOL_FABRIC_VERSION,
    plan,
    results:executions.map(x=>x.result),
    receipts:executions.map(x=>x.receipt),
    elapsedMs:Date.now()-started,
  };
}
