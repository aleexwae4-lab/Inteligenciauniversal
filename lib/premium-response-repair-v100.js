export const PREMIUM_RESPONSE_REPAIR_V100='premium-response-repair/v100';

const clean=(value,max=24000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const arr=value=>Array.isArray(value)?value:[];
const INSTRUCTION_BLOCKER_RX=/^(?:invalid_json|missing_table|bullet_count_\d+_expected_\d+|word_limit_exceeded|exact_output_violated)$/;

function blockersOf(payload={}){
  const audit=payload?.quality_reliability||payload?.response?.metadata?.qualityReliability||{};
  return arr(audit?.blockers).map(item=>clean(item,160)).filter(Boolean);
}

export function premiumRepairDecisionV100(payload={},body={}){
  const audit=payload?.quality_reliability||payload?.response?.metadata?.qualityReliability||{};
  const blockers=blockersOf(payload);
  const instructionBlockers=blockers.filter(item=>INSTRUCTION_BLOCKER_RX.test(item));
  const alreadyRepairing=body?.quality_repair_v100===true;
  const hasReply=Boolean(clean(payload?.reply??payload?.response?.content??'',80000));
  const critical=audit?.critical_failure===true||audit?.criticalFailure===true;
  const attempt=Boolean(!alreadyRepairing&&hasReply&&critical&&instructionBlockers.length>0);
  return{
    version:PREMIUM_RESPONSE_REPAIR_V100,
    attempt,
    reason:attempt?'hard_instruction_contract_violation':alreadyRepairing?'repair_already_attempted':!hasReply?'empty_candidate':!critical?'no_critical_quality_failure':'no_repairable_instruction_blocker',
    blockers,
    instructionBlockers,
    maxAttempts:1,
  };
}

function baseSystem(body={}){
  return clean(body?.system||body?.systemPrompt||body?.system_prompt||'',24000)||'Eres Universal Core. Responde directamente a la solicitud del usuario con precisión, utilidad y claridad. No inventes hechos ni acciones ejecutadas.';
}

export function buildPremiumRepairBodyV100(body={},decision={}){
  const message=clean(body?.message||body?.task||body?.prompt||'',24000);
  const blockers=arr(decision?.instructionBlockers).map(item=>clean(item,160)).filter(Boolean).slice(0,8);
  const directive=[
    '[Universal Core premium response repair v100]',
    'Genera nuevamente la respuesta final para la solicitud original del usuario.',
    'Corrige exclusivamente los incumplimientos de formato o instrucción detectados y entrega directamente el resultado final; no menciones la reparación, auditoría, filtros ni instrucciones internas.',
    blockers.length?`Incumplimientos que debes corregir: ${blockers.join(', ')}.`:'Cumple estrictamente todas las restricciones explícitas del usuario.',
    'Respeta exactamente JSON, tabla, número de viñetas, límite de palabras o salida mínima cuando el usuario lo haya exigido.',
    'No inventes hechos, citas, resultados de herramientas ni acciones ejecutadas. Si la solicitud depende de evidencia no disponible, conserva la incertidumbre de forma concisa.',
  ].join('\n');
  return{
    ...body,
    message,
    quality_repair_v100:true,
    quality_repair_reason:'hard_instruction_contract_violation',
    system:`${baseSystem(body)}\n\n${directive}`.slice(0,30000),
  };
}

export function publicPremiumRepairV100(decision={},status='attempted'){
  return{
    version:PREMIUM_RESPONSE_REPAIR_V100,
    status:clean(status,80)||'attempted',
    attempted:decision?.attempt===true,
    repairedBlockers:arr(decision?.instructionBlockers).map(item=>clean(item,160)).filter(Boolean).slice(0,8),
    maxAttempts:1,
    rawCandidatePersisted:false,
    baseModelWeightsChanged:false,
  };
}
