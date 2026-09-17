import { createHash } from 'node:crypto';

export const DIGITAL_ASSET_MEMORY_V105='digital-asset-memory/v105';

const configured=()=>!!process.env.SUPABASE_URL&&!!process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({
  apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type':'application/json'
});
const safe=(value,max)=>String(value??'').replace(/\u0000/g,'').trim().slice(0,max);
const hash=value=>createHash('sha256').update(String(value||'')).digest('hex');
const hashKey=value=>hash(String(value||'anonymous'));

const TYPE_RULES=[
  ['code',/```|\b(c[oó]digo|script|funci[oó]n|api|sql|typescript|javascript|python|backend|frontend)\b/i],
  ['legal_document',/\b(contrato|demanda|denuncia|escrito legal|cl[aá]usula|jur[ií]dico|legal)\b/i],
  ['strategy',/\b(estrategia|roadmap|plan de acci[oó]n|prioridades|go to market|crecimiento|growth)\b/i],
  ['procedure',/\b(procedimiento|sop|manual|protocolo|checklist|pasos|flujo de trabajo)\b/i],
  ['research',/\b(investigaci[oó]n|evidencia|fuentes|bibliograf[ií]a|hallazgos|an[aá]lisis comparativo)\b/i],
  ['financial_asset',/\b(roi|flujo de caja|margen|ebitda|presupuesto|costos|ingresos|precio|valuaci[oó]n)\b/i],
  ['decision_support',/\b(decisi[oó]n|alternativas|riesgos|recomendaci[oó]n|trade[- ]?off|escenario)\b/i],
  ['learning_asset',/\b(aprender|explicaci[oó]n|marco mental|lecci[oó]n|curso|estudio|concepto)\b/i],
  ['document',/\b(documento|informe|reporte|propuesta|plantilla|resumen ejecutivo|guion)\b/i],
];

function titleFrom(text='',type='asset'){
  const raw=safe(text,4000);
  const heading=raw.split('\n').map(x=>x.trim()).find(x=>/^#{1,4}\s+/.test(x));
  const candidate=(heading?heading.replace(/^#{1,4}\s+/,''):raw.split(/[\n.!?]/)[0]).trim();
  return safe(candidate||`Activo ${type}`,140);
}

export function classifyDigitalAssetV105({userText='',assistantText=''}={}){
  const user=safe(userText,4000),assistant=safe(assistantText,24000);
  const combined=`${user}\n${assistant}`;
  let assetType='knowledge_asset';
  for(const [type,rx] of TYPE_RULES){if(rx.test(combined)){assetType=type;break}}
  const reusable=assistant.length>=160&&(!/^\s*(sí|no|ok|listo|gracias|de acuerdo)[.!\s]*$/i.test(assistant));
  return{
    version:DIGITAL_ASSET_MEMORY_V105,
    assetType,
    title:titleFrom(assistant,assetType),
    reusable,
    contentHash:hash(assistant),
    outcomeStatus:'unverified',
    monetaryValue:null,
    monetaryValueVerified:false
  };
}

export function assetArchiveIntentV105(message=''){
  const q=safe(message,4000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matched=/\b(libro|biografia|autobiografia|cronologia|historial|memoria|conversaciones|chats|bitacora|diario|portafolio|playbook|manual|activos digitales|patrimonio digital|como maneje mi vida|como dirigi mi vida|como opere mi empresa|mi vida con (?:la )?ia|mi vida con inteligencia artificial)\b/i.test(q);
  const longitudinal=/\b(todas|todo mi|a traves del tiempo|historico|historia completa|desde que|mis conversaciones|mis chats|mi memoria)\b/i.test(q);
  return{version:DIGITAL_ASSET_MEMORY_V105,matched,longitudinal};
}

export function formatLongitudinalArchiveV105(rows=[],maxChunks=7){
  if(!Array.isArray(rows)||!rows.length)return[];
  const selected=rows.slice(-42);
  const chunks=[];
  const size=Math.max(1,Math.ceil(selected.length/Math.max(1,maxChunks)));
  for(let i=0;i<selected.length;i+=size){
    const block=selected.slice(i,i+size).map((row,index)=>{
      const date=row.created_at?new Date(row.created_at).toISOString():'';
      const user=safe(row.user_text,1800);
      const assistant=safe(row.assistant_text,4200);
      const asset=classifyDigitalAssetV105({userText:user,assistantText:assistant});
      return `${index+1}. ${date?`[${date}] `:''}${asset.assetType.toUpperCase()} — Usuario: ${user}\nAsistente: ${assistant}`;
    }).join('\n\n');
    chunks.push({
      content:`ARCHIVO LONGITUDINAL DE ACTIVOS DEL USUARIO — bloque ${chunks.length+1}:\n${block}`,
      metadata:{kind:'digital_asset_archive',version:DIGITAL_ASSET_MEMORY_V105,sourcePolicy:'user-owned-conversation-history',outcomePolicy:'do-not-invent-value'},
      created_at:selected[Math.min(i+size-1,selected.length-1)]?.created_at||null,
      rank:95
    });
  }
  return chunks.slice(0,maxChunks);
}

export async function recallLongitudinalArchiveV105(userKey,{limit=42}={}){
  if(!configured()||!userKey)return[];
  try{
    const key=hashKey(userKey);
    const capped=Math.max(8,Math.min(80,Number(limit)||42));
    const url=`${process.env.SUPABASE_URL}/rest/v1/wae_universal_memory_v103?user_key_hash=eq.${encodeURIComponent(key)}&select=user_text,assistant_text,metadata,created_at&order=created_at.desc&limit=${capped}`;
    const res=await fetch(url,{headers:headers(),signal:AbortSignal.timeout(8000)});
    if(!res.ok)return[];
    const rows=await res.json();
    return Array.isArray(rows)?rows.reverse():[];
  }catch{return[]}
}

export async function indexDigitalAssetV105({userKey,sessionId='',conversationId='',userText='',assistantText='',metadata={}}={}){
  if(!configured()||!userKey)return false;
  const asset=classifyDigitalAssetV105({userText,assistantText});
  if(!asset.reusable)return false;
  try{
    const row={
      user_key_hash:hashKey(userKey),
      session_id:safe(sessionId,200)||null,
      conversation_id:safe(conversationId,200)||null,
      asset_type:asset.assetType,
      title:asset.title,
      content_hash:asset.contentHash,
      reusable:true,
      outcome_status:'unverified',
      outcome_metadata:{},
      metadata:{
        ...((metadata&&typeof metadata==='object')?metadata:{}),
        assetVersion:DIGITAL_ASSET_MEMORY_V105,
        valuePolicy:'user-confirmed-or-system-verified-only',
        rawAssistantContentDuplicated:false
      },
      updated_at:new Date().toISOString()
    };
    const res=await fetch(`${process.env.SUPABASE_URL}/rest/v1/wae_digital_asset_index_v105?on_conflict=user_key_hash,content_hash`,{
      method:'POST',
      headers:{...headers(),Prefer:'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(row),
      signal:AbortSignal.timeout(6000)
    });
    return res.ok;
  }catch{return false}
}

export function digitalAssetMemoryCapabilitiesV105(){
  return{
    version:DIGITAL_ASSET_MEMORY_V105,
    responseAsAsset:true,
    persistentAssetIndex:true,
    assetTypes:['knowledge_asset','document','legal_document','strategy','procedure','research','financial_asset','decision_support','learning_asset','code'],
    longitudinalConversationReconstruction:true,
    lifeAndWorkChronology:true,
    bookFromAuthorizedConversationHistory:true,
    manualAndPlaybookFromHistory:true,
    professionalPortfolioFromHistory:true,
    decisionAndStrategyLedger:true,
    learningLedger:true,
    adaptiveUserContextCompatible:true,
    outcomeTrackingSchemaReady:true,
    inventedMonetaryValueForbidden:true,
    rawAssistantContentDuplicatedInAssetIndex:false,
    historySource:'wae_universal_memory_v103',
    security:{hashedUserKey:true,serviceRoleOnly:true,rlsEnabled:true}
  };
}
