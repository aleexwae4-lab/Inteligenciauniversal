import { applyHeaders, allowRequest, originAllowed, getClientIp } from '../lib/security.js';
import { recallUserProfileV104 } from '../lib/memory.js';
import { buildAdaptiveMetaOSStateV107, adaptiveMetaOSCapabilitiesV107 } from '../lib/adaptive-meta-os-v107.js';
import {
  personalAssetPortfolioV107,
  personalValueSnapshotV107,
  personalValueLedgerCapabilitiesV107,
  recordConfirmedValueV107,
} from '../lib/personal-value-ledger-v107.js';

export const META_OS_API_V107='meta-os-api/v107';

const safe=(value,max=12000)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);

function publicProfile(profile){
  if(!profile)return null;
  return{
    professional_roles:Array.isArray(profile.professional_roles)?profile.professional_roles:[],
    goals:Array.isArray(profile.goals)?profile.goals:[],
    preferences:Array.isArray(profile.preferences)?profile.preferences:[],
    responsibilities:Array.isArray(profile.responsibilities)?profile.responsibilities:[],
    constraints:Array.isArray(profile.constraints)?profile.constraints:[],
    updated_at:profile.updated_at||null,
    source_policy:'explicit-user-statements-only'
  };
}

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req))return res.status(429).json({error:'rate_limited'});

  const body=req.body&&typeof req.body==='object'?req.body:{};
  const userKey=safe(body.userKey||body.sessionId||getClientIp(req),160);
  if(!userKey)return res.status(400).json({error:'user_context_required'});

  if(body.action==='confirm_value'){
    const confirmation=await recordConfirmedValueV107({
      userKey,
      category:safe(body.category,80),
      amountMxn:body.amount_mxn??null,
      hoursSaved:body.hours_saved??null,
      evidence:body.evidence&&typeof body.evidence==='object'?body.evidence:{source:'workspace_confirmation'},
      metadata:{source:'meta-os-api',conversationId:safe(body.conversationId||body.conversation_id,200)||undefined}
    });
    if(!confirmation.ok)return res.status(400).json({success:false,error:confirmation.reason||'value_confirmation_failed'});
  }

  const message=safe(body.message||body.task||'',30000);
  const [profile,value,assets]=await Promise.all([
    recallUserProfileV104(userKey),
    personalValueSnapshotV107(userKey),
    personalAssetPortfolioV107(userKey)
  ]);
  const operatingState=buildAdaptiveMetaOSStateV107({message,profile:profile||{}});

  res.setHeader('X-WAE-Meta-OS',META_OS_API_V107);
  return res.status(200).json({
    success:true,
    version:META_OS_API_V107,
    meta_os:operatingState,
    user_profile:publicProfile(profile),
    asset_portfolio:assets,
    value_ledger:value,
    capabilities:{
      meta_os:adaptiveMetaOSCapabilitiesV107(),
      value:personalValueLedgerCapabilitiesV107()
    },
    value_integrity:{
      candidatesAreNotRealizedValue:true,
      monetaryTotalsRequireVerifiedEvidence:true,
      inventedValueForbidden:true
    }
  });
}
