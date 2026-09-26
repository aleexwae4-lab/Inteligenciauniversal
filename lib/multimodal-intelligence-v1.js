export const MULTIMODAL_INTELLIGENCE_VERSION='multimodal-intelligence/v1';

const KIND_LABELS={image:'imagen',audio:'audio',video:'video',document:'documento',text:'texto',unknown:'desconocido'};

function words(text=''){return String(text).trim()?String(text).trim().split(/\s+/).length:0}
function compactText(text='',max=900){return String(text||'').replace(/\s+/g,' ').trim().slice(0,max)}
function extension(name=''){const m=String(name).toLowerCase().match(/\.([a-z0-9]+)$/);return m?m[1]:''}

export function buildMultimodalIntelligence(attachments=[]){
  const items=Array.isArray(attachments)?attachments.slice(0,8):[];
  const manifest=items.map((a,i)=>({
    id:String(a.id||'attachment-'+(i+1)),
    name:String(a.name||'archivo-'+(i+1)),
    kind:String(a.kind||'unknown'),
    label:KIND_LABELS[a.kind]||'archivo',
    mime:String(a.mime||'application/octet-stream'),
    extension:extension(a.name),
    bytes:Number(a.size||0)||0,
    hasUrl:!!a.url,
    hasData:!!a.dataUrl,
    hasExtractedText:!!String(a.text||'').trim(),
    extractedCharacters:String(a.text||'').length,
    extractedWords:words(a.text),
    textPreview:compactText(a.text),
    accessible:!!(a.url||a.dataUrl||String(a.text||'').trim())
  }));
  const counts=manifest.reduce((m,a)=>(m[a.kind]=(m[a.kind]||0)+1,m),{});
  const accessible=manifest.filter(a=>a.accessible);
  const unsupported=manifest.filter(a=>!a.accessible);
  const text=manifest.filter(a=>a.hasExtractedText);
  return {
    version:MULTIMODAL_INTELLIGENCE_VERSION,
    received:manifest.length,
    accessible:accessible.length,
    unsupported:unsupported.length,
    counts,
    manifest,
    evidence:{
      extractedTextFiles:text.length,
      extractedCharacters:text.reduce((n,a)=>n+a.extractedCharacters,0),
      extractedWords:text.reduce((n,a)=>n+a.extractedWords,0),
      previews:text.filter(a=>a.textPreview).map(a=>({name:a.name,kind:a.kind,preview:a.textPreview})).slice(0,8)
    },
    analysisPlan:{
      image:'visual_interpretation_when_model_supports_image_input',
      audio:'audio_interpretation_or_transcription_when_model_supports_audio_input',
      video:'video_interpretation_when_model_supports_video_input',
      document:'document_file_or_extracted_text_analysis',
      text:'direct_text_analysis'
    },
    integrity:{
      onlyReceivedFiles:true,
      unsupportedAreExplicit:true,
      noSyntheticEvidence:true
    }
  };
}

export function multimodalIntelligenceInstruction(report){
  if(!report||!report.received)return '';
  const kinds=Object.entries(report.counts||{}).map(([k,v])=>v+' '+(KIND_LABELS[k]||k)).join(', ');
  return '\n\nINTELIGENCIA MULTIMODAL ('+MULTIMODAL_INTELLIGENCE_VERSION+'):\n'+
    '- Archivos recibidos: '+report.received+'. Accesibles para análisis: '+report.accessible+'.\n'+
    '- Tipos detectados: '+(kinds||'ninguno')+'.\n'+
    '- Usa únicamente evidencia realmente presente en los archivos recibidos.\n'+
    '- Para imágenes: separa observación visual de inferencia.\n'+
    '- Para audio/video: separa contenido/transcripción de interpretación y no inventes segmentos no accesibles.\n'+
    '- Para documentos: usa texto extraído y/o el archivo cuando el proveedor lo soporte; conserva límites de extracción.\n'+
    '- Si un archivo no es accesible al modelo, dilo explícitamente y no lo presentes como analizado.\n';
}

export function publicMultimodalIntelligence(report){
  return {version:MULTIMODAL_INTELLIGENCE_VERSION,received:report?.received||0,accessible:report?.accessible||0,counts:report?.counts||{},evidence:report?.evidence||{extractedTextFiles:0,extractedCharacters:0,extractedWords:0},integrity:report?.integrity||{onlyReceivedFiles:true,unsupportedAreExplicit:true,noSyntheticEvidence:true}};
}