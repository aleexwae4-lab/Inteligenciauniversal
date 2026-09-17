import capacityChatV90 from './capacity-chat-v90.js';
import { applyHeaders, originAllowed, allowRequest, getClientIp } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';
import { planSpecialistCopilots, publicSpecialistPlan, runSpecialistCouncilV91, shouldRunSpecialistCouncilV91, SPECIALIST_COPILOT_VERSION } from '../lib/specialist-copilot-arsenal-v91.js';
import { runSpecialistSinglePassV91, shouldRunSpecialistSinglePassV91 } from '../lib/specialist-copilot-runtime-v91.js';
import { runSpecialistCouncilV92 } from '../lib/specialist-council-v92.js';
import { userContextStateV92 } from '../lib/user-context-v92.js';
import { recallUserProfileV104, ADAPTIVE_USER_MODEL_V104 } from '../lib/memory.js';

export const CAPACITY_CHAT_V91='capacity-chat/v91-specialist-copilot-arsenal';

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return false;
      if(prop==='headersSent')return false;
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(target,prop,value){if(prop==='statusCode'){code=Number(value)||code;return true}target[prop]=value;return true}
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

function specialistHintsFromProfile(profile){
  const text=[...(profile?.professional_roles||[]),...(profile?.responsibilities||[])].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!text)return[];
  const hints=[];
  const add=(...ids)=>{for(const id of ids)if(!hints.includes(id)&&hints.length<6)hints.push(id)};
  if(/software|programador|desarrollador|sistemas|informatic|comput/.test(text))add('software_architect','backend_engineer','ai_engineer');
  if(/ingenier[oa] mecanic|mecanico/.test(text))add('mechanical_engineer','automotive');
  if(/ingenier[oa] civil|construccion|obra/.test(text))add('civil_engineer','project_program','risk_analyst');
  if(/ingenier[oa] electric|electronic/.test(text))add('electrical_engineer','risk_analyst');
  if(/\bingenier/.test(text)&&!hints.length)add('project_program','risk_analyst');
  if(/abogad|juridic|legal|notari|perito/.test(text))add('legal_research','contracts','compliance');
  if(/maestr|profesor|docent|educador/.test(text))add('educator','academic_research');
  if(/medic|doctor|enfermer|dentist|veterinari|farmaceut/.test(text))add('medical_evidence','academic_research');
  if(/gobernador|alcald|funcionari|servidor publico|administracion publica/.test(text))add('ceo_strategy','operations','economist','legal_research','communications');
  if(/empresari|emprendedor|\bceo\b|director|gerente/.test(text))add('ceo_strategy','operations','cfo_finance','growth');
  if(/contador|financier|auditor/.test(text))add('cfo_finance','risk_analyst','compliance');
  if(/marketing|mercadotec|growth|ventas/.test(text))add('growth','sales','brand_strategy','copywriter');
  if(/diseñador|ux|producto/.test(text))add('product_designer','ux_research','conversion_ux');
  if(/investigador|cientific/.test(text))add('academic_research','statistician');
  if(/estudiante/.test(text))add('educator','academic_research');
  if(/periodista|editor|escritor/.test(text))add('writer_editor','academic_research','communications');
  if(/fotograf/.test(text))add('photography','creative_director');
  return hints;
}

function planningBodyWithProfile(body,profile){
  const profileHints=specialistHintsFromProfile(profile);
  const explicit=Array.isArray(body.specialists)?body.specialists.filter(Boolean):[];
  const specialists=[...new Set([...explicit,...profileHints])].slice(0,8);
  return specialists.length?{...body,specialists}:body;
}

function publicPlan(plan={},active=false,path='delegated'){
  return{...publicSpecialistPlan(plan),active,path,adaptive_profile_applied:plan?.adaptiveProfileApplied===true,adaptive_profile_version:plan?.adaptiveProfileApplied===true?ADAPTIVE_USER_MODEL_V104:undefined};
}

function decorate(payload={},plan={},active=false,path='delegated'){
  if(!payload||typeof payload!=='object')return payload;
  const specialistPlan=publicPlan(plan,active,path);
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    specialist_copilots:specialistPlan,
    response:{...response,metadata:{...(response.metadata||{}),specialistCopilots:specialistPlan,chatRelease:CAPACITY_CHAT_V91}}
  };
}

