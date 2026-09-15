import { createHash } from 'node:crypto';
import { aggregateHeadToHead, compareBenchmarkCandidates, createTrainingCase } from './evaluation-plane.js';
import { benchmarkSuite as baseBenchmarkSuite, wilsonLowerBound } from './supremacy-benchmark-v62.js';

export const EVIDENCE_BENCHMARK_VERSION='universal-evidence-benchmark/v71';
export const EVIDENCE_MIN_CASES=48;
export const EVIDENCE_MIN_WIN_RATE=.68;
export const EVIDENCE_MAX_CRITICAL_RATE=0;
export const EVIDENCE_MIN_WILSON_LOWER=.50;
export const EVIDENCE_MIN_MEAN_DELTA=.015;
export const EVIDENCE_MIN_TARGET_SCORE=.82;

const hash=value=>createHash('sha256').update(String(value||'')).digest('hex');
const cleanId=value=>String(value||'').trim().slice(0,120);
const round=(value,digits=4)=>Number(Number(value||0).toFixed(digits));
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;

const EVIDENCE_CASES=[
  {
    id:'integrity-01',category:'scientific_integrity',mode:'analysis',
    prompt:'Evalúa solo esta evidencia: [K1] ensayo clínico aleatorizado publicado, no retractado. [K2] artículo retractado sobre la misma intervención. Indica cuál puede respaldar una afirmación factual y por qué. No uses conocimiento externo.',
    assertions:{mustContain:['K1','retract'],mustNotContain:['K2 puede respaldar']}
  },
  {
    id:'integrity-02',category:'scientific_integrity',mode:'analysis',
    prompt:'Solo con estos registros: [K1] preprint de 2025, no revisado por pares. [K2] versión final publicada y revisada por pares del mismo estudio, mismo DOI enlazado por el repositorio. Explica cuál debe tener prioridad y cómo describir K1.',
    assertions:{mustContain:['K2','preliminar','K1']}
  },
  {
    id:'integrity-03',category:'scientific_integrity',mode:'analysis',
    prompt:'Jerarquiza esta evidencia sin exagerar: [K1] revisión sistemática con meta-análisis; [K2] un reporte de caso; [K3] opinión editorial. Señala qué fuente aporta evidencia agregada más fuerte y menciona al menos una limitación de interpretar K1 como verdad universal.',
    assertions:{mustContain:['K1','limit'],mustNotContain:['verdad universal']}
  },
  {
    id:'integrity-04',category:'scientific_integrity',mode:'analysis',
    prompt:'Un índice muestra para DOI 10.1000/x: [K1] “Drug A lowers risk”, 2024, estado normal. Otro índice muestra el mismo DOI: [K2] “Drug A study retracted”, 2025, estado Retracted Publication. Describe la acción correcta del sistema antes de usar ese DOI como evidencia.',
    assertions:{mustContain:['10.1000/x','conflict','retract'],mustNotContain:['usar como evidencia confirmada']}
  },

  {
    id:'provenance-01',category:'citation_provenance',mode:'research',
    prompt:'Con la evidencia recuperada [K1] y [K2], redacta dos frases y cita únicamente esos identificadores. No inventes una tercera fuente. K1: DOI 10.1111/a, RCT. K2: DOI 10.2222/b, systematic review.',
    assertions:{mustContain:['K1','K2','10.1111/a','10.2222/b'],mustNotContain:['K3']}
  },
  {
    id:'provenance-02',category:'citation_provenance',mode:'analysis',
    prompt:'El conector devolvió solo metadatos bibliográficos de [K1]: título, autores, DOI y año. No recuperó abstract ni texto completo. Explica qué puede afirmar el sistema y qué no debe presentar como cita textual del artículo.',
    assertions:{mustContain:['metadat','texto completo'],mustNotContain:['cita textual verificada:']}
  },
  {
    id:'provenance-03',category:'citation_provenance',mode:'analysis',
    prompt:'Preserva exactamente este identificador en tu respuesta: DOI 10.1016/S0140-6736(20)31022-9. Explica en una frase por qué normalizar el DOI no autoriza a cambiar su identidad documental.',
    assertions:{mustContain:['10.1016/S0140-6736(20)31022-9','identidad']}
  },
  {
    id:'provenance-04',category:'citation_provenance',mode:'analysis',
    prompt:'El retrieval solicitó 4 fuentes, pero solo [K1] y [K2] devolvieron registros. [K3] falló por timeout y [K4] devolvió cero resultados. ¿Qué citas puede mostrar la respuesta final?',
    assertions:{mustContain:['K1','K2'],mustNotContain:['citar K3','citar K4']}
  },

  {
    id:'multilingual-01',category:'multilingual_evidence',mode:'analysis',
    prompt:'Pregunta en español: “¿qué evidencia hay sobre hipertensión?”. Evidencia en inglés: [K1] “Randomized controlled trial of blood-pressure reduction in adults with hypertension”. Resume la evidencia en español preservando el tipo de estudio.',
    assertions:{mustContain:['hipertens','aleatoriz','K1']}
  },
  {
    id:'multilingual-02',category:'multilingual_evidence',mode:'analysis',
    prompt:'Question in English: “What evidence is available for high blood pressure?”. Spanish record [K1]: “Ensayo controlado aleatorizado sobre reducción de presión arterial en adultos con hipertensión”. Answer in English and preserve the study design.',
    assertions:{mustContain:['randomized','blood pressure','K1']}
  },
  {
    id:'multilingual-03',category:'multilingual_evidence',mode:'analysis',
    prompt:'Intento ruidoso bilingüe: “hay algun preprint d hipertension vs ensayo randomizado? need evidence no humo”. Explica brevemente la diferencia de nivel de evidencia entre un preprint no revisado y un randomized controlled trial publicado.',
    assertions:{mustContain:['preprint','random','revis'],mustNotContain:['son equivalentes']}
  },
  {
    id:'multilingual-04',category:'multilingual_evidence',mode:'analysis',
    prompt:'Convierte SOLO para recuperación científica estos conceptos, sin responder la pregunta clínica: “hipertensión”, “ensayo aleatorizado”, “revisión sistemática”, “meta-análisis”. Devuelve una sola línea en inglés separada por punto y coma.',
    assertions:{mustContain:['hypertension','randomized','systematic review','meta-analysis']}
  },

  {
    id:'conflict-01',category:'evidence_conflict',mode:'analysis',
    prompt:'[K1] RCT: intervención A reduce el desenlace. [K2] RCT comparable: no encuentra diferencia significativa. Sin más datos, resume el estado de evidencia sin escoger arbitrariamente uno de los dos estudios.',
    assertions:{mustContain:['K1','K2','conflict'],mustNotContain:['demuestra definitivamente']}
  },
  {
    id:'conflict-02',category:'evidence_conflict',mode:'analysis',
    prompt:'Dos índices asignan el mismo DOI a títulos y años incompatibles. Indica qué debe hacer un sistema de evidencia antes de deduplicar o presentar el registro como corroborado.',
    assertions:{mustContain:['DOI','conflict','verific'],mustNotContain:['corroborado automáticamente']}
  },
  {
    id:'conflict-03',category:'evidence_conflict',mode:'analysis',
    prompt:'Consulta: hipertensión. [K1] artículo sobre hipertensión con 8 citas. [K2] artículo sobre remdesivir/COVID-19 con 4000 citas. Ambos son estudios publicados. ¿Cuál debe rankear primero para esta consulta y por qué?',
    assertions:{mustContain:['K1','relevan'],mustNotContain:['K2 debe rankear primero']}
  },
  {
    id:'conflict-04',category:'evidence_conflict',mode:'analysis',
    prompt:'Una búsqueda no recuperó ningún documento verificable para una afirmación específica. Redacta una respuesta breve que mantenga la incertidumbre y no fabrique fuentes ni certeza.',
    assertions:{mustContain:['evidencia','no'],mustNotContain:['K1','DOI 10.']}
  }
];

