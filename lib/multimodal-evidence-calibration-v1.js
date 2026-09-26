export const MULTIMODAL_EVIDENCE_CALIBRATION_VERSION='multimodal-evidence-calibration/v1';

function clean(s='',n=500){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function clamp(n,min=0,max=1){return Math.max(min,Math.min(max,Number(n)||0))}
function normalizeTask(task={}){
  const evaluation=task.result?.evaluation||{};
  const sources=evaluation.sources||task.result?.sources||[];
  const quality=Number(evaluation.bestTermOverlap||0);
  const sourceCount=Array.isArray(sources)?sources.length:0;
  const distinctHosts=new Set((Array.isArray(sources)?sources:[]).map(x=>String(x.host||'').toLowerCase()).filter(Boolean)).size;
  const support=task.status==='corroborating_signal'?1:task.status==='weak_signal'?.55:task.status==='contradictory_signal'?.25:0;
  const sourceFactor=clamp(sourceCount/3);
  const independenceFactor=clamp(distinctHosts/2);
  const lexicalFactor=clamp(quality/5);
  const signal=Number(clamp(.4*support+.25*sourceFactor+.2*independenceFactor+.15*lexicalFactor).toFixed(3));
  return {taskId:task.id,type:task.type,statement:clean(task.statement,700),status:task.status,signal,components:{support,sourceFactor,independenceFactor,lexicalFactor},sourceCount,independentHosts:distinctHosts,requiresReview:true};
}
export function buildEvidenceCalibration({verification=null,quality=null,decision=null}={}){
  const tasks=(verification?.tasks||[]).filter(x=>x?.status&&x.status!=='pending').slice(0,32);
  const assessments=tasks.map(normalizeTask);
  const actionable=assessments.filter(x=>x.signal>=.6).length;
  const conflicting=assessments.filter(x=>x.status==='contradictory_signal').length;
  return {version:MULTIMODAL_EVIDENCE_CALIBRATION_VERSION,assessments,summary:{assessments:assessments.length,actionableSignals:actionable,conflictingSignals:conflicting,averageSignal:assessments.length?Number((assessments.reduce((a,x)=>a+x.signal,0)/assessments.length).toFixed(3)):0},policy:{calibrationIsExplainableSignal:true,notTruthProbability:true,noAutomaticResolution:true,conflictsRemainVisible:true,provenanceRequired:true,requiresHumanOrModelReview:true}};
}
export function evidenceCalibrationInstruction(report){
  if(!report)return '';
  return '\n\nCALIBRACIÓN EXPLICABLE DE EVIDENCIA ('+MULTIMODAL_EVIDENCE_CALIBRATION_VERSION+'):\n'+JSON.stringify(report)+'\n- signal es una medida explicable de fuerza de señal, NO una probabilidad de verdad.\n- Explica los componentes cuando sean relevantes: apoyo, cantidad de fuentes, independencia y coincidencia textual.\n- Una señal alta no resuelve automáticamente un conflicto.\n- Mantén visibles las fuentes y la procedencia.\n';
}
export function publicEvidenceCalibration(report){
  if(!report)return null;
  return {version:report.version||MULTIMODAL_EVIDENCE_CALIBRATION_VERSION,assessments:(report.assessments||[]).slice(0,32),summary:report.summary,policy:report.policy};
}