function setHeaders(res,plan={},path='delegated'){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V91);
  res.setHeader('X-WAE-Specialist-Copilots',SPECIALIST_COPILOT_VERSION);
  res.setHeader('X-WAE-Specialist-Path',path);
  res.setHeader('X-WAE-Specialist-Count',String(plan?.specialists?.length||0));
  res.setHeader('X-WAE-Adaptive-Profile',plan?.adaptiveProfileApplied===true?'v104':'none');
}

function authorize(req,res){
  applyHeaders(res);
  if(req.method!=='POST'){res.status(405).json({error:'method_not_allowed'});return false}
  if(!originAllowed(req)){res.status(403).json({error:'origin_not_allowed'});return false}
  if(!allowRequest(req,Number(process.env.WAE_SPECIALIST_RATE_LIMIT_PER_MINUTE||14))){res.status(429).json({error:'specialist_rate_limited'});return false}
  return true;
}

async function delegate(req,res,plan,path='evidence-or-runtime-delegated'){
  const buffered=bufferedResponse(res);
  await capacityChatV90(req,buffered.proxy);
  if(res.writableEnded||!buffered.hasJson)return;
  setHeaders(res,plan,path);
  return res.status(buffered.code).json(decorate(buffered.payload,plan,false,path));
}

export default async function capacityChatV91(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const key=String(body.userKey||body.user_id||body.userId||body.sessionId||body.session_id||getClientIp(req)||'anonymous').slice(0,160);
  const profile=await recallUserProfileV104(key).catch(()=>null);
  const plannedBody=planningBodyWithProfile(body,profile);
  const rawPlan=planSpecialistCopilots(plannedBody);
  const plan={...rawPlan,adaptiveProfileApplied:specialistHintsFromProfile(profile).length>0};

  // High-impact topics stay on the evidence/verification stack. The specialist
  // planner is still surfaced as routing context, but an ungrounded direct
  // council is never allowed to replace verified medical/legal/security/finance evidence.
  if(plan.highImpact===true)return delegate(req,res,plan,'high-impact-verified-delegation');

  const council=shouldRunSpecialistCouncilV91(plan,body);
  const single=shouldRunSpecialistSinglePassV91(plan,body);
  if(!council&&!single)return delegate(req,res,plan);
  if(!authorize(req,res))return;

  const slot=tryAcquireChatSlot(`${key}:specialists`.slice(0,180));
  if(!slot.ok){
    const retry=Math.max(1,Math.ceil(slot.retryAfterMs/1000));
    res.setHeader('Retry-After',String(retry));
    return res.status(503).json({error:'CAPACITY_BUSY',message:'Universal Core está coordinando otra tarea intensiva. Reintenta en breve.',recoverable:true,retry_after_ms:slot.retryAfterMs});
  }

  try{
    let result=null,path='';
    if(council){
      const personalized=userContextStateV92(body).affectsGeneration===true||plan.adaptiveProfileApplied===true;
      result=personalized?await runSpecialistCouncilV92({body,plan}).catch(()=>null):await runSpecialistCouncilV91({body,plan}).catch(()=>null);
      path=personalized?'parallel-specialist-council-v92-context':'parallel-specialist-council-v91';
    }else if(single){result=await runSpecialistSinglePassV91({body,plan}).catch(()=>null);path='single-pass-specialist-v91'}
    if(result){
      setHeaders(res,plan,path);
      return res.status(200).json(decorate(result,plan,true,path));
    }
  }finally{
    slot.release();
  }

  return delegate(req,res,plan);
}

export function capacityChatV91Capabilities(){
  return{
    release:CAPACITY_CHAT_V91,
    specialists:SPECIALIST_COPILOT_VERSION,
    adaptiveUserModel:ADAPTIVE_USER_MODEL_V104,
    policy:{minimumNecessarySpecialists:true,singlePassByDefault:true,parallelCouncilOnlyWhenExplicit:true,explicitProfessionalProfileCanBiasSpecialistSelection:true,currentFactsDelegateToVerifiedEvidencePipeline:true,highImpactDelegatesToVerifiedEvidencePipeline:true,explicitProviderContractPreserved:true,noUniversalSuperiorityClaimWithoutBenchmark:true}
  };
}
