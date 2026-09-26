import { normalizeMultimodalAttachments } from './multimodal-input-v1.js';

export const MULTIMODAL_TEMPORAL_CAUSAL_VERSION='multimodal-temporal-causal/v1';

const DATE_RE=/\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g;
const TIME_RE=/\b(?:[01]?\d|2[0-3]):[0-5]\d(?:[:][0-5]\d)?\b/g;
const TEMPORAL_RE=/\b(antes|despues|luego|posterior|anterior|durante|mientras|primero|finalmente|before|after|later|earlier|during|while|first|finally)\b/gi;
const CAUSAL_RE=/\b(causo|causo|provoco|provocó|ocasiono|ocasionó|debido a|por culpa de|resulto de|resultó de|porque|caused|led to|due to|because|resulted from)\b/gi;

function clean(s='',n=1000){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function dates(s){return [...String(s).matchAll(DATE_RE)].map(x=>x[0])}
function times(s){return [...String(s).matchAll(TIME_RE)].map(x=>x[0])}
function temporalTerms(s){const m=String(s).match(TEMPORAL_RE)||[];TEMPORAL_RE.lastIndex=0;return [...new Set(m.map(x=>x.toLowerCase()))]}
function causalTerms(s){const m=String(s).match(CAUSAL_RE)||[];CAUSAL_RE.lastIndex=0;return [...new Set(m.map(x=>x.toLowerCase()))]}
function sourceId(a,i){return String(a?.id||'attachment-'+(i+1))}
function statement(a){return clean(a?.text||'')}

export function buildTemporalCausalEngine(attachments=[],findings=[]){
  const items=(Array.isArray(attachments)?attachments:[]).slice(0,8);
  const fs=(Array.isArray(findings)?findings:[]).filter(x=>clean(x?.statement||x?.text)).slice(0,80);
  const events=[];
  items.forEach((a,i)=>{
    const text=statement(a);
    if(!text)return;
    const d=dates(text),t=times(text),tt=temporalTerms(text),ct=causalTerms(text);
    if(d.length||t.length||tt.length||ct.length){
      events.push({
        id:'event-'+(events.length+1),
        sourceFileId:sourceId(a,i),
        sourceName:clean(a.name,180),
        statement:text,
        dates:d.slice(0,8),
        times:t.slice(0,8),
        temporalSignals:tt.slice(0,8),
        causalSignals:ct.slice(0,8),
        location:{page:a.page??a.pageNumber??null,startSeconds:a.startTime??a.start_time??a.timestamp??null,segment:a.segment??a.segmentId??a.section??null},
        verified:true
      });
    }
  });
  const relations=[];
  for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
    const a=events[i],b=events[j];
    const sameDate=a.dates.some(x=>b.dates.includes(x));
    const orderSignal=[...a.temporalSignals,...b.temporalSignals].length>0;
    if(sameDate||orderSignal){
      relations.push({
        id:'temporal-'+(relations.length+1),
        from:a.id,to:b.id,
        relation:sameDate?'same_explicit_date':'temporal_signal',
        dates:[...new Set([...a.dates,...b.dates])].slice(0,8),
        evidence:[a.sourceFileId,b.sourceFileId],
        verifiedFromText:true,
        conclusion:'temporal_relation_signal_only'
      });
    }
  }
  const causalClaims=events.filter(x=>x.causalSignals.length).map(x=>({
    eventId:x.id,sourceFileId:x.sourceFileId,statement:x.statement.slice(0,1000),
    causalSignals:x.causalSignals,verifiedFromText:true,
    status:'causal_claim_requires_verification'
  }));
  return {
    version:MULTIMODAL_TEMPORAL_CAUSAL_VERSION,
    events:events.slice(0,60),
    relations:relations.slice(0,60),
    causalClaims:causalClaims.slice(0,40),
    policy:{
      onlyProvidedEvidence:true,
      temporalSignalsAreNotProofOfOrder:true,
      causalClaimsRequireVerification:true,
      correlationIsNotCausation:true,
      noInventedTimestamps:true,
      provenanceRequired:true,
      noAutomaticCausalConclusion:true
    }
  };
}

export function temporalCausalInstruction(report){
  return '\n\nMOTOR TEMPORAL Y CAUSAL MULTIMODAL ('+MULTIMODAL_TEMPORAL_CAUSAL_VERSION+'):\n'+JSON.stringify(report)+'\n- Construye relaciones temporales solo desde fechas, horas, segmentos o lenguaje temporal realmente disponible.\n- Una fecha compartida no demuestra que dos eventos sean el mismo evento.\n- Las expresiones causales son afirmaciones de la fuente, no causalidad demostrada.\n- Distingue secuencia temporal, correlación y causalidad.\n- Nunca inventes timestamps, páginas, segmentos o eventos ausentes.\n- Conserva archivo y localizador; toda conclusión causal requiere verificación adicional.';
}

export function publicTemporalCausal(report){
  return {
    version:report?.version||MULTIMODAL_TEMPORAL_CAUSAL_VERSION,
    events:(report?.events||[]).slice(0,30),
    relations:(report?.relations||[]).slice(0,30),
    causalClaims:(report?.causalClaims||[]).slice(0,20),
    policy:report?.policy||{}
  };
}
