import { applyAnswerIntelligence } from './answer-intelligence-v60.js';

export const QUALITY_RELIABILITY_VERSION='quality-reliability/v61';
export const QUALITY_RELIABILITY_SCHEMA='universal-quality-envelope/v1';

const STOPWORDS=new Set('a al algo como con contra de del el ella en entre es esta este esto la las lo los más me mi no o para pero por que qué se si sin sobre su sus un una y ya the a an and are as at be by for from how in is it of on or that the this to was what when where who why with'.split(/\s+/));
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):0));
const words=value=>String(value||'').trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)||[];
const normalizeToken=value=>String(value||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
const significant=value=>new Set(words(value).map(normalizeToken).filter(x=>x.length>2&&!STOPWORDS.has(x)));

function hardRequirements(prompt=''){
  const p=String(prompt||'');
  const exact=/\b(?:solo|solamente|únicamente|unicamente)\b[^.\n]{0,60}\b(?:palabra|número|numero|resultado|json)\b/i.test(p)||/\bdevuelve\s+(?:solo|únicamente|unicamente)\b/i.test(p);
  const json=/\b(?:solo|únicamente|unicamente)\s+json\b|\bjson\s+válido\b|\bjson\s+valido\b/i.test(p);
  const table=/\btabla\b/i.test(p);
  const bulletMatch=p.match(/(?:exactamente\s+)?(\d{1,2})\s+(?:viñetas|vinetas|bullets|puntos)\b/i);
  const maxWordsMatch=p.match(/(?:máximo|maximo|no más de|no mas de)\s+(\d{1,4})\s+palabras\b/i);
  return{exact,json,table,bullets:bulletMatch?Number(bulletMatch[1]):null,maxWords:maxWordsMatch?Number(maxWordsMatch[1]):null};
}

function instructionScore(prompt='',reply=''){
  const req=hardRequirements(prompt),failures=[];
  const trimmed=String(reply||'').trim();
  if(req.json){try{JSON.parse(trimmed)}catch{failures.push('invalid_json')}}
  if(req.table&&!/\|[^\n]+\|/.test(trimmed))failures.push('missing_table');
  if(req.bullets){
    const count=trimmed.split(/\n/).filter(line=>/^\s*(?:[-*+•]|\d+[.)])\s+/.test(line)).length;
    if(count!==req.bullets)failures.push(`bullet_count_${count}_expected_${req.bullets}`);
  }
  if(req.maxWords&&words(trimmed).length>req.maxWords)failures.push('word_limit_exceeded');
  if(req.exact&&/\n/.test(trimmed)&&words(trimmed).length>12)failures.push('exact_output_violated');
  return{score:clamp(100-failures.length*35),requirements:req,failures,hardFailure:failures.length>0};
}

function relevanceScore(prompt='',reply=''){
  const p=significant(prompt),r=significant(reply);
  if(!p.size)return 100;
  let overlap=0;for(const token of p)if(r.has(token))overlap++;
  const ratio=overlap/p.size;
  return clamp(35+ratio*65);
}

function clarityScore(reply=''){
  const text=String(reply||'').trim(),count=words(text).length;
  if(!count)return 0;
  let score=100;
  if(count>1800)score-=20;else if(count>900)score-=10;
  const paragraphs=text.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
  const seen=new Set();let duplicates=0;
  for(const paragraph of paragraphs){const key=normalizeToken(paragraph).replace(/\s+/g,' ').slice(0,180);if(seen.has(key))duplicates++;seen.add(key)}
  score-=duplicates*12;
  if(/\b(?:como ia|como inteligencia artificial|soy un modelo de lenguaje)\b/i.test(text))score-=8;
  return clamp(score);
}

function evidenceScore(audit={}){
  const gate=String(audit.gate||'PASS');
  if(gate==='HOLD')return 0;
  if(gate==='REPAIR')return 25;
  if(gate==='UNVERIFIED')return 45;
  if(gate==='REVIEW')return Math.max(55,clamp(Number(audit.citation_coverage||0)*100));
  if(Number(audit.factual_claims||0)>0)return clamp(Math.max(70,Number(audit.citation_coverage||0)*100));
  return 100;
}

function grade(score,critical){
  if(critical)return'HOLD';
  if(score>=92)return'A+';
  if(score>=85)return'A';
  if(score>=76)return'B';
  if(score>=65)return'C';
  return'REVIEW';
}

