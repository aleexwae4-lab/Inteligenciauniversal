export function encodeSSE(event,data){
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseOpenAIDataLine(line){
  const raw=String(line||'').trim();
  if(!raw.startsWith('data:'))return null;
  const body=raw.slice(5).trim();
  if(!body||body==='[DONE]')return body==='[DONE]'?{done:true}:null;
  let data;try{data=JSON.parse(body)}catch{return null}
  const delta=data?.choices?.[0]?.delta?.content;
  const usage=data?.usage||null;
  return {done:false,delta:typeof delta==='string'?delta:'',usage,data};
}

export function safeReasoningStatus(value){
  const allowed=new Set(['analizando','buscando','consultando datos','ejecutando herramienta','verificando','preparando respuesta']);
  const v=String(value||'').toLowerCase().trim();
  return allowed.has(v)?v:'analizando';
}
