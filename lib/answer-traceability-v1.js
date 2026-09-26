export const ANSWER_TRACEABILITY_VERSION='answer-traceability/v1';

const clean=(s='',n=700)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const norm=(s='')=>clean(s,900).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const terms=(s='')=>[...new Set(norm(s).split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>=5))].slice(0,30);

function sentences(text=''){
 return clean(text,12000).split(/(?<=[.!?。！？])\s+|\n+/).map(x=>clean(x,500)).filter(x=>x.length>=18).slice(0,48);
}
function score(claim,evidence){
 const q=terms(claim), e=terms(evidence), overlap=q.filter(x=>e.includes(x));
 return {signal:Number((overlap.length/Math.max(3,Math.min(q.length,10))).toFixed(3)),matchedTerms:overlap.slice(0,10)};
}
export function buildAnswerTraceability({answer='',synthesis=null,verification=null,sources=[]}={}){
 const facts=[...(synthesis?.documentedFacts||[]),...(synthesis?.corroboratedPoints||[]),...(synthesis?.conflictPoints||[]),...(synthesis?.causalClaims||[])].slice(0,80);
 const candidates=facts.map((x,i)=>({id:'evidence-'+(i+1),statement:clean(x.statement||x.claim||x.text,700),sourceFileIds:x.sourceFileIds||x.sourceFileId?[...(x.sourceFileIds||[]),...(x.sourceFileId?[x.sourceFileId]:[])]:[],locations:x.location?[x.location]:[],sourceUrls:x.sourceUrls||[]}));
 const trace=sentences(answer).map((claim,i)=>{
   const ranked=candidates.map(e=>({...e,...score(claim,e.statement)})).sort((a,b)=>b.signal-a.signal);
   const best=ranked[0];
   let traceType='untraced';
   if(best?.signal>=.55)traceType='direct_match';
   else if(best?.signal>=.28)traceType='partial_match';
   return {id:'claim-'+(i+1),claim,traceType,traceSignal:best?.signal||0,evidenceIds:best&&traceType!=='untraced'?[best.id]:[],sourceFileIds:best&&traceType!=='untraced'?best.sourceFileIds:[],locations:best&&traceType!=='untraced'?best.locations:[],requiresReview:traceType!=='direct_match'};
 });
 const untraced=trace.filter(x=>x.traceType==='untraced').length;
 return {version:ANSWER_TRACEABILITY_VERSION,claims:trace,summary:{claims:trace.length,traced:trace.filter(x=>x.traceType!=='untraced').length,untraced,reviewRequired:trace.filter(x=>x.requiresReview).length},policy:{traceSignalsAreNotTruth:true,untracedClaimsVisible:true,noSyntheticEvidence:true,provenanceRequired:true,noAutomaticTruthResolution:true,partialMatchesRequireReview:true}};
}
export function answerTraceabilityInstruction(report){
 if(!report)return '';
 return '\n\nTRAZABILIDAD DE RESPUESTA ('+ANSWER_TRACEABILITY_VERSION+'):\n'+JSON.stringify(report)+'\n- Un claim sin evidencia trazada debe tratarse como no respaldado, no como falso.\n- traceSignal mide coincidencia textual, NO probabilidad de verdad.\n- No inventes vínculos entre claims y fuentes.\n- Mantén visibles conflictos, incertidumbre y procedencia.\n';
}
export function publicAnswerTraceability(report){return report?{version:report.version,claims:(report.claims||[]).slice(0,48),summary:report.summary,policy:report.policy}:null;}
