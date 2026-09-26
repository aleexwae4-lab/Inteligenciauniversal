export const MULTIMODAL_EVIDENCE_DECISION_VERSION='multimodal-evidence-decision/v1';

function clean(s='',n=700){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function uniq(xs=[]){return [...new Set((Array.isArray(xs)?xs:[]).filter(Boolean))]}
function ids(x){return uniq([...(x?.sourceFileIds||[]),x?.sourceFileId])}

export function buildEvidenceDecision({verification=null,synthesis=null,truthConflict=null,temporalCausal=null}={}){
  const tasks=Array.isArray(verification?.tasks)?verification.tasks:[];
  const decisions=tasks.filter(x=>['corroborating_signal','contradictory_signal','weak_signal','insufficient'].includes(x.status)).slice(0,32).map((x,i)=>{
    const ev=x.result?.evaluation||{};
    let state='unresolved';
    if(x.status==='corroborating_signal') state='supported_signal';
    else if(x.status==='contradictory_signal') state='conflicting_signal';
    else if(x.status==='weak_signal') state='partially_supported';
    return {id:'evidence-decision-'+(i+1),taskId:x.id,type:x.type,state,statement:clean(x.statement,700),sourceFileIds:ids(x),verificationSources:(ev.sources||x.result?.sources||[]).slice(0,4),strength:Number(ev.bestTermOverlap||0),requiresReview:true};
  });
  const conflictCount=decisions.filter(x=>x.state==='conflicting_signal').length;
  const supportCount=decisions.filter(x=>x.state==='supported_signal').length;
  const partialCount=decisions.filter(x=>x.state==='partially_supported').length;
  const unresolvedCount=decisions.filter(x=>x.state==='unresolved').length;
  let overall='unresolved';
  if(conflictCount>0) overall='conflicting';
  else if(supportCount>0 && partialCount===0 && unresolvedCount===0) overall='supported_signals';
  else if(supportCount>0 || partialCount>0) overall='partially_supported';
  return {version:MULTIMODAL_EVIDENCE_DECISION_VERSION,overall,decisions,summary:{supportedSignals:supportCount,partiallySupported:partialCount,conflictingSignals:conflictCount,unresolved:unresolvedCount,pendingVerification:tasks.filter(x=>x.status==='pending').length},inputs:{verificationTasks:tasks.length,truthConflictSignals:(truthConflict?.conflictSignals||[]).length,temporalEvents:(temporalCausal?.events||[]).length},policy:{signalsOnly:true,noTruthWinner:true,noAutomaticCausalConclusion:true,conflictBlocksResolution:conflictCount>0,provenanceRequired:true,requiresHumanOrModelReview:true}};
}
export function evidenceDecisionInstruction(report){
 if(!report)return '';
 return '\n\nCAPA DE DECISIÓN DE EVIDENCIA ('+MULTIMODAL_EVIDENCE_DECISION_VERSION+'):\n'+JSON.stringify(report)+'\n- Interpreta supported_signal como evidencia de apoyo, no como verdad absoluta.\n- conflicting indica señales incompatibles; no elijas qué fuente es verdadera.\n- partially_supported significa apoyo incompleto.\n- unresolved significa que la evidencia no permite resolver la cuestión.\n- Conserva procedencia y no conviertas una señal temporal o causal en causalidad demostrada.\n';
}
export function publicEvidenceDecision(report){
 if(!report)return null;
 return {version:report.version||MULTIMODAL_EVIDENCE_DECISION_VERSION,overall:report.overall,decisions:(report.decisions||[]).slice(0,32),summary:report.summary,policy:report.policy};
}
