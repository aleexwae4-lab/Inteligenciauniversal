import { timingSafeEqual } from 'node:crypto';
import { applyHeaders } from '../lib/security.js';
import { callInternalSupabaseRpc } from '../lib/internal-supabase-rpc-v74.js';
import {
  benchmarkAttestationState,
  certifyVerifiedGptRun,
  gptComparatorReadiness,
} from '../lib/verified-gpt-arena-v93.js';
import {
  PREMIUM_DEFAULT_REFERENCE,
  PREMIUM_REQUIRED_CASES,
  premiumSuperiorityCapabilitiesV98,
  premiumSuperiorityGateV98,
} from '../lib/premium-superiority-gate-v98.js';

const MAX_ANSWER=80_000;
const clean=(value,max=200)=>String(value??'').trim().slice(0,max);
const bodyOf=req=>req?.body&&typeof req.body==='object'?req.body:{};

function requestToken(req){
  const raw=req?.headers?.['x-wae-worker-token']??req?.headers?.get?.('x-wae-worker-token')??'';
  return clean(Array.isArray(raw)?raw[0]:raw,500);
}

function secureEqual(a='',b=''){
  const left=Buffer.from(String(a));
  const right=Buffer.from(String(b));
  return left.length===right.length&&left.length>0&&timingSafeEqual(left,right);
}

function workerAuthorized(req){
  const expected=String(process.env.WAE_RUNTIME_BRIDGE_TOKEN||'');
  if(expected.length<24)return{ok:false,status:503,error:'trusted_worker_token_unconfigured'};
  const received=requestToken(req);
  if(!received||!secureEqual(received,expected))return{ok:false,status:403,error:'trusted_worker_auth_required'};
  return{ok:true};
}

function normalizeEntries(value){
  return(Array.isArray(value)?value:[]).slice(0,PREMIUM_REQUIRED_CASES).map(entry=>({
    caseId:clean(entry?.caseId,120),
    promptHash:clean(entry?.promptHash,128),
    candidates:(Array.isArray(entry?.candidates)?entry.candidates:[]).slice(0,4).map(candidate=>({
      id:clean(candidate?.id,160),
      answer:clean(candidate?.answer??candidate?.text??'',MAX_ANSWER),
      sources:Array.isArray(candidate?.sources)?candidate.sources.slice(0,20):[],
      latencyMs:candidate?.latencyMs??null,
      costUsd:candidate?.costUsd??null,
      attestation:candidate?.attestation&&typeof candidate.attestation==='object'?candidate.attestation:null,
    })),
    attestations:entry?.attestations&&typeof entry.attestations==='object'?entry.attestations:undefined,
  }));
}

async function regressionStatus(){
  const result=await callInternalSupabaseRpc({
    functionName:'wae_premium_regression_status_v98',
    body:{},
    timeoutMs:3000,
    clientInfo:'wae-premium-superiority-v98',
  });
  if(!result.ok)return{
    available:false,
    version:'premium-superiority-gate/v98',
    trusted_runs:0,
    critical_open:null,
    high_open:null,
    release_gate:'HOLD',
    reason:result.unconfigured?'supabase_internal_transport_unconfigured':result.error||'premium_regression_status_unavailable',
  };
  const payload=Array.isArray(result.payload)?(result.payload[0]||{}):(result.payload&&typeof result.payload==='object'?result.payload:{});
  return{available:true,...payload};
}

function compactQualityCertification(certification={}){
  const base=certification?.baseCertification&&typeof certification.baseCertification==='object'?certification.baseCertification:{};
  return{
    version:clean(certification?.version,80),
    evaluatedCases:Number(certification?.evaluatedCases)||0,
    referenceId:clean(certification?.referenceId,160).toLowerCase()||null,
    claimAllowed:certification?.claimAllowed===true,
    verdict:clean(certification?.verdict||'NOT_PROVEN',120),
    gates:certification?.gates&&typeof certification.gates==='object'?certification.gates:{},
    quality:{
      aggregate:base?.aggregate&&typeof base.aggregate==='object'?base.aggregate:{},
      metrics:base?.metrics&&typeof base.metrics==='object'?base.metrics:{},
      gates:base?.gates&&typeof base.gates==='object'?base.gates:{},
      claimAllowed:base?.claimAllowed===true,
      verdict:clean(base?.verdict||'NOT_PROVEN',120),
    },
    privacy:{rawPromptsReturned:false,rawAnswersReturned:false,chainOfThoughtReturned:false},
  };
}

async function statusPayload(){
  const comparator=gptComparatorReadiness();
  const attestation=benchmarkAttestationState();
  const regressions=await regressionStatus();
  const expectedReference=clean(process.env.WAE_PREMIUM_REFERENCE_ID||PREMIUM_DEFAULT_REFERENCE,160).toLowerCase();
  const referenceReady=comparator.executable===true&&String(comparator.referenceId||'').toLowerCase()===expectedReference;
  return{
    success:true,
    version:'premium-superiority-gate/v98',
    capabilities:premiumSuperiorityCapabilitiesV98(),
    comparator,
    attestation,
    regressionStatus:regressions,
    readiness:{
      ready:Boolean(referenceReady&&attestation.configured&&regressions.available&&Number(regressions.trusted_runs||0)>0),
      exactReferenceReady:referenceReady,
      expectedReferenceId:expectedReference,
      signedAttestationReady:attestation.configured===true,
      trustedRegressionStateReady:regressions.available===true&&Number(regressions.trusted_runs||0)>0,
    },
    claimAuthorization:{allowed:false,scope:'A complete signed 64-case certification must be executed before any premium benchmark claim.'},
  };
}

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json(await statusPayload());
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});

  const body=bodyOf(req);
  const action=clean(body.action||'status',40).toLowerCase();
  if(action==='status')return res.status(200).json(await statusPayload());
  if(action==='capabilities')return res.status(200).json({success:true,capabilities:premiumSuperiorityCapabilitiesV98()});
  if(action!=='certify')return res.status(400).json({success:false,error:'unsupported_action'});

  const auth=workerAuthorized(req);
  if(!auth.ok)return res.status(auth.status).json({success:false,error:auth.error});

  const entries=normalizeEntries(body.entries);
  if(entries.length!==PREMIUM_REQUIRED_CASES)return res.status(422).json({success:false,error:'complete_64_case_suite_required',received:entries.length});
  const targetId=clean(body.targetId||'universal_core',160);
  const referenceId=clean(body.referenceId||'',160).toLowerCase();
  const certification=certifyVerifiedGptRun({entries,targetId,referenceId});
  const regressions=await regressionStatus();
  const premium=premiumSuperiorityGateV98({
    certification,
    entries,
    targetId,
    referenceId,
    regressionStatus:regressions.available?regressions:null,
  });

  return res.status(200).json({
    success:true,
    version:premium.version,
    qualityCertification:compactQualityCertification(certification),
    regressionStatus:regressions,
    premiumCertification:premium,
    claimAuthorization:premium.claimAuthorization,
  });
}
