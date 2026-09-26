export const MULTIMODAL_INPUT_VERSION='multimodal-input/v1';

function typeOf(a={}){
  const type=String(a.type||a.mimeType||a.mime||'').toLowerCase();
  const name=String(a.name||'').toLowerCase();
  if(type.startsWith('image/')||/\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)$/.test(name))return'image';
  if(type.startsWith('audio/')||/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(name))return'audio';
  if(type.startsWith('video/')||/\.(mp4|webm|mov|m4v|avi|mkv)$/.test(name))return'video';
  if(type==='application/pdf'||type.startsWith('text/')||type.includes('word')||type.includes('excel')||type.includes('spreadsheet')||/\.(pdf|doc|docx|xls|xlsx|csv|txt|md|json)$/.test(name))return'document';
  if(typeof a.text==='string'&&a.text.trim())return'text';
  return'unknown';
}
function dataUrl(a={}){
  const raw=String(a.dataUrl||a.data_url||a.base64||'').trim();
  if(!raw)return'';
  if(raw.startsWith('data:'))return raw;
  const mime=String(a.type||a.mimeType||a.mime||'application/octet-stream').trim();
  return 'data:'+mime+';base64:'+raw.replace(/^base64,/i,'');
}
export function normalizeMultimodalAttachments(input=[]){
  if(!Array.isArray(input))return[];
  return input.slice(0,8).map((a,i)=>{
    const kind=typeOf(a);
    return {id:String(a.id||'attachment-'+(i+1)).slice(0,120),name:String(a.name||'archivo-'+(i+1)).slice(0,180),mime:String(a.type||a.mimeType||a.mime||'application/octet-stream').slice(0,120),kind,url:String(a.url||a.uri||'').slice(0,4000),dataUrl:dataUrl(a).slice(0,8000000),text:String(a.text||a.extractedText||a.extracted_text||'').slice(0,160000),size:Number(a.size||0)||0};
  }).filter(a=>a.kind!=='unknown'||a.text);
}
export function multimodalCapabilities(attachments=[]){
  const items=normalizeMultimodalAttachments(attachments);
  const counts=items.reduce((m,a)=>(m[a.kind]=(m[a.kind]||0)+1,m),{});
  return {version:MULTIMODAL_INPUT_VERSION,enabled:true,supportedKinds:['image','audio','video','document','text'],received:items.length,counts,nativePayloadAvailable:items.some(a=>a.url||a.dataUrl||a.text),analysisRequiresCompatibleModel:true,noPaidProviderAdded:true};
}
export function multimodalTextContext(attachments=[]){
  const blocks=normalizeMultimodalAttachments(attachments).filter(a=>a.text).map(a=>'--- '+a.name+' ('+a.mime+') ---\\n'+a.text);
  return blocks.length?'\\n\\nCONTENIDO EXTRAÍDO DE ARCHIVOS:\\n'+blocks.join('\\n'):'';
}
function source(a){return a.dataUrl||a.url||'';}
export function openAIInputParts(attachments=[]){
  return normalizeMultimodalAttachments(attachments).flatMap(a=>{const src=source(a);if(!src)return[];if(a.kind==='image')return[{type:'input_image',image_url:src}];if(a.kind==='document')return[{type:'input_file',file_url:src}];return[];});
}
export function anthropicContentParts(attachments=[]){
  return normalizeMultimodalAttachments(attachments).flatMap(a=>{const src=source(a);if(!src)return[];if(a.kind==='image'&&a.dataUrl){return[{type:'image',source:{type:'base64',media_type:a.mime.toLowerCase(),data:a.dataUrl.split(',')[1]||''}}];}if(a.kind==='image'&&a.url)return[{type:'image',source:{type:'url',url:a.url}}];return[];});
}
export function geminiParts(attachments=[]){
  return normalizeMultimodalAttachments(attachments).flatMap(a=>{const src=source(a);if(a.dataUrl)return[{inlineData:{mimeType:a.mime,data:a.dataUrl.split(',')[1]||''}}];if(src)return[{fileData:{mimeType:a.mime,fileUri:src}}];return[];});
}
export function multimodalPromptSuffix(attachments=[]){
  const items=normalizeMultimodalAttachments(attachments);if(!items.length)return'';
  return '\\n\\nCONTRATO MULTIMODAL ('+MULTIMODAL_INPUT_VERSION+'): analiza únicamente los archivos realmente recibidos. Si el formato no es compatible con el modelo seleccionado, dilo claramente y no inventes haberlo visto. Adjuntos: '+items.map(a=>a.name+' ['+a.kind+', '+a.mime+']').join(', ');
}