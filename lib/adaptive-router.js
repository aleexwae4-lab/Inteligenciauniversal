const rx={
  simple:/^\s*(hola|hey|buen(?:os|as)?\s+(?:d[ií]as|tardes|noches)|gracias|ok|vale|perfecto|listo|qu[eé] tal)[!?.\s]*$/i,
  risk:/\b(m[eé]dic|diagn[oó]stic|tratamiento|dosis|legal|jur[ií]dic|penal|delito|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude|seguridad cr[ií]tica|alto riesgo|high[- ]risk)\b/i,
  code:/```|\b(c[oó]digo|programa(?:r|ci[oó]n)?|typescript|javascript|python|sql|api|debug|bug|refactor|funci[oó]n|clase|github|deploy)\b/i,
  research:/\b(investiga|investigaci[oó]n|fuentes?|citas?|buscar en (?:la )?web|web research|latest|actualizado|verifica|evidencia)\b/i,
  analysis:/\b(analiza|an[aá]lisis|compara|eval[uú]a|diagn[oó]stico|riesgo|trade[- ]?off|causa|estrategia|plan)\b/i,
  structured:/\b(json|csv|tabla|estructur|extrae|clasifica|columnas?|filas?|dataset|datos)\b/i,
  creative:/\b(crea|dise[nñ]a|copy|historia|guion|slogan|marca|branding|creativo)\b/i,
  enterprise:/\b(empresa|negocio|saas|finanzas|ventas|operaciones|kpi|ebitda|cfo|ceo|cto|rrhh|recursos humanos|compliance|auditor[ií]a)\b/i,
  factual:/^\s*(qu[eé]|qui[eé]n|cu[aá]l|cu[aá]nto|d[oó]nde|cu[aá]ndo|define|explica)\b/i
};

export function classifyTask(message,{mode='general',attachments=[]}={}){
  const q=String(message||'').trim(); let category='analysis';
  if(rx.risk.test(q))category='high_risk';
  else if(attachments.length)category='document_analysis';
  else if(mode==='research'||rx.research.test(q))category='web_research';
  else if(mode==='code'||rx.code.test(q))category='coding';
  else if(rx.structured.test(q))category='structured_data';
  else if(rx.creative.test(q)||mode==='design')category='creative';
  else if(rx.enterprise.test(q)||mode==='executive')category='enterprise';
  else if(rx.simple.test(q)||q.length<=24)category='simple_chat';
  else if(rx.factual.test(q)&&q.length<180)category='factual';
  else if(rx.analysis.test(q)||mode==='analysis')category='analysis';
  else if(q.length>900)category='reasoning';
  else category='factual';
  const path=['simple_chat','factual'].includes(category)?'FAST':['high_risk','web_research','reasoning'].includes(category)?'DEEP':'STANDARD';
  return {category,path,risk:category==='high_risk'?'high':path==='DEEP'?'medium':'low',complexity:path==='FAST'?'low':path==='STANDARD'?'medium':'high'};
}

export function capabilityRequirements(task,{mode='general',webEnabled=false,attachments=[],stream=false}={}){
  const files=attachments.length>0;
  return {reasoning:task.path==='DEEP'?'high':task.path==='STANDARD'?'medium':'low',web:webEnabled||mode==='research'||task.category==='web_research',tools:task.category==='tool_execution',vision:task.category==='multimodal',files:files||task.category==='document_analysis',rag:files||task.category==='document_analysis',structuredOutput:['structured_data','coding','enterprise','analysis','high_risk'].includes(task.category),contextWindow:files||task.path==='DEEP'?32768:8192,latencyPriority:task.path==='FAST'?'high':task.path==='STANDARD'?'medium':'low',risk:task.risk,streaming:stream===true};
}

const num=(v,f=50)=>Number.isFinite(Number(v))?Number(v):f;
const latencyScore=ms=>Number.isFinite(Number(ms))?Math.max(0,100-Math.min(100,Number(ms)/120)):50;
const ttftScore=ms=>Number.isFinite(Number(ms))?Math.max(0,100-Math.min(100,Number(ms)/40)):50;
const weights=path=>path==='FAST'?{q:.18,r:.30,l:.23,t:.17,c:.07,m:.05}:path==='DEEP'?{q:.40,r:.25,l:.07,t:.04,c:.04,m:.20}:{q:.30,r:.25,l:.16,t:.09,c:.05,m:.15};

export function streamEligible(model,{now=Date.now(),retryAfterMs=6*60*60*1000}={}){
  if(!model.streamingClaimed)return false;
  if(model.streamingVerified)return true;
  const probes=num(model.streamingProbeCount,0),failed=Date.parse(String(model.lastStreamFailureAt||''));
  return probes===0||!Number.isFinite(failed)||now-failed>retryAfterMs;
}

export function shouldOpenCircuit({status=0,errorClass='',consecutiveFailures=1}={}){
  if(status===401||status===403||errorClass==='auth')return {open:true,minutes:60,reason:'auth'};
  if(status===429||errorClass==='rate_limit')return {open:true,minutes:10,reason:'rate_limit'};
  if((status>=500||['timeout','server'].includes(errorClass))&&consecutiveFailures>=3)return {open:true,minutes:10,reason:errorClass||'server'};
  return {open:false,minutes:0,reason:errorClass||'other'};
}

function costScore(m){const i=Number(m.inputPerMillion),o=Number(m.outputPerMillion);if(i===0&&o===0)return 100;if(!Number.isFinite(i)||!Number.isFinite(o))return 55;return Math.max(0,100-Math.min(100,(i+o)*12));}
function capabilityMatch(m,req){if(req.vision&&!m.visionCapable)return 0;if(req.tools&&!m.toolsCapable)return 0;if(req.streaming&&!streamEligible(m))return 0;if(req.contextWindow&&num(m.contextWindow,0)<req.contextWindow)return 0;let z=100;if(req.reasoning==='high'&&!m.reasoningCapable)z-=25;if(req.structuredOutput&&!m.structuredOutputCapable)z-=8;if(req.streaming&&m.streamingVerified)z+=8;return Math.max(0,Math.min(108,z));}

export function scoreModel(model,task,req){
  const cap=capabilityMatch(model,req); if(cap<=0)return {...model,eligible:false,score:-999};
  const quality=num(model.taskQuality??model.evalScore??model.qualityScore??model.reputationScore,70),reliability=num(model.reliabilityScore??model.reputationReliabilityScore,60),w=weights(task.path);
  let score=quality*w.q+reliability*w.r+latencyScore(model.ewmaLatencyMs)*w.l+ttftScore(model.ewmaTtftMs)*w.t+costScore(model)*w.c+cap*w.m;
  const health=String(model.effectiveHealth||model.health||'unknown').toLowerCase();
  if(health==='degraded')score-=12;if(health==='unknown')score-=5;if(model.circuitState==='HALF_OPEN')score-=25;
  const minimum=task.path==='FAST'?65:task.path==='DEEP'?78:70,sufficient=quality>=minimum&&reliability>=45;if(!sufficient)score-=20;
  return {...model,eligible:true,quality,reliability,sufficient,score:Number(score.toFixed(3))};
}

export function rankModels(models,task,req){
  const candidates=models.filter(m=>m.enabled!==false&&m.circuitState!=='OPEN'&&String(m.effectiveHealth||m.health||'').toLowerCase()!=='offline').filter(m=>!req.streaming||streamEligible(m)).map(m=>scoreModel(m,task,req)).filter(m=>m.eligible).sort((a,b)=>b.score-a.score);
  const good=candidates.filter(m=>m.sufficient&&m.circuitState==='CLOSED');const closed=candidates.filter(m=>m.circuitState==='CLOSED');return good.length?good:closed.length?closed:candidates;
}

export function estimateCostMicrounits({inputTokens=0,outputTokens=0,inputPerMillion,outputPerMillion}={}){
  const i=Number(inputPerMillion),o=Number(outputPerMillion);if(!Number.isFinite(i)||!Number.isFinite(o))return null;return Math.round(((Number(inputTokens)/1e6)*i+(Number(outputTokens)/1e6)*o)*1e6);
}

export function promotionGate(current,candidate,{qualityTolerance=1}={}){
  const failures=[];
  if(num(candidate.quality,-Infinity)<num(current.quality,-Infinity)-qualityTolerance)failures.push('quality');
  if(num(candidate.errorRate,Infinity)>num(current.errorRate,Infinity))failures.push('error_rate');
  if(num(candidate.p95Latency,Infinity)>=num(current.p95Latency,Infinity))failures.push('p95_latency');
  if(Number.isFinite(Number(current.p95Ttft))&&num(candidate.p95Ttft,Infinity)>=num(current.p95Ttft,Infinity))failures.push('p95_ttft');
  if(num(candidate.securityRegressions,Infinity)!==0)failures.push('security_regressions');
  return {pass:failures.length===0,failures};
}
