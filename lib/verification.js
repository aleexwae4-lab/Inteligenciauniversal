const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const CURRENT_RX=/\b(hoy|ahora|actual(?:es|idad|izado|izada)?|reciente|ultim[oa]s?|latest|today|current|news|noticias|precio|cotizacion|jurisprudencia|reforma|ley vigente)\b/i;
const SOURCE_RX=/\b(fuentes?|citas?|referencias?|links?|enlaces?|investiga|investigacion|verifica)\b/i;
const EVIDENCE_SOURCE_RX=/\b(?:busca|investiga|encuentra|muestra|muestrame|dame|aporta|cita|verifica)\b[\s\S]{0,60}\b(?:evidencia|evidence)\b|\b(?:evidencia|evidence)\b[\s\S]{0,40}\b(?:sobre|cientifica|actual|externa|fuentes?|sources?)\b/i;
const TABLE_RX=/\b(tabla|cuadro comparativo|matriz)\b/i;
const JSON_RX=/\b(json)\b/i;
const CODE_REQUEST_RX=/\b(escribe|crea|genera|implementa|corrige|depura|debug|refactoriza|programa|construye|dame)\b[\s\S]{0,80}\b(codigo|script|funcion|function|clase|endpoint|api|sql|typescript|javascript|python)\b|\b(codigo|script|funcion|function|clase|endpoint)\b[\s\S]{0,80}\b(escribe|crea|genera|implementa|corrige|depura|refactoriza|programa|construye|dame)\b/i;
const COMPARE_RX=/\b(compara|comparacion|versus|vs\.?|diferencias?|diferencia entre|mejor que)\b/i;
const RISK_RX=/\b(riesgos?|risk|fallos?|failure modes?|amenazas?|vulnerabilidades?)\b/i;
const STEPS_RX=/\b(paso a paso|pasos|plan de implementacion|plan de accion|roadmap|hoja de ruta)\b/i;
const PROS_CONS_RX=/\b(pros? y contras?|ventajas? y desventajas?|beneficios? y riesgos?)\b/i;
const CITATION_MARK_RX=/\[(?:W|S)\d+\]|https?:\/\/|\bfuente\s*:/i;
const COMPARATIVE_ANSWER_RX=/\b(mientras que|frente a|en cambio|diferencia|ventaja|desventaja|superior|inferior|versus|vs\.?|compar)\b/i;
const RISK_ANSWER_RX=/\b(riesgo|fallo|amenaza|vulnerabilidad|mitig|limitacion|limitación|trade[- ]?off)\b/i;
const STEP_ITEM_RX=/(?:^|\n)\s*(?:\d+[.)]|[-*•])\s+/g;

