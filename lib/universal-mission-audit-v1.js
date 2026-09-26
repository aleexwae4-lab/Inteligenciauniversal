export const UNIVERSAL_MISSION_AUDIT_VERSION='universal-mission-audit/v1';

const clean=(s='',n=500)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const arr=v=>Array.isArray(v)?v:[];

export function buildMissionAudit({
  dossier=null,
  executionProof=null,
  recovery=null,
  toolResults=[],
  mission=null
}={}){
  const receipts=arr(dossier?.receipts);
  const failures=receipts.filter(x=>x.status==='failed');
  const executed=receipts.filter(x=>x.executed);
  const contradictions=[];
  if(dossier?.lifecycle?.delivered===true && dossier?.completionGate?.passed!==true)
    contradictions.push('delivered_without_completion_gate');
  if(executionProof?.external_action_executed===true && !executionProof?.proof)
    contradictions.push('external_action_without_explicit_proof');
  const unresolved=failures.filter(x=>x.status==='failed').map(x=>clean(x.tool,100));
  const checks=[
    {id:'receipts',pass:receipts.length>0,reason:receipts.length?'tool receipts present':'no tool receipts'},
    {id:'execution',pass:executed.length>0||mission?.requiresLive!==true,reason:executed.length?'executed tools recorded':'no execution required or recorded'},
    {id:'recovery',pass:Number(recovery?.failed||0)===0,reason:Number(recovery?.failed||0)===0?'no unrecovered retries':'unrecovered recovery failures exist'},
    {id:'proof',pass:Boolean(executionProof?.version),reason:executionProof?.version?'execution proof present':'execution proof missing'},
    {id:'consistency',pass:contradictions.length===0,reason:contradictions.length?'dossier contains inconsistent completion claims':'completion state is internally consistent'}
  ];
  const passed=checks.every(x=>x.pass);
  return {
    version:UNIVERSAL_MISSION_AUDIT_VERSION,
    auditId:'audit-'+Date.now().toString(36),
    status:passed?'pass':'attention_required',
    checks,
    contradictions,
    unresolvedFailures:unresolved,
    counts:{receipts:receipts.length,executed:executed.length,failures:failures.length},
    policy:{
      failClosedOnContradiction:true,
      neverPromotePlannedToExecuted:true,
      neverPromoteExecutedToVerified:true,
      neverClaimExternalSuccessWithoutProof:true
    }
  };
}

export function missionAuditInstruction(audit){
  if(!audit)return '';
  return '\n\nAUDITORÍA DE MISIÓN ('+UNIVERSAL_MISSION_AUDIT_VERSION+'):\n'+JSON.stringify(audit)+'\n- Trata inconsistencias como atención requerida y no las ocultes.\n- No conviertas intención, plan o resultado parcial en ejecución verificada.\n- Si existe una acción externa, exige prueba explícita antes de afirmar éxito.\n- Conserva los fallos no recuperados en la respuesta operativa cuando sean relevantes.\n';
}

export function publicMissionAudit(audit){
  if(!audit)return null;
  return {...audit,checks:arr(audit.checks).slice(0,12),contradictions:arr(audit.contradictions).slice(0,12),unresolvedFailures:arr(audit.unresolvedFailures).slice(0,12)};
}
