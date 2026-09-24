import { deriveRequirementContract, evaluateRequirementCoverage, verificationInstruction } from './verification.js';

const CURRENT_RX=/\b(hoy|ahora|actual(?:es|idad|izado|izada)?|reciente|últim[oa]s?|latest|today|current|news|noticias|precio|cotización|jurisprudencia|reforma|ley vigente|verifica|fuentes?|evidencia|web)\b/i;
// Archiving an attached file is not a request to browse current web evidence.
const ARCHIVE_RX=/\b(conserva|guarda|archiva|preserva)\b.{0,70}\b(evidencia|archivo|documento|datos)\b/i;
const RESEARCH_RX=/\b(investiga|investigación|compara fuentes|mercado|competidor|benchmark|tendencia|estadística)\b/i;
const CODE_RX=/```|\b(código|programa(?:r|ción)?|typescript|javascript|python|sql|api|backend|frontend|debug|bug|refactor|github|deploy|supabase|render|vercel)\b/i;
const DESIGN_RX=/\b(diseñ|ux|ui|interfaz|experiencia|flujo|pantalla|responsive|móvil|branding|producto visual)\b/i;
const ANALYSIS_RX=/\b(analiza|análisis|audita|diagnóstico|estrategia|riesgo|finanzas|roi|prioridad|decisión|compara|arquitectura)\b/i;
const FAILURE_RX=/no pude completar|vuelve a intentarlo|no puedo responder|all_models_unavailable|continuity_pass_through|runtime unavailable|generation failed|respuesta no llegó completa|todos los proveedores configurados fallaron/i;
const LEAK_RX=/Language Policy|RELEVANT MEMORY|system_guidance|Role:\s*Advanced|chain[- ]of[- ]thought|hidden reasoning/i;
const STOP=new Set('que qué como cómo para por con sin una uno unos unas del las los el la y o de en es son ser se su sus al un ya más mas muy este esta estos estas esto esa ese esos esas mi mis tu tus lo le les nos me te a e u si no pero sobre entre desde hasta where what how why when who which the and or for with without from into this that these those your you our are is be was were'.split(/\s+/));

const words=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(w=>!STOP.has(w))||[];
const unique=xs=>[...new Set(xs)];

function responseProfile(q=''){
  const n=String(q||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  const history=/\b(cuentame la historia|historia de|origen de|como surgio|como nacio|evolucion de|history of|origin of|how did .* start)\b/.test(n);
  const identity=/\b(quien es|quien era|quienes son|quienes eran|sabes quien|sabes quienes|who is|who was|who are|who were)\b/.test(n);
  const quantitative=/\b(cuanto|cuanta|cuantos|cuantas|how many|how much)\b/.test(n)&&/\b(tiene|tienen|hay|son|existen|mide|miden|pesa|pesan|dura|duran|contiene|contienen|is|are|does)\b/.test(n);
  const factual=identity||quantitative||/\b(que es|que significa|cuando fue|donde fue|what is|what does|when was|where was)\b/.test(n);
  const separators=(n.match(/,|\by\b|\be\b|\band\b/g)||[]).length;
  if(history)return'history';
  if(identity&&separators>=2)return'multi-entity';
  if(factual)return'factual';
  return'adaptive';
}

export function inferCognitivePolicy(message='',requestedMode='general'){
  const q=String(message||'').trim(),requested=String(requestedMode||'general').toLowerCase();
  let mode=['research','code','analysis','design','executive'].includes(requested)?requested:'general';
  const localEvidenceArchive=ARCHIVE_RX.test(q)&&!/\b(hoy|ahora|actual|reciente|noticias|web|internet|busca|investiga|verifica)\b/i.test(q);
  if(mode==='general'){
    if(RESEARCH_RX.test(q)||(CURRENT_RX.test(q)&&!localEvidenceArchive))mode='research';
    else if(CODE_RX.test(q))mode='code';
    else if(DESIGN_RX.test(q))mode='design';
    else if(ANALYSIS_RX.test(q))mode='analysis';
  }
  const autoResearch=mode==='research'||(!localEvidenceArchive&&CURRENT_RX.test(q))||RESEARCH_RX.test(q);
  const requirements=deriveRequirementContract(q,mode);
  return {mode,autoResearch,path:autoResearch?'evidence-first':mode==='code'?'engineering':mode==='analysis'?'reasoning':mode==='design'?'product':'general',responseProfile:responseProfile(q),requirements};
}

export function routingPrefix(policy={}){
  const calibration='Responde el objetivo real del usuario. Evita superlativos, absolutos y afirmaciones no sustentadas. Distingue hechos de inferencias. No inventes fuentes, personas, fechas, métricas, capacidades, acciones ejecutadas ni estado actual. Antes de finalizar verifica que cubriste todos los requisitos explícitos y que no contradices el contexto. Usa sólo la estructura necesaria para que la respuesta sea clara.\n\n';
  const profile=policy.responseProfile==='history'
    ?'Cuenta la respuesta cronológicamente en 3 a 5 fases significativas y prioriza causalidad sobre detalle decorativo.\n\n'
    :policy.responseProfile==='multi-entity'
      ?'Responde cada entidad con una etiqueta compacta y 2 a 3 frases útiles; evita repetir campos o cerrar con un resumen innecesario.\n\n'
      :policy.responseProfile==='factual'
        ?'Contesta el hecho inmediatamente en un párrafo breve o pocos puntos; evita convertir una pregunta simple en un informe ejecutivo.\n\n'
        :'Adapta profundidad a la dificultad: conciso en preguntas simples y amplio sólo cuando el análisis, los trade-offs o la implementación lo exijan.\n\n';
  const verified=verificationInstruction(policy.requirements);
  if(policy.autoResearch)return `Investiga y verifica con evidencia web reciente antes de responder. Distingue hechos verificados de inferencias y cita las fuentes disponibles.\n\n${profile}${calibration}${verified}`;
  if(policy.mode==='code')return `Resuelve como ingeniería de producción: implementación concreta, pruebas, seguridad y fallos previsibles.\n\n${profile}${calibration}${verified}`;
  if(policy.mode==='analysis')return `Analiza con conclusión primero, supuestos, riesgos, trade-offs, métricas y próximos pasos concretos.\n\n${profile}${calibration}${verified}`;
  if(policy.mode==='design')return `Resuelve como diseño de producto de producción: flujo, estados, jerarquía, accesibilidad y criterios de calidad.\n\n${profile}${calibration}${verified}`;
  return `${profile}${calibration}${verified}`;
}

function sentenceRepeat(answer=''){
  const parts=String(answer).split(/[.!?]\s+/).map(x=>x.trim().toLowerCase()).filter(x=>x.length>35);
  if(parts.length<3)return 0;
  return 1-(new Set(parts).size/parts.length);
}

function requestedCount(q=''){
  const numeric=String(q).match(/\b(\d{1,2})\s+(?:puntos|pasos|ideas|opciones|claves|razones|recomendaciones)\b/i);
  if(numeric)return Math.min(10,Math.max(1,Number(numeric[1])));
  const named={dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
  for(const [name,value] of Object.entries(named))if(new RegExp(`\\b${name}\\s+(?:puntos|pasos|ideas|opciones|claves|razones|recomendaciones)\\b`,'i').test(q))return value;
  return 0;
}

export function evaluateAnswer({question='',answer='',mode='general',sources=[]}={}){
  const q=String(question||'').trim(),a=String(answer||'').trim(),reasons=[];
  const failure=FAILURE_RX.test(a),leak=LEAK_RX.test(a);
  if(failure)reasons.push('failure_phrase');
  if(leak)reasons.push('internal_leak');
  if(!a)reasons.push('empty');

  const qWords=unique(words(q)).slice(0,18),aWords=new Set(words(a));
  const overlap=qWords.length?Math.min(1,qWords.filter(w=>aWords.has(w)).length/Math.min(6,qWords.length)):1;
  let relevance=q.length<55?Math.max(.72,overlap):Math.max(.25,overlap);
  const target=q.length>700?650:q.length>240?420:q.length>90?260:90;
  const length=Math.min(1,a.length/target);
  const wanted=requestedCount(q),listCount=(a.match(/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+/g)||[]).length;
  let structure=.86;
  if(wanted)structure=Math.min(1,listCount/Math.max(1,wanted));
  else if(/\b(tabla|table)\b/i.test(q))structure=/\|.+\|/.test(a)?1:.35;
  else if(CODE_RX.test(q))structure=/```[\s\S]+```/.test(a)?1:.55;
  if(wanted && structure>=.99 && overlap>0 && a.length>=120) relevance=Math.max(relevance,.72);

  let evidence=.9;
  const research=mode==='research'||(!ARCHIVE_RX.test(q)&&CURRENT_RX.test(q))||RESEARCH_RX.test(q);
  if(research){
    if(Array.isArray(sources)&&sources.length)evidence=/\[W\d+\]/i.test(a)?1:.68;
    else evidence=.58;
  }
  const repetition=sentenceRepeat(a);
  if(repetition>.34)reasons.push('repetition');

  const requirementContract=deriveRequirementContract(q,mode);
  const requirementCoverage=evaluateRequirementCoverage({contract:requirementContract,answer:a,sources});
  const requirements=requirementCoverage.coverage;
  for(const missing of requirementCoverage.missing)reasons.push(`missing_requirement:${missing}`);
  if(requirementCoverage.coverage<.75)reasons.push('requirement_coverage_low');

  let score=.28*relevance+.18*length+.14*structure+.12*evidence+.10*(1-Math.min(1,repetition))+.18*requirements;
  if(relevance<.45)score=Math.min(score,.55);
  if(requirementCoverage.hardFailure)score=Math.min(score,.64);
  else if(requirementCoverage.coverage<.6)score=Math.min(score,.62);
  if(failure)score=Math.min(score,.08);
  if(leak)score=0;
  if(!a)score=0;
  score=Math.max(0,Math.min(1,score));

  if(relevance<.45)reasons.push('low_relevance');
  if(length<.45)reasons.push('too_short');
  if(structure<.6)reasons.push('requested_structure_missing');
  if(research&&evidence<.65)reasons.push('insufficient_evidence');

  const pass=score>=.68&&!requirementCoverage.hardFailure;
  return {
    schema:'universal-quality/v1',
    verifier:'cognitive-verification/v34',
    score:Number(score.toFixed(3)),
    pass,
    critical:score<.42,
    reasons:[...new Set(reasons)],
    requirementContract,
    requirementCoverage,
    signals:{
      relevance:Number(relevance.toFixed(3)),
      length:Number(length.toFixed(3)),
      structure:Number(structure.toFixed(3)),
      evidence:Number(evidence.toFixed(3)),
      repetition:Number(repetition.toFixed(3)),
      requirements:Number(requirements.toFixed(3))
    }
  };
}

export function repairInstruction(quality){
  const issues=Array.isArray(quality?.reasons)&&quality.reasons.length?quality.reasons.join(', '):'quality_below_threshold';
  const missing=Array.isArray(quality?.requirementCoverage?.missing)&&quality.requirementCoverage.missing.length?` Missing explicit requirements: ${quality.requirementCoverage.missing.join(', ')}.`:'';
  return `\n\nQUALITY RECOVERY: the previous draft did not meet the production answer contract (${issues}).${missing} Produce a new final answer from scratch. Answer the actual request completely, avoid generic status text, preserve exact facts, use evidence when required, and follow every requested structure or output constraint. Return only the improved final answer.`;
}
