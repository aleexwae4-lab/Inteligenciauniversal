export const MULTIMODAL_VERIFICATION_LOOP_VERSION='multimodal-verification-loop/v1';

function clean(s='',n=700){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function uniq(xs=[]){return [...new Set((Array.isArray(xs)?xs:[]).filter(Boolean))]}
function ids(x){return uniq([...(x?.sourceFileIds||[]),x?.sourceFileId])}

export function buildMultimodalVerificationLoop({synthesis=null,composer=null,toolResults=[]}={}){
  if(!synthesis&&!composer)return null;
  const tasks=[], seen=new Set();
  const add=(type,statement,sourceFileIds=[],reason='',preferredVerifier='manual_review')=>{
    const key=type+'|'+clean(statement,240);
    if(!statement||seen.has(key))return;
    seen.add(key);
    tasks.push({id:'verification-'+(tasks.length+1),type,statement:clean(statement),sourceFileIds:uniq(sourceFileIds),reason:clean(reason,360),preferredVerifier,status:'pending',result:null,provenanceRequired:true});
  };
  (synthesis?.conflictPoints||[]).slice(0,8).forEach(x=>add('conflict',x.statements?.join(' / ')||x.statement||'',ids(x),'Existen señales incompatibles entre fuentes; requieren comprobación independiente.','web_search_or_additional_source'));
  (synthesis?.causalClaims||[]).slice(0,8).forEach(x=>add('causal_claim',x.statement,ids(x),'La relación causal está expresada como afirmación y no debe tratarse como causalidad demostrada.','web_search_or_additional_source'));
  (synthesis?.unresolvedQuestions||[]).slice(0,12).forEach(x=>add('unresolved',x.reason||x.question||'',ids(x),x.reason||'La evidencia disponible no resuelve esta cuestión.','document_local_or_web_search'));
  (synthesis?.verificationNeeded||[]).slice(0,12).forEach(x=>add(x.type||'verification_needed',x.reason||x.statement||'',ids(x),x.reason||'El motor de síntesis marcó esta afirmación para verificación.','web_search_or_additional_source'));
  (synthesis?.temporalSequence||[]).slice(0,8).forEach(x=>{
    if((x.signals||[]).length) add('temporal_order',x.statement,ids(x),'La secuencia depende de señales temporales; comprobar con fechas/localizadores explícitos.','document_local_or_web_search');
  });
  const results=Array.isArray(toolResults)?toolResults:[];
  const web=results.find(x=>x.tool==='web_search'&&x.ok&&Array.isArray(x.data));
  if(web){
    for(const task of tasks){
      const matches=web.data.filter(r=>{
        const hay=clean((r.title||'')+' '+(r.content||''),2500).toLowerCase();
        const words=clean(task.statement,300).toLowerCase().split(/[^a-záéíóúüñ0-9]+/i).filter(w=>w.length>=5).slice(0,6);
        return words.length>=2&&words.filter(w=>hay.includes(w)).length>=2;
      }).slice(0,3);
      if(matches.length)task.status='evidence_found',task.result={status:'evidence_found',sources:matches.map(r=>({title:clean(r.title,220),url:String(r.url||'').slice(0,1200),snippet:clean(r.content,500)}))};
    }
  }
  return {version:MULTIMODAL_VERIFICATION_LOOP_VERSION,tasks:tasks.slice(0,24),summary:{pending:tasks.filter(x=>x.status==='pending').length,evidenceFound:tasks.filter(x=>x.status==='evidence_found').length,total:Math.min(tasks.length,24)},policy:{candidateTasksOnly:true,neverInventVerification:true,evidenceFoundIsNotTruth:true,conflictsRemainUnresolved:true,causalityRequiresIndependentEvidence:true,provenanceRequired:true,maxTasks:24}};
}
export function verificationLoopInstruction(report){
  if(!report)return '';
  return '\n\nBUCLE DE VERIFICACIÓN MULTIMODAL ('+MULTIMODAL_VERIFICATION_LOOP_VERSION+'):\n'+JSON.stringify(report)+'\n- Trata cada tarea como una comprobación pendiente o evidencia encontrada, nunca como verdad automática.\n- Usa resultados verificables y conserva su procedencia.\n- evidence_found significa coincidencia de evidencia, no resolución de conflicto ni prueba de causalidad.\n- Nunca inventes una fuente, resultado, fecha, página, segmento o transcripción.\n- Si la evidencia no permite resolver una cuestión, declárala pendiente.\n';
}
export function publicVerificationLoop(report){
  if(!report)return null;
  return {version:report.version||MULTIMODAL_VERIFICATION_LOOP_VERSION,tasks:(report.tasks||[]).slice(0,24),summary:report.summary,policy:report.policy};
}

export async function runMultimodalVerificationPass(report,{search=null,maxTasks=6}={}) {
  if(!report||typeof search!=='function') return report;
  const selected=(report.tasks||[]).filter(x=>x?.status==='pending'&&['conflict','causal_claim','unresolved','verification_needed','temporal_order'].includes(x.type)).slice(0,Math.max(0,Math.min(6,Number(maxTasks)||6)));
  let executed=0,found=0;
  for(const task of selected){
    const query=clean(task.statement,500);
    if(!query) continue;
    executed++;
    try{
      const results=await search(query);
      const sources=(Array.isArray(results)?results:[]).slice(0,4).map(r=>({
        title:clean(r.title,220),
        url:String(r.url||'').slice(0,1200),
        snippet:clean(r.content||r.snippet,600),
        provider:clean(r.provider,100),
        source_id:clean(r.source_id,180),
        published_at:r.published_at||null
      })).filter(x=>/^https?:\\/\\//.test(x.url));
      if(sources.length){
        task.status='evidence_found';
        task.result={status:'evidence_found',verificationPass:true,sources};
        found++;
      }else{
        task.status='checked_no_evidence';
        task.result={status:'checked_no_evidence',verificationPass:true,sources:[]};
      }
    }catch(error){
      task.status='verification_error';
      task.result={status:'verification_error',verificationPass:true,error:clean(error?.message||error,300)};
    }
  }
  const pending=(report.tasks||[]).filter(x=>x.status==='pending').length;
  return {...report,summary:{...(report.summary||{}),pending,evidenceFound:(report.tasks||[]).filter(x=>x.status==='evidence_found').length,checked:executed,verificationPasses:1,evidenceFoundThisPass:found},policy:{...(report.policy||{}),activeVerificationPass:true,maxVerificationTasks:6,noAutomaticTruthResolution:true}};
}
