export const UNIVERSAL_MISSION_RECOVERY_VERSION='universal-mission-recovery/v1';

const clean=(s='',n=500)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);

export async function recoverMissionTools(toolResults=[],{message='',webSearch=null,maxRetries=1}={}){
  const results=Array.isArray(toolResults)?[...toolResults]:[];
  if(typeof webSearch!=='function'||maxRetries<1)return {toolResults:results,recovery:{attempted:false,retried:[],recovered:[],failed:[]}};
  const retried=[],recovered=[],failed=[];
  const candidates=results.filter(x=>x?.tool==='web_search'&&x?.ok===false).slice(0,1);
  for(const item of candidates){
    retried.push('web_search');
    try{
      const data=await webSearch(message);
      const ok=Array.isArray(data)&&data.length>0;
      const replacement={...item,ok,data:ok?data:[],recovery:true,recoveryAttempt:1,error:ok?'':clean(item.error||'no_results',240)};
      const index=results.indexOf(item);
      if(index>=0)results[index]=replacement;
      (ok?recovered:failed).push({tool:'web_search',reason:ok?'retry_success':'retry_no_evidence'});
    }catch(error){
      failed.push({tool:'web_search',reason:clean(error?.message||error,240)});
    }
  }
  return {toolResults:results,recovery:{version:UNIVERSAL_MISSION_RECOVERY_VERSION,attempted:retried.length>0,retried,recovered,failed,maxRetries:1,policy:'safe_retry_only',no_external_write_retry:true}};
}

export function missionRecoveryInstruction(report){
 if(!report)return '';
 return '\n\nRECUPERACIÓN DE MISIÓN ('+UNIVERSAL_MISSION_RECOVERY_VERSION+'):\n'+JSON.stringify(report)+'\n- Solo reintenta herramientas declaradas como seguras para reintento.\n- Un reintento exitoso no convierte por sí mismo una evidencia en verdad.\n- Nunca repitas automáticamente una escritura o acción externa con efectos secundarios.\n- Conserva el error original y el resultado del reintento.\n';
}

export function publicMissionRecovery(report){
 if(!report)return null;
 return {version:report.version||UNIVERSAL_MISSION_RECOVERY_VERSION,...report};
}