export function auditQualityReliability(payload={},context={}){
  const reply=String(payload?.reply??payload?.response?.content??'');
  const prompt=String(context?.prompt??payload?.request?.message??payload?.prompt??'');
  const ai=payload?.answer_intelligence||{};
  const instruction=instructionScore(prompt,reply);
  const evidence=evidenceScore(ai);
  const relevance=relevanceScore(prompt,reply);
  const clarity=clarityScore(reply);
  const answerGate=String(ai.gate||'PASS').toUpperCase();
  const critical=answerGate==='HOLD'||instruction.hardFailure;
  const score=clamp(instruction.score*.32+evidence*.32+relevance*.22+clarity*.14);
  const blockers=[];
  if(answerGate==='HOLD')blockers.push('answer_intelligence_hold');
  if(answerGate==='REPAIR')blockers.push('citation_repair_required');
  blockers.push(...instruction.failures);
  return{
    schema:QUALITY_RELIABILITY_SCHEMA,
    version:QUALITY_RELIABILITY_VERSION,
    score:Number(score.toFixed(1)),
    grade:grade(score,critical),
    critical_failure:critical,
    dimensions:{instruction:Number(instruction.score.toFixed(1)),evidence:Number(evidence.toFixed(1)),relevance:Number(relevance.toFixed(1)),clarity:Number(clarity.toFixed(1))},
    hard_requirements:instruction.requirements,
    blockers,
    promotion_eligible:!critical&&score>=85&&answerGate==='PASS',
    claim_policy:{benchmark_required_for_competitor_superiority:true,universal_superiority_claim:false,unverified_promotion:false}
  };
}

function holdText(audit){
  const reason=String(audit?.blockers?.[0]||'quality_gate');
  if(reason==='answer_intelligence_hold')return 'No puedo certificar esa afirmación como actual con la evidencia disponible. Necesito una fuente verificable antes de presentarla como un hecho.';
  return 'La respuesta no cumplió un requisito crítico de tu solicitud. Universal Core bloqueó la entrega para evitar darte una salida incorrecta o incompleta.';
}

export function applyQualityReliability(payload={},context={}){
  if(!payload||typeof payload!=='object')return payload;
  const enriched=payload.answer_intelligence?payload:applyAnswerIntelligence(payload);
  const audit=auditQualityReliability(enriched,context);
  let reply=String(enriched.reply??enriched?.response?.content??'').trim();
  if(audit.critical_failure)reply=holdText(audit);
  const response=enriched.response&&typeof enriched.response==='object'?enriched.response:{};
  const next={
    ...enriched,
    reply,
    quality_reliability:audit,
    response:{...response,content:reply,metadata:{...(response.metadata||{}),qualityReliability:{version:audit.version,score:audit.score,grade:audit.grade,criticalFailure:audit.critical_failure,dimensions:audit.dimensions,blockers:audit.blockers,promotionEligible:audit.promotion_eligible}}}
  };
  if(audit.critical_failure){
    if(Object.prototype.hasOwnProperty.call(next,'speech_text'))next.speech_text=reply;
    if(Object.prototype.hasOwnProperty.call(next,'components'))next.components=[];
    if(Object.prototype.hasOwnProperty.call(next,'actions'))next.actions=[];
    if(next.response&&typeof next.response==='object'){
      if(Object.prototype.hasOwnProperty.call(next.response,'speechText'))next.response.speechText=reply;
      if(Object.prototype.hasOwnProperty.call(next.response,'components'))next.response.components=[];
      if(Object.prototype.hasOwnProperty.call(next.response,'actions'))next.response.actions=[];
    }
  }
  return next;
}

export function qualityReliabilityCapabilities(){
  return{
    version:QUALITY_RELIABILITY_VERSION,
    schema:QUALITY_RELIABILITY_SCHEMA,
    dimensions:['instruction','evidence','relevance','clarity'],
    failClosedOn:['unsupported_live_claim','hard_instruction_violation'],
    minimumPromotionScore:85,
    promotionAnswerGates:['PASS'],
    unverifiedPromotion:false,
    competitorClaimRequiresBenchmark:true,
    universalSuperiorityClaim:false,
    baseModelTraining:false
  };
}
