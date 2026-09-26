export const CROSS_MEDIA_REASONING_VERSION='cross-media-reasoning/v1';

function norm(s=''){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu,' ').replace(/\s+/g,' ').trim()}
function tokens(s=''){return [...new Set(norm(s).split(' ').filter(x=>x.length>=4))].slice(0,120)}
function overlap(a,b){const A=new Set(tokens(a)),B=new Set(tokens(b));return [...A].filter(x=>B.has(x)).slice(0,12)}
function clean(s='',n=260){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}

export function buildCrossMediaReasoning(attachments=[],graph=null){
  const files=(Array.isArray(attachments)?attachments:[]).slice(0,8);
  const links=[];
  for(let i=0;i<files.length;i++)for(let j=i+1;j<files.length;j++){
    const a=files[i],b=files[j];
    const shared=overlap(a.text||a.name,b.text||b.name);
    if(shared.length)links.push({
      from:String(a.id||'attachment-'+(i+1)),
      to:String(b.id||'attachment-'+(j+1)),
      relation:'shared_terms',
      terms:shared,
      strength:Number(Math.min(1,shared.length/8).toFixed(2)),
      verifiedFromText:true
    });
  }
  const evidence=(files.map((a,i)=>({
    fileId:String(a.id||'attachment-'+(i+1)),
    name:clean(a.name,180),
    kind:String(a.kind||'unknown'),
    extractedText:!!String(a.text||'').trim(),
    preview:clean(a.text,420),
    graphNode:graph?.nodes?.find(n=>n.id===('file-'+(i+1)))?.id||null
  })));
  return {
    version:CROSS_MEDIA_REASONING_VERSION,
    files:evidence,
    crossLinks:links,
    linkedFilePairs:links.length,
    reasoningPolicy:{
      linksAreTextualSignals:true,
      notProofOfIdentity:true,
      noCrossMediaInferenceWithoutEvidence:true,
      preserveFileProvenance:true
    }
  };
}

export function crossMediaInstruction(report){
  if(!report?.files?.length)return '';
  return '\n\nRAZONAMIENTO CRUZADO MULTIMEDIA ('+CROSS_MEDIA_REASONING_VERSION+'):\n'+
    '- Puedes relacionar archivos cuando exista evidencia textual compartida o una relación explícita del modelo.\n'+
    '- Un término compartido es una señal, no prueba de que dos entidades sean la misma.\n'+
    '- Mantén la procedencia de cada afirmación por archivo.\n'+
    '- No atribuyas a audio/video/imagen contenido que no haya sido realmente accesible.\n'+
    '- Distingue correlación, evidencia directa e inferencia.\n';
}

export function publicCrossMediaReasoning(report){
  return {
    version:CROSS_MEDIA_REASONING_VERSION,
    files:(report?.files||[]).map(x=>({fileId:x.fileId,name:x.name,kind:x.kind,extractedText:x.extractedText})),
    linkedFilePairs:report?.linkedFilePairs||0,
    crossLinks:(report?.crossLinks||[]).slice(0,32),
    reasoningPolicy:report?.reasoningPolicy
  };
}