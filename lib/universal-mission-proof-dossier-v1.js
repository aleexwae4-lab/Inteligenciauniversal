export const UNIVERSAL_MISSION_PROOF_DOSSIER_VERSION='universal-mission-proof-dossier/v1';

const clean=(s='',n=700)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const arr=(v)=>Array.isArray(v)?v:[];

function phaseStatus(missionExecution){
  return arr(missionExecution?.phases).map(p=>({
    phase:clean(p?.phase,60),
    status:clean(p?.status,40),
    proof:clean(p?.proof,120)
  }));
}

function receipts(toolResults=[]){
  return arr(toolResults).map((x,i)=>({
    receiptId:'tool-'+String(i+1).padStart(2,'0'),
    tool:clean(x?.tool,100),
    attempted:true,
    executed:x?.ok===true,
    status:x?.ok===true?'executed':x?.ok===false?'failed':'planned',
    error:x?.ok===false?clean(x?.error,300):null,
    hasData:x?.data!==undefined&&x?.data!==null,
    sourceCount:Array.isArray(x?.data)?x.data.length:0
  }));
}

function evidenceSummary({toolResults=[],sources=[],verification=null,traceability=null}={}){
  const web=arr(toolResults).find(x=>x?.tool==='web_search'&&x?.ok===true);
  return {
    sourceCount:arr(sources).length,
    webSearchExecuted:Boolean(web),
    webResultCount:Array.isArray(web?.data)?web.data.length:0,
    verificationTasks:arr(verification?.tasks).length,
    verificationCompleted:arr(verification?.tasks).filter(x=>x?.status==='verified'||x?.status==='complete').length,
    traceableClaims:Number(traceability?.claimCount||traceability?.claims?.length||0)||0
  };
}

export function buildMissionProofDossier({
  message='',
  missionExecution=null,
  missionRecovery=null,
  executionProof=null,
  toolResults=[],
  sources=[],
  verification=null,
  traceability=null,
  quality=null,
  epistemic=null,
  missionOrchestration=null
}={}){
  const phases=phaseStatus(missionExecution);
  const receiptList=receipts(toolResults);
  const evidence=evidenceSummary({toolResults,sources,verification,traceability});
  const recovered=arr(missionRecovery?.retried);
  const failed=arr(missionRecovery?.failed);
  const executed=receiptList.filter(x=>x.executed).map(x=>x.tool);
  const verified=phases.filter(x=>x.phase==='verify'&&['complete','verified'].includes(x.status)).length>0;
  const hasExecutionProof=Boolean(executionProof?.version);
  const deliverReady=phases.find(x=>x.phase==='deliver')?.status==='ready';
  const completionGate=verified&&deliverReady&&(!missionOrchestration?.mission?.requiresLive||evidence.sourceCount>0||hasExecutionProof);
  return {
    version:UNIVERSAL_MISSION_PROOF_DOSSIER_VERSION,
    dossierId:'proof-'+Date.now().toString(36),
    objective:clean(message,1200),
    lifecycle:{
      planned:phases.some(x=>x.status==='planned'||x.status==='pending'),
      attempted:receiptList.length>0,
      executed:executed.length>0,
      verified,
      delivered:completionGate
    },
    phases,
    receipts:receiptList,
    recovery:{
      attempted:Boolean(missionRecovery?.attempted),
      retried:recovered.map(x=>clean(x.tool||x,100)),
      recovered:Number(missionRecovery?.recovered||0),
      failed:Number(missionRecovery?.failed||failed.length||0)
    },
    evidence:evidence,
    executionProof:{
      present:hasExecutionProof,
      version:executionProof?.version||null,
      externalActionExecuted:Boolean(executionProof?.external_action_executed)
    },
    quality:{
      pass:quality?.pass===true,
      critical:quality?.critical===true,
      score:Number(quality?.score)||0,
      epistemicRisk:clean(epistemic?.unsupportedRisk||'unknown',40)
    },
    completionGate:{
      passed:completionGate,
      requiresVerification:true,
      requiresReceipts:true,
      noSyntheticReceipts:true,
      noUnverifiedExternalClaims:true
    },
    provenance:{
      sourceKeys:arr(sources).map(x=>clean(x?.key,40)).filter(Boolean),
      sourceUrls:arr(sources).map(x=>clean(x?.url,1800)).filter(x=>/^https?:\/\//.test(x)).slice(0,8),
      traceabilityVersion:traceability?.version||null
    }
  };
}

export function missionProofDossierInstruction(dossier){
  if(!dossier)return '';
  return '\n\nDOSSIER DE PRUEBA DE MISIÓN ('+UNIVERSAL_MISSION_PROOF_DOSSIER_VERSION+'):\n'+JSON.stringify(dossier)+'\n- Distingue siempre planificado, intentado, ejecutado, verificado y entregado.\n- Un recibo solo existe si hay un resultado real de herramienta; no inventes recibos.\n- Una acción externa solo puede describirse como ejecutada si existe prueba de ejecución.\n- La verificación debe basarse en evidencia disponible, no en la intención del plan.\n- Conserva errores y recuperaciones en el historial de la misión.\n- Si el completion gate no pasó, entrega el resultado como parcial o pendiente de verificación; no lo presentes como misión completada.\n';
}

export function publicMissionProofDossier(dossier){
  if(!dossier)return null;
  return {...dossier,
    receipts:arr(dossier.receipts).slice(0,16),
    provenance:{...dossier.provenance,sourceUrls:arr(dossier.provenance?.sourceUrls).slice(0,8)}
  };
}
