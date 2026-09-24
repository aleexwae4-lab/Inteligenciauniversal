import { planUniversalIntelligence, publicUniversalIntelligencePlan } from './universal-intelligence-planner-v87.js';
import { runTools, formatToolContext } from './tools.js';
import { planIndustrialMission, publicIndustrialPlan, UNIVERSAL_INDUSTRIAL_VERSION } from './universal-industrial-v115.js';

export const MISSION_CONTROL_VERSION='universal-mission-control/v114';
const REPO_REFERENCE=/(?:repo:[\w.-]+\/[\w.-]+|github\.com\/[\w.-]+\/[\w.-]+)/i;
const clean=(value,max=1000)=>String(value??'').trim().slice(0,max);

export function planNativeMission(payload={},message='',history=[],attachments=[]) {
  const plan=planUniversalIntelligence({...payload,message});
  const industrial=planIndustrialMission(message,{attachments});
  const explicitMode=String(payload.mode||payload.agent||'general').toLowerCase();
  const mode=['','general','auto'].includes(explicitMode)?plan.mode:explicitMode;
  const requiresLive=plan.needs.live===true&&payload.web_enabled!==false;
  const requested=Array.isArray(payload.tools)?payload.tools:[];
  const toolIds=[];
  if(payload.web_enabled!==false&&(requiresLive||payload.web_enabled===true||requested.includes('web_search')))toolIds.push('web_search');
  if(REPO_REFERENCE.test(message)&&(plan.domains.includes('technology')||mode==='code'||requested.includes('github_search')))toolIds.push('github_search');
  return {version:MISSION_CONTROL_VERSION,plan,mode,toolIds,requiresLive,industrial,preserveContext:history.length>0,hasAttachments:attachments.length>0};
}
export function verifiedToolSources(results=[]) {
  const urls=new Set(),sources=[];
  for(const result of results) {
    if(result?.ok!==true||!Array.isArray(result.data))continue;
    for(const item of result.data) {
      const url=String(item?.url||'');
      if(!/^https?:\/\//i.test(url)||urls.has(url))continue;
      urls.add(url);
      sources.push({title:clean(item.title||item.name||item.path||url,250),url,
        snippet:clean(item.content||'',700),source:result.tool,provider:clean(item.provider||result.tool,100),
        published_at:item.published_at||null,retrieved_at:new Date().toISOString()});
      if(sources.length>=10)return sources;
    }
  }
  return sources;
}
export async function executeNativeReadTools(mission,message,{timeoutMs=6500}={}) {
  if(!mission.toolIds.length)return [];
  const task=runTools({agent:{tools:[]},message,requestedTools:mission.toolIds,allowKeylessWeb:mission.requiresLive||mission.toolIds.includes('web_search')});
  let timer;
  try{
    return await Promise.race([
      task,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('mission_readonly_tools_deadline')),timeoutMs)})
    ]);
  }catch(error){
    return mission.toolIds.map(id=>({tool:id,ok:false,error:clean(error?.message||error,120)}));
  }finally{clearTimeout(timer)}
}
export function missionToolContext(results=[]) {
  return formatToolContext(results).slice(0,18000);
}
export function attachMissionMetadata(result,mission,toolResults=[]) {
  const tools=toolResults.map(x=>({id:x.tool,ok:x.ok===true,error:x.ok?undefined:clean(x.error,120)}));
  const summary={version:MISSION_CONTROL_VERSION,industrialVersion:UNIVERSAL_INDUSTRIAL_VERSION,industrial:publicIndustrialPlan(mission.industrial),plan:publicUniversalIntelligencePlan(mission.plan),
    mode:mission.mode,tools,evidenceSources:verifiedToolSources(toolResults).length};
  result.mission_control=summary;
  if(result.response)result.response.metadata={...result.response.metadata,missionControl:summary};
  return result;
}
