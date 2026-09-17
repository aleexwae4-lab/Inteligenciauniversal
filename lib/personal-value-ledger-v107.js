import { createHash } from 'node:crypto';
import { valueMeasurementCandidatesV107 } from './adaptive-meta-os-v107.js';
import { classifyDigitalAssetV105 } from './digital-asset-memory-v105.js';

export const PERSONAL_VALUE_LEDGER_V107='personal-value-ledger/v107';

const configured=()=>!!process.env.SUPABASE_URL&&!!process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({
  apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type':'application/json'
});
const safe=(value,max=12000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const hash=value=>createHash('sha256').update(String(value||'')).digest('hex');
const hashKey=value=>hash(String(value||'anonymous'));

export const VALUE_CATEGORIES_V107=[
  'revenue_generated','cost_savings','time_savings','risk_reduction',
  'productivity_gain','knowledge_asset','automation_created','opportunity_created'
];

export function valueCandidatesFromTurnV107({userText='',assistantText=''}={}){
  const user=safe(userText,12000),assistant=safe(assistantText,24000);
  if(!user||!assistant)return[];
  const asset=classifyDigitalAssetV105({userText:user,assistantText:assistant});
  const taskCandidates=valueMeasurementCandidatesV107({message:user,level:/\b(env[ií]a|despliega|ejecuta|actualiza|integra|conecta|publica)\b/i.test(user)?'do':/\b(crea|genera|redacta|diseña|construye|prepara|desarrolla)\b/i.test(user)?'create':'know'});
  const categories=new Set(taskCandidates.map(x=>x.category));
  if(asset.reusable)categories.add('knowledge_asset');
  return [...categories].filter(x=>VALUE_CATEGORIES_V107.includes(x)).map(category=>({
    category,
    status:'candidate',
    amount_mxn:null,
    hours_saved:null,
    confidence:0,
    evidence:{source:'interaction',verified:false},
    metadata:{assetType:asset.assetType,assetReusable:asset.reusable,valuePolicy:'user-confirmed-or-system-verified-only'}
  }));
}

export async function recordValueCandidatesFromTurnV107({userKey,sessionId='',conversationId='',userText='',assistantText='',metadata={}}={}){
  if(!configured()||!userKey)return{recorded:0,configured:configured()};
  const candidates=valueCandidatesFromTurnV107({userText,assistantText});
  if(!candidates.length)return{recorded:0,configured:true};
  const turnHash=hash(`${safe(userText,12000)}\n${safe(assistantText,24000)}`);
  let recorded=0;
  for(const candidate of candidates){
    try{
      const row={
        user_key_hash:hashKey(userKey),
        session_id:safe(sessionId,200)||null,
        conversation_id:safe(conversationId,200)||null,
        interaction_hash:turnHash,
        category:candidate.category,
        status:'candidate',
        amount_mxn:null,
        hours_saved:null,
        confidence:0,
        evidence:candidate.evidence,
        metadata:{...candidate.metadata,...((metadata&&typeof metadata==='object')?metadata:{}),ledgerVersion:PERSONAL_VALUE_LEDGER_V107},
        occurred_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      };
      const res=await fetch(`${process.env.SUPABASE_URL}/rest/v1/wae_personal_value_ledger_v107?on_conflict=user_key_hash,interaction_hash,category`,{
        method:'POST',
        headers:{...headers(),Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(row),
        signal:AbortSignal.timeout(5000)
      });
      if(res.ok)recorded++;
    }catch{}
  }
  return{recorded,configured:true};
}

export async function recordConfirmedValueV107({userKey,category,amountMxn=null,hoursSaved=null,evidence={},metadata={}}={}){
  if(!configured()||!userKey||!VALUE_CATEGORIES_V107.includes(category))return{ok:false,reason:'not_configured_or_invalid'};
  const amount=amountMxn===null?null:Number(amountMxn);
  const hours=hoursSaved===null?null:Number(hoursSaved);
  if(amount!==null&&(!Number.isFinite(amount)||amount<0))return{ok:false,reason:'invalid_amount'};
  if(hours!==null&&(!Number.isFinite(hours)||hours<0))return{ok:false,reason:'invalid_hours'};
  if(amount===null&&hours===null)return{ok:false,reason:'verified_measurement_required'};
  const interactionHash=hash(`confirmed|${userKey}|${category}|${Date.now()}|${Math.random()}`);
  const row={
    user_key_hash:hashKey(userKey),interaction_hash:interactionHash,category,status:'verified',
    amount_mxn:amount,hours_saved:hours,confidence:1,
    evidence:{...(evidence&&typeof evidence==='object'?evidence:{}),verified:true,verificationSource:'explicit_user_or_system_evidence'},
    metadata:{...(metadata&&typeof metadata==='object'?metadata:{}),ledgerVersion:PERSONAL_VALUE_LEDGER_V107},
    occurred_at:new Date().toISOString(),updated_at:new Date().toISOString()
  };
  try{
    const res=await fetch(`${process.env.SUPABASE_URL}/rest/v1/wae_personal_value_ledger_v107`,{
      method:'POST',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row),signal:AbortSignal.timeout(5000)
    });
    if(!res.ok)return{ok:false,reason:`db_${res.status}`};
    const rows=await res.json().catch(()=>[]);
    return{ok:true,entry:Array.isArray(rows)?rows[0]||null:null};
  }catch{return{ok:false,reason:'db_error'}}
}

export async function personalValueSnapshotV107(userKey,{limit=500}={}){
  const empty={
    version:PERSONAL_VALUE_LEDGER_V107,configured:configured(),candidateSignals:0,verifiedEntries:0,realizedEntries:0,
    verifiedAmountMxn:0,realizedAmountMxn:0,verifiedHoursSaved:0,realizedHoursSaved:0,byCategory:{},integrity:'verified-and-realized-only'
  };
  if(!configured()||!userKey)return empty;
  try{
    const capped=Math.max(20,Math.min(1000,Number(limit)||500));
    const url=`${process.env.SUPABASE_URL}/rest/v1/wae_personal_value_ledger_v107?user_key_hash=eq.${encodeURIComponent(hashKey(userKey))}&select=category,status,amount_mxn,hours_saved,confidence,occurred_at&order=occurred_at.desc&limit=${capped}`;
    const res=await fetch(url,{headers:headers(),signal:AbortSignal.timeout(6000)});
    if(!res.ok)return{...empty,error:`db_${res.status}`};
    const rows=await res.json();
    for(const row of Array.isArray(rows)?rows:[]){
      const category=VALUE_CATEGORIES_V107.includes(row.category)?row.category:'other';
      empty.byCategory[category]=(empty.byCategory[category]||0)+1;
      if(row.status==='candidate')empty.candidateSignals++;
      if(row.status==='verified'){
        empty.verifiedEntries++;
        empty.verifiedAmountMxn+=Number(row.amount_mxn)||0;
        empty.verifiedHoursSaved+=Number(row.hours_saved)||0;
      }
      if(row.status==='realized'){
        empty.realizedEntries++;
        empty.realizedAmountMxn+=Number(row.amount_mxn)||0;
        empty.realizedHoursSaved+=Number(row.hours_saved)||0;
      }
    }
    return empty;
  }catch{return{...empty,error:'db_error'}}
}

export async function personalAssetPortfolioV107(userKey,{limit=500}={}){
  const empty={version:PERSONAL_VALUE_LEDGER_V107,configured:configured(),totalAssets:0,reusableAssets:0,verifiedOutcomes:0,byType:{}};
  if(!configured()||!userKey)return empty;
  try{
    const capped=Math.max(20,Math.min(1000,Number(limit)||500));
    const url=`${process.env.SUPABASE_URL}/rest/v1/wae_digital_asset_index_v105?user_key_hash=eq.${encodeURIComponent(hashKey(userKey))}&select=asset_type,reusable,outcome_status,created_at&order=created_at.desc&limit=${capped}`;
    const res=await fetch(url,{headers:headers(),signal:AbortSignal.timeout(6000)});
    if(!res.ok)return{...empty,error:`db_${res.status}`};
    const rows=await res.json();
    for(const row of Array.isArray(rows)?rows:[]){
      empty.totalAssets++;
      if(row.reusable===true)empty.reusableAssets++;
      if(['verified','realized'].includes(row.outcome_status))empty.verifiedOutcomes++;
      const type=safe(row.asset_type,80)||'unknown';
      empty.byType[type]=(empty.byType[type]||0)+1;
    }
    return empty;
  }catch{return{...empty,error:'db_error'}}
}

export function personalValueLedgerCapabilitiesV107(){
  return{
    version:PERSONAL_VALUE_LEDGER_V107,
    interactionValueCandidates:true,
    verifiedValueLedger:true,
    personalRoiSnapshot:true,
    assetPortfolioSnapshot:true,
    hashedUserIsolation:true,
    candidateValuesHaveNoMoney:true,
    verifiedTotalsOnly:true,
    inventedMonetaryValue:false,
    categories:VALUE_CATEGORIES_V107
  };
}