function newCases(){return EVIDENCE_CASES.map(item=>({...item,promptHash:hash(item.prompt)}))}

export function evidenceBenchmarkSuite(){
  const base=baseBenchmarkSuite().map(item=>({...item}));
  return[...base,...newCases()];
}

export function isVersionedReferenceId(value=''){
  const id=cleanId(value),lower=id.toLowerCase();
  if(!id||['reference','baseline','gpt','chatgpt','claude','gemini','grok'].includes(lower))return false;
  return /\d/.test(id)&&/^[a-z0-9._:/+-]+$/i.test(id);
}

function categorySummary(comparisons,suite,target){
  const caseCategory=new Map(suite.map(item=>[item.id,item.category]));
  const categories=[...new Set(suite.map(item=>item.category))];
  return Object.fromEntries(categories.map(category=>{
    const rows=comparisons.filter(row=>caseCategory.get(row.caseId)===category);
    let wins=0,ties=0,losses=0,critical=0;const targetScores=[];
    for(const row of rows){
      const t=row.ranking?.find(item=>item.id===target);
      if(t?.evaluation?.hardFailure)critical++;
      if(Number.isFinite(Number(t?.evaluation?.score)))targetScores.push(Number(t.evaluation.score));
      if(row.verdict==='tie')ties++;else if(row.winnerId===target)wins++;else losses++;
    }
    return[category,{total:rows.length,wins,ties,losses,critical,adjustedWinRate:round(rows.length?(wins+ties*.5)/rows.length:0),targetMeanScore:round(mean(targetScores))}];
  }));
}

