export const MULTIMODAL_EVIDENCE_LOCATIONS_VERSION='multimodal-evidence-locations/v1';

const num=v=>Number.isFinite(Number(v))?Number(v):null;
const str=(v,max=120)=>v==null?'':String(v).trim().slice(0,max);

function locator(a){
  const out={};
  const page=num(a.page??a.pageNumber??a.page_index); if(page!==null&&page>=1)out.page=page;
  const start=num(a.startTime??a.start_time??a.timestamp); if(start!==null&&start>=0)out.startSeconds=start;
  const end=num(a.endTime??a.end_time); if(end!==null&&end>=0)out.endSeconds=end;
  const segment=str(a.segment??a.segmentId??a.section,160); if(segment)out.segment=segment;
  const line=num(a.line??a.startLine); if(line!==null&&line>=1)out.line=line;
  const ref=str(a.sourceRef??a.reference,180); if(ref)out.sourceRef=ref;
  return out;
}

export function buildEvidenceLocations(attachments=[]){
  const items=(Array.isArray(attachments)?attachments:[]).slice(0,8);
  const sources=items.map((a,i)=>({
    fileId:String(a.id||'attachment-'+(i+1)),
    name:str(a.name,180),
    kind:String(a.kind||'unknown'),
    location:locator(a)
  }));
  return {
    version:MULTIMODAL_EVIDENCE_LOCATIONS_VERSION,
    sources,
    locatedSources:sources.filter(x=>Object.keys(x.location).length).length,
    policy:{
      onlyUseProvidedLocations:true,
      neverInventPageNumbers:true,
      neverInventTimestamps:true,
      neverInventSegments:true
    }
  };
}

export function evidenceLocationsInstruction(report){
  if(!report?.sources?.length)return '';
  return '\n\nLOCALIZACION DE EVIDENCIA ('+MULTIMODAL_EVIDENCE_LOCATIONS_VERSION+'):\n'+
    '- Si una fuente incluye página, línea, segmento o timestamp, úsalo para señalar la evidencia.\n'+
    '- Solo puedes citar localizadores presentes en el contrato recibido; nunca inventes páginas, timestamps, segmentos o líneas.\n'+
    '- Si no existe localizador, identifica únicamente el archivo.\n'+
    '- Distingue evidencia localizada de evidencia sin localizador.\n';
}

export function publicEvidenceLocations(report){
  return {
    version:MULTIMODAL_EVIDENCE_LOCATIONS_VERSION,
    locatedSources:report?.locatedSources||0,
    sources:(report?.sources||[]).map(x=>({fileId:x.fileId,name:x.name,kind:x.kind,location:x.location}))
  };
}