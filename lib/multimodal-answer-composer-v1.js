export const MULTIMODAL_ANSWER_COMPOSER_VERSION='multimodal-answer-composer/v1';

function clean(s='',n=1000){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function uniq(xs=[]){return [...new Set((Array.isArray(xs)?xs:[]).filter(Boolean))]}
function ids(x){return uniq([...(x?.sourceFileIds||[]),x?.sourceFileId])}

export function buildMultimodalAnswerComposer(report=null){
  if(!report)return null;
  const facts=(report.documentedFacts||[]).slice(0,24);
  const corroborated=(report.corroboratedPoints||[]).slice(0,16);
  const conflicts=(report.conflictPoints||[]).slice(0,16);
  const temporal=(report.temporalSequence||[]).slice(0,20);
  const causal=(report.causalClaims||[]).slice(0,16);
  const unresolved=(report.unresolvedQuestions||[]).slice(0,32);
  const citations=[];
  const seen=new Set();
  const add=(fileId,location=null)=>{
    if(!fileId||seen.has(fileId))return;
    seen.add(fileId);
    citations.push({sourceFileId:fileId,location:location||null});
  };
  facts.forEach(x=>(x.sourceFileIds||[]).forEach(id=>add(id,x.location)));
  conflicts.forEach(x=>(x.sourceFileIds||[]).forEach(id=>add(id,(x.locations||[])[0]||null)));
  temporal.forEach(x=>add(x.sourceFileId,x.location));
  causal.forEach(x=>add(x.sourceFileId,null));
  return {
    version:MULTIMODAL_ANSWER_COMPOSER_VERSION,
    contract:{
      documented_facts:facts.map(x=>({id:x.id,statement:x.statement,source_file_ids:x.sourceFileIds||[],location:x.location||null,confidence:x.confidence,status:x.status})),
      corroborated_points:corroborated.map(x=>({id:x.id,statement:x.statement,source_file_ids:x.sourceFileIds||[],terms:x.terms||[],status:x.status})),
      conflict_points:conflicts.map(x=>({id:x.id,statements:x.statements||[],source_file_ids:x.sourceFileIds||[],reasons:x.reasons||[],status:x.status})),
      temporal_sequence:temporal.map(x=>({id:x.id,statement:x.statement,source_file_id:x.sourceFileId,dates:x.dates||[],times:x.times||[],signals:x.temporalSignals||[],location:x.location||null})),
      causal_claims:causal.map(x=>({id:x.id,statement:x.statement,source_file_id:x.sourceFileId,signals:x.signals||[],status:x.status})),
      unresolved_questions:unresolved.map(x=>({id:x.id,type:x.type,reason:x.reason,source_file_ids:x.sourceFileIds||[]})),
      verification_needed:(report.verificationNeeded||[]).slice(0,32).map(x=>({id:x.id,type:x.type,reason:x.reason,source_file_ids:x.sourceFileIds||[]})),
      provenance:citations
    },
    policy:{
      everyDocumentedFactHasProvenance:true,
      uncertaintyMustBeVisible:true,
      conflictsMustRemainUnresolved:true,
      noTruthWinner:true,
      noCausalConclusionWithoutEvidence:true,
      noSyntheticObservations:true
    }
  };
}

export function answerComposerInstruction(contract){
  if(!contract)return '';
  return '\n\nCOMPOSITOR DE RESPUESTA MULTIMODAL ('+MULTIMODAL_ANSWER_COMPOSER_VERSION+'):\n'+JSON.stringify(contract)+'\n- Si la pregunta depende de archivos, estructura la respuesta con hechos documentados, corroboraciones, conflictos, cronología, causalidad y asuntos pendientes según corresponda.\n- Conserva la procedencia: menciona el archivo y el localizador disponible al sostener un hecho.\n- Haz visible la incertidumbre y diferencia evidencia directa, señal textual e inferencia.\n- Nunca elijas automáticamente qué fuente es verdadera cuando existe conflicto.\n- Nunca conviertas una afirmación causal en causalidad demostrada.\n- No describas como observado un contenido multimedia al que el proveedor no haya dado acceso real.';
}

export function publicAnswerComposer(contract){
  if(!contract)return null;
  return {version:contract.version||MULTIMODAL_ANSWER_COMPOSER_VERSION,contract:contract.contract,policy:contract.policy};
}