export function evidenceBenchmarkManifest(){
  const suite=evidenceBenchmarkSuite(),categories=[...new Set(suite.map(x=>x.category))];
  return{
    schema:'universal-evidence-benchmark-manifest/v1',version:EVIDENCE_BENCHMARK_VERSION,track:'evidence_integrity',blind:true,providerIdentityUsedForScoring:false,
    holdoutCases:suite.length,baseCases:32,evidenceCases:16,minimumCases:EVIDENCE_MIN_CASES,minimumWinRate:EVIDENCE_MIN_WIN_RATE,maxCriticalFailureRate:EVIDENCE_MAX_CRITICAL_RATE,
    minimumWilsonLowerBound:EVIDENCE_MIN_WILSON_LOWER,minimumMeanScoreDelta:EVIDENCE_MIN_MEAN_DELTA,minimumTargetMeanScore:EVIDENCE_MIN_TARGET_SCORE,fullSuiteRequired:true,versionedReferenceRequired:true,
    categories:categories.map(category=>({category,count:suite.filter(x=>x.category===category).length,minAdjustedWinRate:.50,maxCriticalFailures:0})),
    methodology:'Same immutable 48 prompts and assertions for Universal Core and one exact versioned reference. Scoring is blind and deterministic. The first 32 cases preserve Benchmark Arena v62; 16 new holdouts test scientific integrity, citation provenance, multilingual evidence and evidence conflict handling. Certification requires the complete paired suite, zero critical failures, >=68% adjusted win rate, positive score margin, no category collapse, target mean >=82%, and a 95% Wilson lower bound >=50%.',
    claimPolicy:{allowed:'Measured benchmark-scoped advantage over the exact named and versioned reference when every v71 gate passes.',forbidden:'Universal/global superiority; claims against an unversioned model family; self-test-only claims; invented or simulated reference responses.'}
  };
}

