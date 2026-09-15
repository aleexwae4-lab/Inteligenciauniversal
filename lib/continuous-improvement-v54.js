export const CONTINUOUS_IMPROVEMENT_VERSION='continuous-improvement/v54';

let cache=null;
let expires=0;

function configured(){return !!process.env.SUPABASE_URL&&!!process.env.SUPABASE_PUBLISHABLE_KEY}
function endpoint(){return `${String(process.env.SUPABASE_URL||'').replace(/\/$/,'')}/rest/v1/wae_supremacy_public_status_v54?context_key=eq.global&select=benchmark_version,trusted_runs,last_reference_id,last_adjusted_win_rate,last_claim_allowed,open_regressions,critical_open,high_open,release_gate,superiority_claim_gate,last_commit_sha,updated_at`}
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function normalizeImprovementStatus(row={}){
  const releaseGate=['PASS','CAUTION','BLOCK','HOLD'].includes(String(row?.release_gate))?String(row.release_gate):'HOLD';
  const superiorityGate=String(row?.superiority_claim_gate)==='CERTIFIED'?'CERTIFIED':'HOLD';
  return{
    version:CONTINUOUS_IMPROVEMENT_VERSION,
    benchmarkVersion:String(row?.benchmark_version||'universal-supremacy-benchmark/v53'),
    trustedRuns:Math.max(0,finite(row?.trusted_runs)),
    lastReferenceId:row?.last_reference_id?String(row.last_reference_id):null,
    lastAdjustedWinRate:row?.last_adjusted_win_rate==null?null:finite(row.last_adjusted_win_rate),
    lastClaimAllowed:row?.last_claim_allowed===true,
    openRegressions:Math.max(0,finite(row?.open_regressions)),
    criticalOpen:Math.max(0,finite(row?.critical_open)),
    highOpen:Math.max(0,finite(row?.high_open)),
    releaseGate,
    superiorityClaimGate:superiorityGate,
    lastCommitSha:row?.last_commit_sha?String(row.last_commit_sha):null,
    updatedAt:row?.updated_at?String(row.updated_at):null,
    trustedEvidenceOnly:true,
    userSubmittedRunsCanPromote:false
  };
}

export async function getContinuousImprovementStatus({fresh=false}={}){
  if(!fresh&&cache&&Date.now()<expires)return cache;
  if(!configured())return normalizeImprovementStatus();
  try{
    const response=await fetch(endpoint(),{
      headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Accept':'application/json','X-Client-Info':'wae-continuous-improvement-v54'},
      signal:AbortSignal.timeout(1600)
    });
    if(!response.ok)return normalizeImprovementStatus();
    const rows=await response.json();
    const status=normalizeImprovementStatus(Array.isArray(rows)?rows[0]||{}:{});
    cache=status;expires=Date.now()+30_000;
    return status;
  }catch{return normalizeImprovementStatus()}
}

export function continuousImprovementCapabilities(status=normalizeImprovementStatus()){
  return{
    version:CONTINUOUS_IMPROVEMENT_VERSION,
    enabled:true,
    persistence:'supabase-private-ledger',
    regressionBacklog:true,
    deduplication:'sha256-scope-benchmark-case-failure-tags',
    automaticRecoveryResolution:true,
    promotionGate:true,
    trustedWorkerAttestation:true,
    userSubmittedRunsCanPromote:false,
    candidateAnswersPersisted:false,
    publicStatusSanitized:true,
    benchmarkVersion:status.benchmarkVersion,
    trustedRuns:status.trustedRuns,
    releaseGate:status.releaseGate,
    superiorityClaimGate:status.superiorityClaimGate,
    openRegressions:status.openRegressions,
    criticalOpen:status.criticalOpen,
    highOpen:status.highOpen,
    lastReferenceId:status.lastReferenceId,
    lastAdjustedWinRate:status.lastAdjustedWinRate,
    claimPolicy:{
      benchmarkAdvantageRequiresTrustedRun:true,
      superiorityClaimRequiresGate:'CERTIFIED',
      universalSuperiorityClaimAllowed:false
    }
  };
}
