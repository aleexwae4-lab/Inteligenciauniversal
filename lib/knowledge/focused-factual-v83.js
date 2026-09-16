import { createKnowledgeConnectors } from './connectors-scientific-v2.js';
import { buildAssistantResponse } from '../response.js';
import { isSafeAssistantOutput, publicContextFallback } from '../context-output-firewall-v55.js';
import { sameOriginKnowledgeEligible, stripGreetingPrefix } from '../recovery-policy-v82.js';

export const FOCUSED_FACTUAL_VERSION='focused-factual/v83';

const text=(value,max=12000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>text(value,4000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const words=value=>norm(value).split(/\s+/).filter(Boolean);
const STOP=new Set('a al algo como con cual cuales cuando de del desde donde el ella ellas ellos en es esa ese esta este esto explicar explica explicame for how la las lo los me para por porque que qué se sirve sirven sobre su sus the un una unas unos what when where which who why y ya'.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\s+/));
const CORE_STOP=new Set([...STOP,'cielo','azul','color','colores','efecto','fenomeno','fenomenos','concepto','conceptos','cosa','cosas']);
const SPANISH=/[áéíóúñ¿¡]|\b(?:hola|para|que|qué|como|cómo|sirve|sirven|explica|por qué|cielo|azul|dispersión|unidad|procesamiento)\b/i;
const PURE_RESEARCH=/\b(?:paper|papers|estudio|estudios|evidencia cientifica|evidencia científica|meta.?analisis|meta.?análisis|revision sistematica|revisión sistemática|doi|pubmed|openalex|crossref|arxiv)\b/i;

function singularToken(token=''){
  const t=String(token||'');
  if(t==='gpus')return'gpu';
  if(t==='cpus')return'cpu';
  if(t.length>5&&t.endsWith('es'))return t.slice(0,-2);
  if(t.length>4&&t.endsWith('s'))return t.slice(0,-1);
  return t;
}
function uniqueTokens(value,stop=STOP){
  const out=[];
  for(const raw of words(value)){
    const token=singularToken(raw);
    if(token.length<2||stop.has(token)||out.includes(token))continue;
    out.push(token);
  }
  return out;
}
function cleanFocus(value=''){
  return text(value,240)
    .replace(/^[¿?¡!,:;\-–—\s]+|[¿?¡!,:;\-–—\s]+$/g,'')
    .replace(/^(?:el|la|los|las|un|una|unos|unas)\s+/i,'')
    .replace(/\s+/g,' ')
    .trim();
}

export function extractFactualFocus(message=''){
  const raw=text(message,1200);
  const withoutGreeting=stripGreetingPrefix(raw);
  const q=withoutGreeting.replace(/[?¿!¡]+$/g,'').trim();
  let focus='';
  const patterns=[
    /(?:qué|que)\s+es\s+(?:(?:el|la|los|las|un|una)\s+)?(.+?)(?=\s+(?:y\s+)?por\s+qué\b|\s+(?:y\s+)?para\s+qué\b|$)/i,
    /(?:qué|que)\s+son\s+(?:(?:el|la|los|las|un|una|unos|unas)\s+)?(.+?)(?=\s+(?:y\s+)?por\s+qué\b|\s+(?:y\s+)?para\s+qué\b|$)/i,
    /para\s+(?:qué|que)\s+(?:sirve|sirven)\s+(?:(?:el|la|los|las|un|una|unos|unas)\s+)?(.+)$/i,
    /(?:cómo|como)\s+(?:funciona|funcionan)\s+(?:(?:el|la|los|las|un|una|unos|unas)\s+)?(.+)$/i,
    /(?:define|explica)\s+(?:brevemente\s+)?(?:(?:el|la|los|las|un|una|unos|unas)\s+)?(.+?)(?=\s+(?:y\s+)?por\s+qué\b|$)/i
  ];
  for(const rx of patterns){const match=q.match(rx);if(match?.[1]){focus=cleanFocus(match[1]);break}}
  if(!focus){
    const candidates=uniqueTokens(q,STOP);
    focus=cleanFocus(candidates.slice(0,6).join(' '));
  }
  let normalized=norm(focus);
  if(/\bgpus?\b/.test(norm(q))){focus='GPU';normalized='gpu'}
  if(/\brayleigh\b/.test(norm(q))){focus=/^es/i.test(detectLanguage(raw))?'dispersión de Rayleigh':'Rayleigh scattering';normalized='dispersion rayleigh'}
  const coreTokens=uniqueTokens(normalized,CORE_STOP);
  return{raw,query:q,focus:focus||q,normalized,coreTokens,language:detectLanguage(raw),domain:detectFactualDomain(`${q} ${focus}`)};
}

export function detectLanguage(value=''){return SPANISH.test(String(value||''))?'es':'en'}
export function detectFactualDomain(value=''){
  const q=norm(value);
  if(/\b(?:gpu|cpu|graphics processing|unidad procesamiento grafico|comput|software|hardware|procesador|algorithm|algorit|machine learning|inteligencia artificial|neural)\b/.test(q))return'computer_science';
  if(/\b(?:rayleigh|scattering|dispersion|optica|optical|luz|light|longitud onda|wavelength|photon|foton|electromagnet|fisica|physics)\b/.test(q))return'physics';
  if(/\b(?:biolog|genet|cell|celula|protein|evolution|evolucion)\b/.test(q))return'biology';
  return'general_knowledge';
}

function tokenCoverage(haystack='',tokens=[]){
  if(!tokens.length)return 0;
  const hay=new Set(uniqueTokens(haystack,new Set()));
  let hit=0;for(const token of tokens)if(hay.has(token))hit++;
  return hit/tokens.length;
}
function phraseScore(record={},focus={}){
  const title=norm(record.title||''),abstract=norm(record.abstract||''),phrase=norm(focus.focus||'');
  if(!phrase)return 0;
  if(title===phrase)return 1;
  if(title.includes(phrase)||abstract.includes(phrase))return .88;
  return 0;
}

export function scoreFocusedRecord(record={},focus={}){
  if(record?.provenance?.prompt_injection_detected===true)return-1;
  const core=focus.coreTokens||[];
  const titleCoverage=tokenCoverage(record.title||'',core);
  const abstractCoverage=tokenCoverage(record.abstract||'',core);
  const phrase=phraseScore(record,focus);
  const source=String(record.source?.id||'').toLowerCase();
  const sourcePrior=source==='wikipedia'?.16:source==='wikidata'?.09:0;
  const hasCore=core.length===0||Math.max(titleCoverage,abstractCoverage)>0;
  if(!hasCore)return 0;
  const abstractBonus=text(record.abstract||'',1000).length>=80?.08:0;
  return Number(Math.min(1,phrase*.38+titleCoverage*.26+abstractCoverage*.20+sourcePrior+abstractBonus).toFixed(4));
}

export function rankFocusedRecords(records=[],focus={}){
  const bestBySource=new Map();
  for(const record of Array.isArray(records)?records:[]){
    const score=scoreFocusedRecord(record,focus);
    if(score<=0)continue;
    const enriched={...record,focused_score:score};
    const key=String(record.source?.id||'unknown');
    const prev=bestBySource.get(key);
    if(!prev||score>prev.focused_score)bestBySource.set(key,enriched);
  }
  return[...bestBySource.values()].sort((a,b)=>b.focused_score-a.focused_score);
}

export function sourceQuery(focus={}){
  if(focus.normalized==='gpu')return focus.language==='es'?'GPU unidad de procesamiento gráfico':'GPU graphics processing unit';
  const compact=(Array.isArray(focus.coreTokens)?focus.coreTokens:[]).slice(0,5).join(' ').trim();
  return compact||focus.focus;
}

async function retrieveFocusedEvidence(focus={},fetchImpl=fetch){
  const connectors=createKnowledgeConnectors({fetchImpl});
  const ids=['wikipedia','wikidata'].filter(id=>connectors.has(id));
  const query=sourceQuery(focus);
  const settled=await Promise.allSettled(ids.map(id=>connectors.get(id).search(query,{limit:5,language:focus.language})));
  const records=[],status=[];
  settled.forEach((item,index)=>{
    const id=ids[index];
    if(item.status==='fulfilled'){records.push(...item.value);status.push({source_id:id,status:'healthy',count:item.value.length})}
    else status.push({source_id:id,status:'degraded',count:0,error:text(item.reason?.message||item.reason,120)});
  });
  return{query,records:rankFocusedRecords(records,focus),status};
}

function sentenceCandidates(record={},focus={}){
  const raw=text(record.abstract||'',2600);
  if(!raw)return[];
  const sentences=raw.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>=24);
  const qTokens=uniqueTokens(`${focus.query||''} ${focus.focus||''}`,STOP);
  return sentences.map((sentence,index)=>({sentence,index,score:tokenCoverage(sentence,qTokens)+tokenCoverage(sentence,focus.coreTokens||[])*1.5})).sort((a,b)=>b.score-a.score||a.index-b.index);
}
function completeSentence(value='',maxWords=58){
  const clean=text(value,1200);
  const parts=clean.split(/\s+/).filter(Boolean);
  if(parts.length<=maxWords)return clean;
  const clipped=parts.slice(0,maxWords).join(' ').replace(/[,;:]?$/,'');
  return `${clipped}…`;
}
export function deterministicFocusedReply(records=[],focus={}){
  const record=records.find(r=>text(r.abstract||'',1000)&&r.focused_score>=.22);
  if(!record)return{reply:'',cited:[],strong:false};
  const ranked=sentenceCandidates(record,focus).filter(item=>item.score>0).slice(0,2).sort((a,b)=>a.index-b.index);
  const selected=ranked.length?ranked:[{sentence:record.abstract,index:0,score:0}];
  const answer=selected.map(item=>completeSentence(item.sentence)).filter(Boolean).join(' ');
  if(!answer)return{reply:'',cited:[],strong:false};
  const sourceUrl=String(record.source?.canonical_url||'');
  const strong=Number(record.focused_score)>=.48&&answer.length>=55&&/^https?:\/\//.test(sourceUrl);
  const intro=focus.language==='es'?'**Respuesta breve:**':'**Short answer:**';
  return{reply:`${intro} ${answer}`,cited:[{key:'K1',record}],strong};
}
function sourceList(cited=[]){
  return cited.map(({key,record})=>({key,title:record.title,url:record.source?.canonical_url||'',host:(()=>{try{return new URL(record.source?.canonical_url||'').hostname.replace(/^www\./,'')}catch{return''}})(),snippet:'',published_at:record.publicationDate||null,retrieved_at:record.source?.retrieved_at||null,source:record.source?.id||''})).filter(x=>/^https?:\/\//.test(x.url));
}

export function focusedFactualEligible(body={}){
  const message=text(body?.message||body?.task||'',30000);
  if(!sameOriginKnowledgeEligible(message,body?.mode||'general'))return false;
  if(PURE_RESEARCH.test(message)||String(body?.mode||'').toLowerCase()==='research')return false;
  return true;
}

export async function runFocusedFactualAnswer({body={},fetchImpl=fetch}={}){
  const started=Date.now();const message=text(body?.message||body?.task||'',30000);
  if(!focusedFactualEligible(body)||!message)return null;
  const focus=extractFactualFocus(message);
  const retrieval=await retrieveFocusedEvidence(focus,fetchImpl);
  const top=retrieval.records[0];
  if(!top||top.focused_score<.22)return null;
  const fallback=deterministicFocusedReply(retrieval.records,focus);
  if(!fallback.reply)return null;
  const blocked=!isSafeAssistantOutput(fallback.reply);
  const reply=blocked?publicContextFallback():fallback.reply;
  const cited=blocked?[]:fallback.cited;
  const sources=blocked?[]:sourceList(cited);
  const latencyMs=Date.now()-started;
  const degraded=blocked||fallback.strong!==true;
  const response=buildAssistantResponse({content:reply,sources,provider:'universal_core',model:blocked?'context-output-firewall-v56':'focused-factual-extractive-v83',latencyMs,memoryCount:0,requestId:crypto.randomUUID(),webUsed:sources.length>0,degraded});
  response.metadata={...(response.metadata||{}),focusedFactual:FOCUSED_FACTUAL_VERSION,focus:focus.focus,focusDomain:focus.domain,focusedQuery:retrieval.query,focusedScore:top.focused_score,sourceStatus:retrieval.status,extractiveFallback:true,coherentSingleSource:true};
  return{success:true,reply,speech_text:response.speechText,response,components:response.components,actions:response.actions,provider:'universal_core',model:blocked?'context-output-firewall-v56':'focused-factual-extractive-v83',web_sources:sources,degraded,quality:{critical:false,relevant:true,focused_score:top.focused_score},recovery:{active:true,path:'focused-factual-v83',focus:focus.focus,domain:focus.domain,strong:fallback.strong===true},latencyMs,agent:{id:'focused-factual',name:'Universal Core Factual Answer Engine'}};
}