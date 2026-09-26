import { normalizeMultimodalAttachments } from './multimodal-input-v1.js';

export const MULTIMODAL_TRUTH_CONFLICT_VERSION='multimodal-truth-conflict/v1';

const NEGATIONS=/\b(no|nunca|jamas|sin|niega|negado|falso|incorrecto|not|never|without|denies|false|incorrect)\b/gi;
const DATE=/\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g;
const NUMBER=/\b\d+(?:[.,]\d+)?\s*(?:%|kg|g|mg|km|m|cm|usd|mxn|eur|dolares|pesos)?\b/gi;

function norm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function terms(s=''){return [...new Set(norm(s).split(/[^a-z0-9%]+/).filter(x=>x.length>3))].slice(0,80)}
function polarity(s=''){const m=String(s).match(NEGATIONS);NEGATIONS.lastIndex=0;return m?'negative':'positive'}
function keyTerms(a,b){const A=new Set(terms(a)),B=terms(b);return B.filter(x=>A.has(x)).slice(0,12)}
function values(s,rx){return [...String(s).matchAll(rx)].map(m=>m[0].toLowerCase())}
function findingText(f){return String(f?.statement||f?.text||'').trim()}

export function buildTruthConflictEngine(attachments=[],findings=[]){
  const normalized=normalizeMultimodalAttachments(attachments).slice(0,8);
  const fs=(Array.isArray(findings)?findings:[]).filter(f=>findingText(f)&&Array.isArray(f.sourceFileIds)).slice(0,120);
  const signals=[];
  for(let i=0;i<fs.length;i++)for(let j=i+1;j<fs.length;j++){
    const a=fs[i],b=fs[j],at=findingText(a),bt=findingText(b),shared=keyTerms(at,bt);
    if(shared.length<1)continue;
    const pa=polarity(at),pb=polarity(bt);
    const datesA=values(at,DATE),datesB=values(bt,DATE),numsA=values(at,NUMBER),numsB=values(bt,NUMBER);
    const differentDate=datesA.length>0&&datesB.length>0&&datesA.some(x=>!datesB.includes(x));
    const differentNumber=numsA.length>0&&numsB.length>0&&numsA.some(x=>!numsB.includes(x));
    const polarityConflict=pa!==pb&&(at.length>15&&bt.length>15);
    if(!(differentDate||differentNumber||polarityConflict))continue;
    const reasons=[];
    if(differentDate)reasons.push('different_explicit_dates');
    if(differentNumber)reasons.push('different_explicit_values');
    if(polarityConflict)reasons.push('opposite_explicit_polarity');
    signals.push({id:'conflict-'+(signals.length+1),type:'conflict_signal',sourceFindingIds:[a.id,b.id].filter(Boolean),sourceFileIds:[...(a.sourceFileIds||[]),...(b.sourceFileIds||[])].filter(Boolean),sharedTerms:shared,reasons,statements:[at.slice(0,1000),bt.slice(0,1000)],locations:[a.location||null,b.location||null],confidence:'candidate',confidenceBasis:'deterministic textual mismatch; requires semantic verification',verified:false,requiresModelVerification:true});
  }
  const corroborations=[];
  for(let i=0;i<fs.length;i++)for(let j=i+1;j<fs.length;j++){
    const a=fs[i],b=fs[j],shared=keyTerms(findingText(a),findingText(b));
    if(shared.length>=3)corroborations.push({id:'corroboration-'+(corroborations.length+1),sourceFindingIds:[a.id,b.id].filter(Boolean),sourceFileIds:[...(a.sourceFileIds||[]),...(b.sourceFileIds||[])].filter(Boolean),sharedTerms:shared,verifiedFromText:true,conclusion:'corroboration_signal_only'});
  }
  return {version:MULTIMODAL_TRUTH_CONFLICT_VERSION,sourceFiles:normalized.map((a,i)=>({id:'file-'+(i+1),name:a.name,kind:a.kind,mime:a.mime})),conflictSignals:signals.slice(0,40),corroborations:corroborations.slice(0,40),unresolved:signals.map(s=>s.id),policy:{candidateSignalsOnly:true,noAutomaticTruthResolution:true,noWinnerSelection:true,confidenceIsNotTruth:true,provenanceRequired:true,modelVerificationRequired:true,absenceIsNotContradiction:true}};
}

export function truthConflictInstruction(report){
  return '\n\nMOTOR DE VERDAD Y CONFLICTO MULTIMODAL ('+MULTIMODAL_TRUTH_CONFLICT_VERSION+'):\n'+JSON.stringify(report)+'\n- Los conflictSignals son candidatos deterministas, no contradicciones definitivas.\n- Solo confirma una contradiccion si la evidencia disponible permite verificar incompatibilidad semantica.\n- Una diferencia numerica o de fecha puede representar eventos distintos; identifica el contexto antes de afirmarlo.\n- Nunca elijas automaticamente que archivo o afirmacion es la verdadera.\n- Nunca conviertas ausencia de evidencia en contradiccion.\n- Conserva sourceFindingIds, sourceFileIds y locations.\n- Separa evidencia documentada, señal de conflicto, corroboracion, inferencia y estado no resuelto.';
}

export function publicTruthConflict(report){
  return {version:report?.version||MULTIMODAL_TRUTH_CONFLICT_VERSION,conflictSignals:(report?.conflictSignals||[]).slice(0,20),corroborations:(report?.corroborations||[]).slice(0,20),unresolved:(report?.unresolved||[]).slice(0,20),policy:report?.policy||{}};
}
