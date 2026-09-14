const cleanText=(value,max=50000)=>String(value??'').trim().slice(0,max);

export function sanitizeSpeechText(raw=''){
  return String(raw||'').normalize('NFKC').replace(/\r\n?/g,'\n')
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/:::progress\s+([^|\n]+)\|(\d+(?:\.\d+)?)/gi,'$1, $2 por ciento.')
    .replace(/:::metric\s+([^|\n]+)\|([^|\n]+)(?:\|[^\n]+)?/gi,'$1, $2.')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/\[(?:W|M)\d+\]/gi,' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi,' enlace disponible ')
    .replace(/<[^>]+>/g,' ')
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g,'$1')
    .replace(/(^|\n)\s*(?:[-+*•▪◦●○■□◆◇►▶]|\d+[.)])\s+/gu,'$1')
    .replace(/\*\*|__|~~|[*_~`]/g,'')
    .replace(/[→⇒➜➝➞➡⟶⟹↦↪]/gu,', ')
    .replace(/[•▪◦●○■□◆◇►▶]/gu,', ')
    .replace(/\|/g,', ')
    .replace(/[#@]/g,' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'')
    .replace(/[\[\]{}<>]/g,' ')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*%/g,'$1 por ciento')
    .replace(/[ \t]+/g,' ')
    .replace(/\s*\n\s*/g,'. ')
    .replace(/(?:\.\s*){2,}/g,'. ')
    .replace(/\s+([,.!?;:])/g,'$1')
    .replace(/([,.!?;:])(?=[\p{L}\p{N}])/gu,'$1 ')
    .replace(/\s+/g,' ').trim();
}

export function parseResponseComponents(raw=''){
  const lines=String(raw||'').split(/\r?\n/),out=[];let i=0;
  const special=x=>/^(#{1,4})\s+|^:::|^[-*+]\s+|^\d+[.)]\s+|^>\s?|^```/.test(x.trim());
  while(i<lines.length){const line=lines[i],trim=line.trim();if(!trim){i++;continue}
    if(/^```wae-chart\b/i.test(trim)){const buf=[];i++;while(i<lines.length&&!/^```\s*$/.test(lines[i]))buf.push(lines[i++]);if(i<lines.length)i++;try{const spec=JSON.parse(buf.join('\n'));const items=Array.isArray(spec.items)?spec.items.slice(0,20).map(x=>({label:cleanText(x?.label,160),value:Number(x?.value)})).filter(x=>x.label&&Number.isFinite(x.value)):[];if(['bar','line'].includes(spec.type)&&items.length)out.push({type:'chart',data:{type:spec.type,title:cleanText(spec.title,200)||'Gráfica',items}});else out.push({type:'code',data:{language:'json',code:buf.join('\n')}})}catch{out.push({type:'code',data:{language:'json',code:buf.join('\n')}})}continue}
    if(/^```/.test(trim)){const language=trim.replace(/^```/,'').trim().slice(0,40),buf=[];i++;while(i<lines.length&&!/^```\s*$/.test(lines[i]))buf.push(lines[i++]);if(i<lines.length)i++;out.push({type:'code',data:{language,code:buf.join('\n')}});continue}
    let m;if((m=trim.match(/^:::metric\s+([^|]+)\|([^|]+)(?:\|(.+))?$/i))){out.push({type:'metric',data:{label:m[1].trim(),value:m[2].trim(),detail:m[3]?.trim()||null}});i++;continue}
    if((m=trim.match(/^:::progress\s+([^|]+)\|(\d+(?:\.\d+)?)$/i))){out.push({type:'progress',data:{label:m[1].trim(),value:Math.max(0,Math.min(100,Number(m[2])))}});i++;continue}
    if(/^\|?.+\|.+\|?$/.test(trim)&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){const block=[line,lines[i+1]];i+=2;while(i<lines.length&&/\|/.test(lines[i])&&lines[i].trim())block.push(lines[i++]);const rows=block.map(l=>l.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim()));out.push({type:'table',data:{headers:rows[0],rows:rows.slice(2)}});continue}
    if((m=trim.match(/^(#{1,4})\s+(.+)$/))){out.push({type:'heading',data:{level:m[1].length,text:m[2]}});i++;continue}
    if(/^>\s?/.test(trim)){out.push({type:'quote',data:{text:trim.replace(/^>\s?/,'' )}});i++;continue}
    if(/^[-*+]\s+/.test(trim)){const items=[];while(i<lines.length&&/^\s*[-*+]\s+/.test(lines[i]))items.push(lines[i++].replace(/^\s*[-*+]\s+/,''));out.push({type:'list',data:{ordered:false,items}});continue}
    if(/^\d+[.)]\s+/.test(trim)){const items=[];while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i]))items.push(lines[i++].replace(/^\s*\d+[.)]\s+/,''));out.push({type:'list',data:{ordered:true,items}});continue}
    const para=[trim];i++;while(i<lines.length&&lines[i].trim()&&!special(lines[i])&&!(i+1<lines.length&&/\|/.test(lines[i])&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]))){para.push(lines[i].trim());i++}out.push({type:'paragraph',data:{text:para.join(' ')}});
  }
  return out.slice(0,120);
}

export function buildAssistantResponse({content='',sources=[],provider=null,model=null,latencyMs=null,memoryCount=0,requestId=null,messageId=null,conversationId=null,webUsed=false,degraded=false}={}){
  const components=parseResponseComponents(content);
  return {schema:'assistant-response/v1',content,components,actions:[
    {id:'listen',label:'Escuchar',kind:'client'},
    {id:'copy',label:'Copiar',kind:'client'},
    {id:'workspace',label:'Workspace',kind:'client'},
    {id:'feedback_up',label:'Útil',kind:'feedback',value:1},
    {id:'feedback_down',label:'Mejorar',kind:'feedback',value:-1}
  ],sources,chartData:components.filter(x=>x.type==='chart').map(x=>x.data),tableData:components.filter(x=>x.type==='table').map(x=>x.data),speechText:sanitizeSpeechText(content),confidence:null,metadata:{responseSchema:'assistant-response/v1',requestId,messageId,conversationId,provider,model,latencyMs,memoryCount,webUsed,degraded,ttftMs:null}};
}