function namedNumber(value=''){
  const map={uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
  return map[fold(value)]||0;
}

function requestedCount(question=''){
  const q=String(question||'');
  const numeric=q.match(/\b(\d{1,2})\s+(?:puntos|pasos|ideas|opciones|claves|razones|recomendaciones|ejemplos|alternativas)\b/i);
  if(numeric)return Math.min(20,Math.max(1,Number(numeric[1])));
  const named=q.match(/\b(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:puntos|pasos|ideas|opciones|claves|razones|recomendaciones|ejemplos|alternativas)\b/i);
  return named?namedNumber(named[1]):0;
}

function requestedWordLimit(question=''){
  const q=fold(question);
  const patterns=[
    /(?:maximo|máximo|no mas de|hasta)\s+(\d{1,4})\s+palabras/,
    /(?:en)\s+(\d{1,4})\s+palabras\s+(?:o menos|maximo)/,
    /(\d{1,4})\s+palabras\s+(?:maximo|como maximo)/
  ];
  for(const rx of patterns){const m=q.match(rx);if(m)return Math.min(4000,Math.max(1,Number(m[1])))}
  return 0;
}

function requestedExactPhrase(question=''){
  const q=String(question||'').trim();
  const quoted=q.match(/\b(?:responde|contesta|devuelve)\s+(?:exactamente|solamente|solo)\s+(?:con\s+)?[“"']([^”"']{1,160})[”"']/i);
  if(quoted)return quoted[1].trim();
  const word=q.match(/\b(?:responde|contesta|devuelve)\s+(?:exactamente|solamente|solo)\s+(?:con\s+)?(?:la\s+)?palabra\s+([\p{L}\p{N}_-]{1,80})/iu);
  return word?word[1].trim():'';
}

export function deriveRequirementContract(question='',mode='general'){
  const raw=String(question||'').trim(),q=fold(raw),requestedListCount=requestedCount(raw),wordLimit=requestedWordLimit(raw),exactPhrase=requestedExactPhrase(raw);
  const requiresSources=String(mode||'general')==='research'||CURRENT_RX.test(q)||SOURCE_RX.test(q)||EVIDENCE_SOURCE_RX.test(q);
  const requiresCitations=/\b(cita|citas|citar|referencias?|fuentes? enlazadas?)\b/i.test(q);
  const requiresTable=TABLE_RX.test(q);
  const requiresJson=JSON_RX.test(q)&&/\b(devuelve|responde|formato|entrega|genera|salida|output)\b/i.test(q);
  const requiresCode=CODE_REQUEST_RX.test(q);
  const requiresComparison=COMPARE_RX.test(q);
  const requiresRisks=RISK_RX.test(q);
  const requiresSteps=STEPS_RX.test(q);
  const requiresProsCons=PROS_CONS_RX.test(q);
  const active=[requiresSources,requiresCitations,requiresTable,requiresJson,requiresCode,requiresComparison,requiresRisks,requiresSteps,requiresProsCons,requestedListCount>0,wordLimit>0,!!exactPhrase].filter(Boolean).length;
  return{
    schema:'universal-requirements/v1',
    active,
    requestedListCount,
    wordLimit,
    exactPhrase,
    requiresSources,
    requiresCitations,
    requiresTable,
    requiresJson,
    requiresCode,
    requiresComparison,
    requiresRisks,
    requiresSteps,
    requiresProsCons
  };
}

function validJson(answer=''){
  const raw=String(answer||'').trim();
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  try{JSON.parse(fenced||raw);return true}catch{return false}
}

export function evaluateRequirementCoverage({contract,answer='',sources=[]}={}){
  const c=contract||deriveRequirementContract(''),a=String(answer||'').trim(),checks=[];
  const add=(id,required,passed,hard=false,detail=null)=>{if(required)checks.push({id,passed:!!passed,hard,detail})};
  const listCount=(a.match(STEP_ITEM_RX)||[]).length;
  const wordCount=(a.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’_-]*\b/gu)||[]).length;
  const hasTable=/^\s*\|?.+\|.+\|?\s*$[\s\S]*^\s*\|?\s*:?-{3,}/m.test(a);
  const hasCode=/```(?:[a-z0-9_+#.-]+)?\s*[\s\S]+?```/i.test(a);
  const hasSources=Array.isArray(sources)&&sources.length>0;
  const hasCitation=CITATION_MARK_RX.test(a);
  const hasPros=/\b(ventaja|beneficio|pros?\b|a favor|fortaleza)\b/i.test(a);
  const hasCons=/\b(desventaja|contra\b|riesgo|limitacion|limitación|debilidad)\b/i.test(a);

  add('list_count',c.requestedListCount>0,listCount>=c.requestedListCount,true,{expected:c.requestedListCount,actual:listCount});
  add('table',c.requiresTable,hasTable,true);
  add('json',c.requiresJson,validJson(a),true);
  add('code',c.requiresCode,hasCode,true);
  add('sources',c.requiresSources,hasSources,true,{sourceCount:Array.isArray(sources)?sources.length:0});
  add('citations',c.requiresCitations,hasSources&&hasCitation,true);
  add('comparison',c.requiresComparison,hasTable||COMPARATIVE_ANSWER_RX.test(a),false);
  add('risks',c.requiresRisks,RISK_ANSWER_RX.test(a),false);
  add('steps',c.requiresSteps,listCount>=2||/\b(primero|despues|después|finalmente|fase\s+\d|paso\s+\d)\b/i.test(a),false);
  add('pros_cons',c.requiresProsCons,hasPros&&hasCons,false);
  add('word_limit',c.wordLimit>0,wordCount<=c.wordLimit,true,{limit:c.wordLimit,actual:wordCount});
  add('exact_phrase',!!c.exactPhrase,a===c.exactPhrase,true,{expected:c.exactPhrase});

  if(!checks.length)return{schema:'universal-requirement-coverage/v1',coverage:1,pass:true,hardFailure:false,missing:[],checks:[],wordCount,listCount};
  const passed=checks.filter(x=>x.passed).length,missing=checks.filter(x=>!x.passed).map(x=>x.id),hardFailure=checks.some(x=>x.hard&&!x.passed),coverage=passed/checks.length;
  return{schema:'universal-requirement-coverage/v1',coverage:Number(coverage.toFixed(3)),pass:missing.length===0,hardFailure,missing,checks,wordCount,listCount};
}

export function verificationInstruction(contract={}){
  if(!contract?.active)return'';
  const requirements=[];
  if(contract.requestedListCount)requirements.push(`incluye al menos ${contract.requestedListCount} elementos claramente distinguibles`);
  if(contract.requiresTable)requirements.push('entrega la tabla solicitada');
  if(contract.requiresJson)requirements.push('devuelve JSON válido');
  if(contract.requiresCode)requirements.push('incluye código ejecutable en bloque de código');
  if(contract.requiresSources)requirements.push('usa evidencia/fuentes reales disponibles');
  if(contract.requiresCitations)requirements.push('cita las fuentes en el cuerpo de la respuesta');
  if(contract.requiresComparison)requirements.push('haz explícita la comparación');
  if(contract.requiresRisks)requirements.push('incluye riesgos y mitigaciones relevantes');
  if(contract.requiresSteps)requirements.push('presenta una secuencia accionable');
  if(contract.requiresProsCons)requirements.push('cubre ventajas y desventajas');
  if(contract.wordLimit)requirements.push(`no excedas ${contract.wordLimit} palabras`);
  if(contract.exactPhrase)requirements.push(`responde exactamente: ${contract.exactPhrase}`);
  return requirements.length?`\n\nCONTRATO DE ENTREGA VERIFICABLE:\n- ${requirements.join('\n- ')}\nAntes de finalizar comprueba que todos estos requisitos estén presentes.`:'';
}
