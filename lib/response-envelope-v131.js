export const RESPONSE_ENVELOPE_VERSION='assistant-response/v2';

function cleanText(value=''){
  return String(value??'').trim();
}

export function speechText(value=''){
  return cleanText(value)
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1')
    .replace(/https?:\/\/\S+/g,' enlace disponible ')
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g,'$1')
    .replace(/(^|\n)\s*(?:[-+*•▪◦●○■□◆◇►▶]|\d+[.)])\s+/gu,'$1')
    .replace(/\*\*|__|~~|[*_~`]/g,'')
    .replace(/\[(?:W|M)\d+\]/gi,' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'')
    .replace(/[ \t]+/g,' ')
    .replace(/\s*\n\s*/g,'. ')
    .replace(/(?:\.\s*){2,}/g,'. ')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,12000);
}

function safeSources(sources=[]){
  const seen=new Set(),output=[];
  for(const raw of Array.isArray(sources)?sources:[]){
    if(!raw||typeof raw!=='object')continue;
    const title=cleanText(raw.title).replace(/[\r\n]+/g,' ').slice(0,180);
    const value=cleanText(raw.url).slice(0,1800);
    if(!title||!value)continue;
    let url;
    try{url=new URL(value);if(!['https:','http:'].includes(url.protocol))continue}catch{continue}
    if(seen.has(url.href))continue;
    seen.add(url.href);
    output.push({title,url:url.href,publishedAt:raw.publishedAt||null,retrievedAt:raw.retrievedAt||null,scope:raw.scope||null});
    if(output.length>=8)break;
  }
  return output;
}

export function buildResponseEnvelope({reply='',sources=[],provider=null,model=null,agent=null,latencyMs=0,memory=null,tools=[],fallbackFailures=[]}={}){
  const normalizedSources=safeSources(sources);
  const toolRows=Array.isArray(tools)?tools:[];
  const fallbackRows=Array.isArray(fallbackFailures)?fallbackFailures:[];
  const content=cleanText(reply);
  return {
    schema:RESPONSE_ENVELOPE_VERSION,
    content,
    speechText:speechText(content),
    sources:normalizedSources,
    components:normalizedSources.length?[{type:'sources',data:{count:normalizedSources.length}}]:[],
    actions:[
      {id:'listen',label:'Escuchar',kind:'client'},
      {id:'copy',label:'Copiar',kind:'client'},
      {id:'workspace',label:'Workspace',kind:'client'}
    ],
    metadata:{
      provider:provider||null,
      model:model||null,
      agent:agent?.id||null,
      latencyMs:Number.isFinite(Number(latencyMs))?Math.max(0,Math.round(Number(latencyMs))):null,
      memoryRecalled:Number(memory?.recalled)||0,
      toolCount:toolRows.length,
      grounded:normalizedSources.length>0,
      fallbackCount:fallbackRows.length
    }
  };
}
