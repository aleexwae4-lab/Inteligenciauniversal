const HEALTH_BLOCKED = new Set(['offline','disabled']);
const riskRx = /\b(médic|medical|diagn[oó]stic|tratamiento|dosis|legal|jur[ií]dic|penal|delito|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude|seguridad cr[ií]tica|alto riesgo|high[- ]risk)\b/i;
const codeRx = /```|\b(c[oó]digo|programa(?:r|ci[oó]n)?|typescript|javascript|python|sql|api|debug|bug|refactor|funci[oó]n|clase|github|deploy)\b/i;
const explicitWebRx = /\b(buscar en (?:la )?web|web research|internet|fuentes? web|citas? web|latest|actualizado|noticias?|verifica en l[ií]nea)\b/i;
const researchRx = /\b(investiga|investigaci[oó]n|estado del arte|revisi[oó]n de literatura|evidencia|contrasta fuentes?)\b/i;
const analysisRx = /\b(analiza|an[aá]lisis|compara|eval[uú]a|diagn[oó]stico|riesgo|trade[- ]?off|causa|estrategia|plan)\b/i;
const structuredRx = /\b(json|csv|tabla|estructur|extrae|clasifica|columnas?|filas?|dataset|datos)\b/i;
const creativeRx = /\b(crea|dise[nñ]a|copy|historia|guion|slogan|marca|branding|creativo)\b/i;
const enterpriseRx = /\b(empresa|negocio|saas|finanzas|ventas|operaciones|kpi|ebitda|cfo|ceo|cto|rrhh|recursos humanos|compliance|auditor[ií]a)\b/i;
const toolRx = /\b(ejecuta|ejecutar|env[ií]a|enviar|guarda|guardar|exporta|exportar|automatiza|automatizar|usa (?:la )?herramienta|tool execution|crear documento|genera (?:un )?pdf|abre (?:el )?workspace)\b/i;
const multimodalRx = /\b(imagen|foto|captura|screenshot|video|audio|visual|visi[oó]n|multimodal)\b/i;
const factualRx = /^\s*(qu[eé]|qui[eé]n|cu[aá]l|cu[aá]nto|d[oó]nde|cu[aá]ndo|define|explica)\b/i;
const simpleRx = /^\s*(hola|hey|buen(?:os|as)?\s+(?:d[ií]as|tardes|noches)|gracias|ok|vale|perfecto|listo|qu[eé] tal)[!?.\s]*$/i;

export function classifyTask({message='', mode='general', attachments=[]}={}) {
  const q=String(message||'').trim();
  const hasFiles=Array.isArray(attachments)&&attachments.length>0;
  let category='analysis';
  if (riskRx.test(q)) category='high_risk';
  else if (multimodalRx.test(q)) category='multimodal';
  else if (toolRx.test(q)) category='tool_execution';
  else if (hasFiles) category='document_analysis';
  else if (mode==='research' || explicitWebRx.test(q)) category='web_research';
  else if (researchRx.test(q)) category='research';
  else if (mode==='code' || codeRx.test(q)) category='coding';
  else if (structuredRx.test(q)) category='structured_data';
  else if (creativeRx.test(q) || mode==='design') category='creative';
  else if (enterpriseRx.test(q) || mode==='executive') category='enterprise';
  else if (simpleRx.test(q) || q.length<=24) category='simple_chat';
  else if (factualRx.test(q) && q.length<180) category='factual';
  else if (analysisRx.test(q) || mode==='analysis') category='analysis';
  else if (q.length>900) category='reasoning';
  else category='factual';

  const path = ['simple_chat','factual'].includes(category) ? 'FAST' :
    ['high_risk','web_research','research','reasoning'].includes(category) ? 'DEEP' : 'STANDARD';
  const risk = category==='high_risk' ? 'high' : (path==='DEEP' ? 'medium' : 'low');
  return {category,path,risk,complexity:path==='FAST'?'low':path==='STANDARD'?'medium':'high'};
}

export function capabilityRequirements(task,{mode='general',webEnabled=false,attachments=[]}={}) {
  const hasFiles=Array.isArray(attachments)&&attachments.length>0;
  const category=task?.category||'analysis';
  return {
    reasoning: task?.path==='DEEP'?'high':task?.path==='STANDARD'?'medium':'low',
    web: webEnabled===true || mode==='research' || category==='web_research',
    tools: category==='tool_execution',
    vision: category==='multimodal',
    files: hasFiles || category==='document_analysis',
    rag: hasFiles || category==='document_analysis',
    structured_output: ['structured_data','coding','enterprise','analysis','high_risk','tool_execution'].includes(category),
    context_window: hasFiles ? 32768 : (task?.path==='DEEP'?32768:8192),
    latency_priority: task?.path==='FAST'?'high':task?.path==='STANDARD'?'medium':'low',
    risk: task?.risk||'low',
    streaming: true
  };
}

function n(v,fallback=50){const x=Number(v);return Number.isFinite(x)?x:fallback}
function latencyScore(ms){if(!Number.isFinite(Number(ms)))return 50;return Math.max(0,100-Math.min(100,Number(ms)/120));}
function ttftScore(ms){if(!Number.isFinite(Number(ms)))return 50;return Math.max(0,100-Math.min(100,Number(ms)/40));}
function costScore(cost){if(cost===0||cost==='0')return 100;if(cost==null)return 55;const c=Number(cost);if(!Number.isFinite(c))return 55;return Math.max(0,100-Math.min(100,c*25));}

export function effectiveCircuit(model, now=Date.now()) {
  const health=String(model.effective_health||model.registry_health||model.health_status||'unknown').toLowerCase();
  if (HEALTH_BLOCKED.has(health) || String(model.circuit_state||'').toUpperCase()==='OPEN') return 'OPEN';
  const openUntil=Date.parse(model.reliability_open_until||model.circuit_open_until||'');
  if(Number.isFinite(openUntil)&&openUntil>now)return 'OPEN';
  if(String(model.circuit_state||'').toUpperCase()==='HALF_OPEN')return 'HALF_OPEN';
  return 'CLOSED';
}

export function capabilityMatch(model, req={}) {
  if(req.vision && !model.vision_capable)return 0;
  if(req.tools && !model.tools_capable)return 0;
  if(req.streaming && !model.streaming_capable)return 0;
  if(req.context_window && Number(model.context_window||0)<Number(req.context_window))return 0;
  let score=100;
  if(req.reasoning==='high' && !model.reasoning_capable)score-=25;
  if(req.structured_output && !model.structured_output_capable)score-=8;
  return Math.max(0,score);
}

export function weightsFor(path='STANDARD') {
  if(path==='FAST')return {quality:.18,reliability:.30,latency:.23,ttft:.17,cost:.07,capability:.05};
  if(path==='DEEP')return {quality:.40,reliability:.25,latency:.07,ttft:.04,cost:.04,capability:.20};
  return {quality:.30,reliability:.25,latency:.16,ttft:.09,cost:.05,capability:.15};
}

export function scoreModel(model, task, req) {
  const circuit=effectiveCircuit(model);
  if(circuit==='OPEN')return {...model,eligible:false,score:-Infinity,reason:'circuit_open'};
  const cap=capabilityMatch(model,req);
  if(cap<=0)return {...model,eligible:false,score:-Infinity,reason:'capability_mismatch'};
  const quality=n(model.eval_score ?? model.quality_score ?? model.reputation_score,70);
  const reliability=n(model.reliability_score ?? model.reputation_reliability_score,60);
  const latency=latencyScore(model.ewma_latency_ms);
  const ttft=ttftScore(model.ewma_ttft_ms);
  const cp=model.cost_profile||{};
  const groundedCost=(model.access_tier==='FREE'||model.access_tier==='LOCAL')?0:(cp.input_per_million ?? model.input_per_million ?? model.cost_input_per_million ?? null);
  const cost=costScore(groundedCost);
  const w=weightsFor(task?.path);
  let score=quality*w.quality+reliability*w.reliability+latency*w.latency+ttft*w.ttft+cost*w.cost+cap*w.capability;
  const health=String(model.effective_health||model.registry_health||'unknown').toLowerCase();
  if(health==='degraded')score-=12;
  if(health==='unknown')score-=5;
  if(circuit==='HALF_OPEN')score-=25;
  const minimum=task?.path==='FAST'?65:task?.path==='DEEP'?78:70;
  const sufficient=quality>=minimum && reliability>=45;
  if(!sufficient)score-=20;
  return {...model,eligible:true,score:Number(score.toFixed(3)),quality,reliability,capability_score:cap,sufficient,circuit_state:circuit};
}

export function rankModels(models=[],task,req) {
  const ranked=models.map(m=>scoreModel(m,task,req)).filter(m=>m.eligible).sort((a,b)=>b.score-a.score);
  const sufficient=ranked.filter(x=>x.sufficient && x.circuit_state==='CLOSED');
  if(sufficient.length)return sufficient;
  const closed=ranked.filter(x=>x.circuit_state==='CLOSED');
  return closed.length?closed:ranked;
}

export function estimateCostMicrounits(model,inputTokens,outputTokens,{searchCostUsd=0,toolCostUsd=0}={}) {
  if(['FREE','LOCAL'].includes(String(model?.access_tier||'').toUpperCase()) && Number(searchCostUsd||0)===0 && Number(toolCostUsd||0)===0)return 0;
  const cp=model?.cost_profile||{};
  const inputRate=Number(cp.input_per_million);
  const outputRate=Number(cp.output_per_million);
  if(!Number.isFinite(inputRate)||!Number.isFinite(outputRate))return null;
  const usd=(Math.max(0,Number(inputTokens)||0)/1e6)*inputRate+(Math.max(0,Number(outputTokens)||0)/1e6)*outputRate+Number(searchCostUsd||0)+Number(toolCostUsd||0);
  return Math.round(usd*1e6);
}

export function promotionGate(current,candidate,{qualityTolerance=2,maxErrorRegression=0.005}={}) {
  const reasons=[];
  if(Number.isFinite(current?.quality)&&Number.isFinite(candidate?.quality)&&candidate.quality<current.quality-qualityTolerance)reasons.push('quality_regression');
  if(Number.isFinite(current?.error_rate)&&Number.isFinite(candidate?.error_rate)&&candidate.error_rate>current.error_rate+maxErrorRegression)reasons.push('error_rate_regression');
  if(Number.isFinite(current?.p95_latency)&&Number.isFinite(candidate?.p95_latency)&&candidate.p95_latency>=current.p95_latency)reasons.push('p95_latency_not_improved');
  if(Number.isFinite(current?.p95_ttft)&&Number.isFinite(candidate?.p95_ttft)&&candidate.p95_ttft>=current.p95_ttft)reasons.push('p95_ttft_not_improved');
  if(Number(candidate?.security_regressions||0)>0)reasons.push('security_regression');
  return {pass:reasons.length===0,reasons};
}