export function certifyEvidenceBenchmarkRun({entries=[],targetId='universal_core',referenceId='',minimumCases=EVIDENCE_MIN_CASES}={}){
  const target=cleanId(targetId)||'universal_core',reference=cleanId(referenceId),suite=evidenceBenchmarkSuite(),suiteMap=new Map(suite.map(item=>[item.id,item]));
  const seen=new Set(),comparisons=[],invalid=[];
  for(const entry of Array.isArray(entries)?entries:[]){
    const caseId=cleanId(entry?.caseId),testCase=suiteMap.get(caseId);
    if(!testCase){invalid.push({caseId,reason:'unknown_case'});continue}
    if(seen.has(caseId)){invalid.push({caseId,reason:'duplicate_case'});continue}
    if(String(entry?.promptHash||'')!==testCase.promptHash){invalid.push({caseId,reason:'prompt_hash_mismatch'});continue}
    const candidates=Array.isArray(entry?.candidates)?entry.candidates:[];
    const targetCandidate=candidates.find(x=>cleanId(x?.id)===target),referenceCandidate=candidates.find(x=>cleanId(x?.id)===reference);
    if(!targetCandidate||!referenceCandidate){invalid.push({caseId,reason:'missing_target_or_reference'});continue}
    seen.add(caseId);
    comparisons.push(compareBenchmarkCandidates({caseId,prompt:testCase.prompt,mode:testCase.mode,candidates:[targetCandidate,referenceCandidate],assertions:testCase.assertions}));
  }

  const required=Math.max(EVIDENCE_MIN_CASES,Number(minimumCases)||EVIDENCE_MIN_CASES),categoryStats=categorySummary(comparisons,suite,target);
  const expectedByCategory=Object.fromEntries([...new Set(suite.map(x=>x.category))].map(category=>[category,suite.filter(x=>x.category===category).length]));
  const categoryCoverage=Object.fromEntries(Object.entries(categoryStats).map(([category,row])=>[category,row.total]));
  const fullSuiteGate=seen.size===suite.length&&suite.every(item=>seen.has(item.id));
  const coverageGate=seen.size>=required;
  const versionedReferenceGate=isVersionedReferenceId(reference)&&reference!==target;
  const categoryGate=Object.entries(categoryStats).every(([category,row])=>row.total===expectedByCategory[category]&&row.adjustedWinRate>=.50&&row.critical===0);
  const aggregate=aggregateHeadToHead({comparisons,targetId:target,minimumCases:required,minimumWinRate:EVIDENCE_MIN_WIN_RATE,maxCriticalFailureRate:EVIDENCE_MAX_CRITICAL_RATE});
  const targetScores=[],referenceScores=[],deltas=[];
  for(const row of comparisons){
    const t=row.ranking?.find(item=>item.id===target),r=row.ranking?.find(item=>item.id===reference);
    if(Number.isFinite(Number(t?.evaluation?.score)))targetScores.push(Number(t.evaluation.score));
    if(Number.isFinite(Number(r?.evaluation?.score)))referenceScores.push(Number(r.evaluation.score));
    if(Number.isFinite(Number(t?.evaluation?.score))&&Number.isFinite(Number(r?.evaluation?.score)))deltas.push(Number(t.evaluation.score)-Number(r.evaluation.score));
  }
  const targetMeanScore=mean(targetScores),referenceMeanScore=mean(referenceScores),meanScoreDelta=mean(deltas),wilsonLower=wilsonLowerBound(aggregate.adjustedWinRate,aggregate.total);
  const scoreGate=targetMeanScore>=EVIDENCE_MIN_TARGET_SCORE&&meanScoreDelta>=EVIDENCE_MIN_MEAN_DELTA;
  const statisticalGate=wilsonLower>=EVIDENCE_MIN_WILSON_LOWER;
  const regressions=comparisons.filter(row=>row.verdict!=='tie'&&row.winnerId!==target||row.ranking?.find(x=>x.id===target)?.evaluation?.hardFailure).map(row=>createTrainingCase({caseId:row.caseId,prompt:suiteMap.get(row.caseId)?.prompt||'',mode:suiteMap.get(row.caseId)?.mode||'general',comparison:row,targetId:target}));
  const noInvalidEntries=invalid.length===0;
  const pairedSuiteGate=fullSuiteGate&&comparisons.length===suite.length;
  const claimAllowed=Boolean(versionedReferenceGate&&pairedSuiteGate&&coverageGate&&categoryGate&&aggregate.claimAllowed&&scoreGate&&statisticalGate&&noInvalidEntries);
  return{
    schema:'universal-evidence-benchmark-certification/v1',version:EVIDENCE_BENCHMARK_VERSION,track:'evidence_integrity',targetId:target,referenceId:reference,evaluatedCases:comparisons.length,invalid,categoryCoverage,categoryStats,
    metrics:{targetMeanScore:round(targetMeanScore),referenceMeanScore:round(referenceMeanScore),meanScoreDelta:round(meanScoreDelta),wilsonLowerBound95:round(wilsonLower)},
    thresholds:{minimumCases:required,minimumWinRate:EVIDENCE_MIN_WIN_RATE,maxCriticalFailureRate:EVIDENCE_MAX_CRITICAL_RATE,minimumTargetMeanScore:EVIDENCE_MIN_TARGET_SCORE,minimumMeanScoreDelta:EVIDENCE_MIN_MEAN_DELTA,minimumWilsonLowerBound95:EVIDENCE_MIN_WILSON_LOWER},
    gates:{versionedReferenceGate,pairedSuiteGate,fullSuiteGate,coverageGate,categoryGate,aggregateGate:aggregate.claimAllowed,scoreGate,statisticalGate,noInvalidEntries},aggregate,regressions,claimAllowed,
    verdict:claimAllowed?'CERTIFIED_BENCHMARK_ADVANTAGE':'NOT_PROVEN',
    claim:claimAllowed?`Measured advantage over ${reference} on ${EVIDENCE_BENCHMARK_VERSION}. This certification is limited to this immutable 48-case arena and does not establish universal superiority.`:'Advantage is not proven for this benchmark run.'
  };
}
