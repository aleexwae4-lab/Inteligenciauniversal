import { createHash } from 'node:crypto';

export const ENTERPRISE_INTELLIGENCE_FABRIC_VERSION='enterprise-intelligence-fabric/v90';
export const ENTERPRISE_PROVENANCE_SCHEMA='enterprise-provenance/v1';

const sha256=(value)=>createHash('sha256').update(String(value??'')).digest('hex');
const norm=(value)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.\s-]/g,' ').replace(/\s+/g,' ').trim();
const configured=(keys=[])=>keys.length>0&&keys.every((key)=>Boolean(process.env[key]));

export const ENTERPRISE_TARGETS=Object.freeze({
  tesla:{
    id:'tesla',name:'Tesla',aliases:['tesla'],
    officialDomains:['tesla.com','developer.tesla.com','ir.tesla.com'],
    officialDocs:['https://developer.tesla.com/','https://developer.tesla.com/docs/fleet-api'],
    integration:{kind:'authorized_api',name:'Tesla Fleet API',credentialKeys:['TESLA_FLEET_CLIENT_ID','TESLA_FLEET_CLIENT_SECRET'],writePolicy:'explicit_authorization_and_human_approval'},
  },
  spacex:{
    id:'spacex',name:'SpaceX',aliases:['spacex','space x'],
    officialDomains:['spacex.com'],
    officialDocs:['https://www.spacex.com/'],
    integration:{kind:'public_research',name:'Official public web evidence',credentialKeys:[],writePolicy:'not_available'},
  },
  openai:{
    id:'openai',name:'OpenAI',aliases:['openai','open ai','chatgpt','gpt'],
    officialDomains:['openai.com','developers.openai.com','platform.openai.com'],
    officialDocs:['https://developers.openai.com/','https://developers.openai.com/api/'],
    integration:{kind:'authorized_api',name:'OpenAI API',credentialKeys:['OPENAI_API_KEY'],writePolicy:'tool_contract_and_approval'},
  },
  google:{
    id:'google',name:'Google / Gemini',aliases:['google','gemini','google ai'],
    officialDomains:['google.com','ai.google.dev','developers.google.com','cloud.google.com'],
    officialDocs:['https://ai.google.dev/gemini-api/docs','https://ai.google.dev/gemini-api/docs/tools'],
    integration:{kind:'authorized_api',name:'Gemini API',credentialKeys:['GEMINI_API_KEY'],writePolicy:'tool_contract_and_approval'},
  },
  microsoft:{
    id:'microsoft',name:'Microsoft / Copilot',aliases:['microsoft','copilot','microsoft 365'],
    officialDomains:['microsoft.com','learn.microsoft.com','graph.microsoft.com'],
    officialDocs:['https://learn.microsoft.com/en-us/connectors/','https://learn.microsoft.com/en-us/graph/connecting-external-content-connectors-api-overview'],
    integration:{kind:'authorized_api',name:'Microsoft Graph / Copilot connectors',credentialKeys:['MICROSOFT_GRAPH_TENANT_ID','MICROSOFT_GRAPH_CLIENT_ID','MICROSOFT_GRAPH_CLIENT_SECRET'],writePolicy:'least_privilege_and_human_approval'},
  },
  nvidia:{
    id:'nvidia',name:'NVIDIA',aliases:['nvidia'],
    officialDomains:['nvidia.com','docs.nvidia.com','build.nvidia.com'],
    officialDocs:['https://docs.nvidia.com/nim/','https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html'],
    integration:{kind:'authorized_api',name:'NVIDIA NIM',credentialKeys:['NVIDIA_API_KEY','NVIDIA_NIM_BASE_URL'],writePolicy:'inference_only_by_default'},
  },
});

const OPERATION_RULES=Object.freeze([
  ['reconstruct_public_system',/\b(reconstru|rebuild|replica|recrear|arquitectura|como funciona)\b/i],
  ['integrate',/\b(integra|integracion|conecta|api|connector|mcp)\b/i],
  ['automate',/\b(automatiza|automatizacion|workflow|flujo|agente|trigger)\b/i],
  ['optimize',/\b(perfecciona|optimiza|mejora|escala|reduce costo|rendimiento|latencia)\b/i],
  ['collaborate',/\b(colabora|trabaja con|coordina|multiagente|equipo)\b/i],
  ['compare',/\b(compara|benchmark|frente a|versus|vs)\b/i],
  ['research',/.+/s],
]);

const PRIVATE_ACCESS_RX=/\b(secreto|secrets?|credencial(?:es)? privada|private key|acceso interno no autorizado|hackea|hack|bypass|elude autenticacion|roba|filtra|exfiltra)\b/i;

export function detectEnterpriseTargets(message=''){
  const value=` ${norm(message)} `;
  return Object.values(ENTERPRISE_TARGETS).filter((target)=>target.aliases.some((alias)=>value.includes(` ${norm(alias)} `))).map((target)=>target.id);
}

export function detectEnterpriseOperations(message=''){
  const value=norm(message);
  const matches=OPERATION_RULES.filter(([,rx])=>rx.test(value)).map(([id])=>id);
  return [...new Set(matches)].slice(0,6);
}

