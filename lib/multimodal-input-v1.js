export const MULTIMODAL_INPUT_VERSION='multimodal-input/v1';

const IMAGE=/^image\\/(jpeg|jpg|png|webp|gif|bmp|heic|heif)$/i;
const AUDIO=/^audio\\/(mpeg|mp3|wav|m4a|aac|ogg|webm|flac)$/i;
const VIDEO=/^video\\/(mp4|webm|mov|m4v|avi|mkv)$/i;
const DOCUMENT=/^(application\\/pdf|application\\/(msword|vnd\\.openxmlformats-officedocument\\.wordprocessingml\\.document|vnd\\.ms-excel|vnd\\.openxmlformats-officedocument\\.spreadsheetml\\.sheet)|text\\/(plain|csv|markdown)|application\\/json)$/i;

function typeOf(a={}){
  const type=String(a.type||a.mimeType||a.mime||'').toLowerCase();
  if(IMAGE.test(type))return'image';
  if(AUDIO.test(type))return'audio';
  if(VIDEO.test(type))return'video';
  if(DOCUMENT.test(type)||/\\.(pdf|docx?|xlsx?|csv|txt|md|json)$/i.test(String(a.name||'')))return'document';
  if(typeof a.text==='string'&&a.text.trim())return'text';
  return'unknown';
}
function dataUrl(a={}){
  const raw=String(a.dataUrl||a.data_url||a.base64||'').trim();
  if(!raw)return'';
  if(/^data:[^;]+;base64,/i.test(raw))return raw;
  const mime=String(a.type||a.mimeType||a.mime||'application/octet-stream').trim();
  return 'data:'+mime+';base64,'+raw.replace(/^base64,/i,'');
}
export function normalizeMultimodalAttachments(input=[]){
  if(!Array.isArray(input))return[];
  return input.slice(0,8).map((a,i)=>{
    const kind=typeOf(a),url=String(a.url||a.uri||'').trim(),data=dataUrl(a);
    const text=String(a.text||a.extractedText||a.extracted_text||'').slice(0,160000);
    return {id:String(a.id||'attachment-'+(i+1)).slice(0,120),name:String(a.name||'archivo-'+(i+1)).slice(0,180),mime:String(a.type||a.mimeType||a.mime||'application/octet-stream').slice(0,120),kind,url:url.slice(0,4000),dataUrl:data.slice(0,8000000),text,size:Number(a.size||0)||0};
  }).filter(a=>a.kind!=='unknown'||a.text);
}
export function multimodalCapabilities(attachments=[]){
  const items=normalizeMultimodalAttachments(attachments),counts=items.reduce((m,a)=>(m[a.kind]=(m[a.kind]||0)+1,m),{});
  return {version:MULTIMODAL_INPUT_VERSION,enabled:true,supportedKinds:['image','audio','video','document','text'],received:items.length,counts,nativePayloadAvailable:items.some(a=>a.url||a.dataUrl||a.text),analysisRequiresCompatibleModel:true,noPaidProviderAdded:true};
}
export function multimodalTextContext(attachments=[]){
  const blocks=normalizeMultimodalAttachments(attachments).filter(a=>a.text).map(a=>'--- '+a.name+' ('+a.mime+') ---\\n'+a.text);
  return blocks.length?'\\n\\nCONTENIDO EXTRAÍDO DE ARCHIVOS:\\n'+blocks.join('\\n'):'';
}
function source(a){return a.dataUrl||a.url||'';}
export function openAIInputParts(attachments=[]){
  return normalizeMultimodalAttachments(attachments).flatMap(a=>{const src=source(a);if(!src)return[];if(a.kind==='image')return[{type:'input_image',image_url:src}];if(a.kind==='document'||a.kind==='audio'||a.kind==='video')return[{type:'input_file',file_url:src}];return[];});
}
export function anthropicContentParts(attachments=[]){
  return normalizeMultimodalAttachments(attachments).flatMap(a=>{const src=source(a);if(!src)return[];if(a.kind==='image'){if(a.dataUrl){const base64=a.dataUrl.split(',')[1]||'';return[{type:'image',source:{type:'base64',media_type:a.mime.toLowerCase(),data:base64}}];}if(a.url)return[{type:'image',source:{type:'url',url:a.url}}];}if(a.kind==='document'&&a.url)return[{type:'document',source:{type:'url',url:a.url}}];return[];});
}
export function geminiParts(attachments=[]){
  return normalizeMultimodalAttachments(attachments).flatMap(a=>{const src=source(a);if(a.dataUrl){const base64=a.dataUrl.split(',')[1]||'';return[{inlineData:{mimeType:a.mime,data:base64}}];}if(a.url)return[{fileData:{mimeType:a.mime,fileUri:a.url}}];return[];});
}
export function multimodalPromptSuffix(attachments=[]){
  const items=normalizeMultimodalAttachments(attachments);if(!items.length)return'';
  return '\\n\\nCONTRATO MULTIMODAL ('+MULTIMODAL_INPUT_VERSION+'): analiza los archivos adjuntos que realmente recibiste. Para imágenes describe elementos visibles y responde a la pregunta; para audio/video analiza solo el contenido accesible al modelo y distingue transcripción de interpretación; para documentos usa el texto o archivo recibido. Si un formato no es compatible con el modelo seleccionado, dilo claramente y no inventes haberlo visto.\\nAdjuntos: '+items.map(a=>a.name+' ['+a.kind+', '+a.mime+']').join(', ');
}