export function enterpriseTargetState(id){
  const target=ENTERPRISE_TARGETS[String(id||'').toLowerCase()];
  if(!target)return null;
  const integrationConfigured=target.integration.kind==='public_research'||configured(target.integration.credentialKeys);
  return{
    id:target.id,name:target.name,
    officialDomains:[...target.officialDomains],officialDocs:[...target.officialDocs],
    access:{publicResearch:true,authorizedIntegration:integrationConfigured&&target.integration.kind==='authorized_api',privateInternal:false},
    integration:{kind:target.integration.kind,name:target.integration.name,configured:integrationConfigured,writePolicy:target.integration.writePolicy,secretKeysExposed:false},
  };
}

export function enterpriseFabricSnapshot(){
  const targets=Object.keys(ENTERPRISE_TARGETS).map(enterpriseTargetState);
  return{
    version:ENTERPRISE_INTELLIGENCE_FABRIC_VERSION,
    provenanceSchema:ENTERPRISE_PROVENANCE_SCHEMA,
    policy:{publicEvidenceFirst:true,officialSourcesPreferred:true,authorizedApisOnly:true,privateInternalAccess:false,defaultDenyWrites:true,humanApprovalForExternalWrites:true,secretsNeverReturned:true,verifyBeforeAccept:true},
    capabilities:['research','reconstruct_public_system','analyze','compare','integrate','collaborate','automate','optimize','benchmark','cite_provenance'],
    targets,
    configuredAuthorizedIntegrations:targets.filter((target)=>target.access.authorizedIntegration).map((target)=>target.id),
  };
}

export function planEnterpriseIntelligence(message='',options={}){
  const targets=detectEnterpriseTargets(message);
  const operations=detectEnterpriseOperations(message);
  const denied=PRIVATE_ACCESS_RX.test(norm(message));
  const targetStates=targets.map(enterpriseTargetState).filter(Boolean);
  return{
    version:ENTERPRISE_INTELLIGENCE_FABRIC_VERSION,
    active:targets.length>0,
    targets,
    operations,
    route:targets.length?(options.webEnabled===false?'enterprise_reasoning':'enterprise_live_evidence'):'standard',
    requireLiveEvidence:targets.length>0&&options.webEnabled!==false,
    evidencePolicy:'official-first-cross-check-verify-before-accept',
    accessPolicy:denied?'deny_private_access':'public_or_explicitly_authorized_only',
    deniedPrivateAccess:denied,
    integrations:Object.fromEntries(targetStates.map((target)=>[target.id,{kind:target.integration.kind,configured:target.integration.configured}])),
  };
}

export function authorizeEnterpriseOperation({target,operation='research',access='public',explicitAuthorization=false,humanApproved=false}={}){
  const state=enterpriseTargetState(target);
  if(!state)return{allowed:false,reason:'unknown_enterprise_target'};
  if(access==='private_internal')return{allowed:false,reason:'private_internal_access_unavailable'};
  if(access==='public')return{allowed:true,reason:'public_read_only',sideEffect:'read'};
  if(access!=='authorized_api')return{allowed:false,reason:'unsupported_access_mode'};
  if(!state.access.authorizedIntegration)return{allowed:false,reason:'authorized_integration_unconfigured'};
  const writeLike=/\b(write|update|delete|command|send|create|modify|control)\b/i.test(String(operation||''));
  if(!writeLike)return{allowed:true,reason:'authorized_read',sideEffect:'read'};
  if(!explicitAuthorization||!humanApproved)return{allowed:false,reason:'external_write_requires_explicit_authorization_and_human_approval'};
  return{allowed:true,reason:'authorized_write_approved',sideEffect:'external_write'};
}

function hostnameOf(url){try{return new URL(String(url||'')).hostname.toLowerCase()}catch{return''}}
function domainMatches(host,domain){return host===domain||host.endsWith(`.${domain}`)}

export function createEnterpriseProvenance({target,sourceUrl,title='',fetchedAt=new Date().toISOString(),contentHash='',sourceType='web'}={}){
  const state=enterpriseTargetState(target);
  const host=hostnameOf(sourceUrl);
  const official=Boolean(state&&host&&state.officialDomains.some((domain)=>domainMatches(host,domain)));
  const record={schema:ENTERPRISE_PROVENANCE_SCHEMA,target:state?.id||String(target||''),sourceUrl:String(sourceUrl||''),host,title:String(title||'').slice(0,240),fetchedAt:String(fetchedAt),sourceType:String(sourceType||'web'),official,contentHash:String(contentHash||'')||null};
  return{...record,recordHash:sha256(JSON.stringify(record))};
}

export function verifyEnterpriseEvidence(items=[]){
  const evidence=(Array.isArray(items)?items:[]).map((item)=>createEnterpriseProvenance(item));
  const officialCount=evidence.filter((item)=>item.official).length;
  return{
    schema:ENTERPRISE_PROVENANCE_SCHEMA,
    verified:evidence.length>0&&officialCount>0,
    evidenceCount:evidence.length,
    officialCount,
    crossChecked:evidence.length>=2,
    records:evidence,
    bundleHash:sha256(JSON.stringify(evidence.map(({recordHash})=>recordHash))),
  };
}
