export const MULTIMODAL_FINDINGS_VERSION='multimodal-findings/v1';

function clean(s='',n=420){return String(s||'').replace(/\s+/g,' ').trim().slice(0,n)}
function terms(s=''){return [...new Set(String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>=5))].slice(0,24)}
function loc(a){const x={}; if(Number.isFinite(Number(a.page??a.pageNumber))&&Number(a.page??a.pageNumber)>=1)x.page=Number(a.page??a.pageNumber); if(Number.isFinite(Number(a.timestamp??a.startTime))&&Number(a.timestamp??a.startTime)>=0)x.startSeconds=Number(a.timestamp??a.startTime); if(a.segment)x.segment=clean(a.segment,120); return x}

export function buildMultimodalFindings(attachments=[],graph=null,crossMedia=null){
 const items=(Array.isArray(attachments)?attachments:[]).slice(0,8), findings=[];
 items.forEach((a,i)=>{
   const id=String(a.id||'attachment-'+(i+1)), text=clean(a.text,900), ts=terms(text);
   if(text) findings.push({id:'finding-'+(i+1),type:'textual_evidence',statement:text,sourceFileId:id,sourceName:clean(a.name,180),location:loc(a),terms:ts,confidence:0.86,confidenceBasis:'extracted_text',verified:true});
   else if(a.url||a.dataUrl) findings.push({id:'finding-'+(i+1),type:'media_available',statement:'El archivo está disponible para una entrada multimodal compatible; su contenido no se afirma como observado aquí.',sourceFileId:id,sourceName:clean(a.name,180),location:loc(a),terms:[],confidence:0.5,confidenceBasis:'file_access_only',verified:true});
 });
 (crossMedia?.crossLinks||[]).slice(0,16).forEach((x,i)=>{
   findings.push({id:'finding-cross-'+(i+1),type:'cross_file_signal',statement:'Los archivos comparten términos textuales: '+(x.terms||[]).join(', ')+'.',sourceFileIds:[x.from,x.to],confidence:Number(x.strength||0),confidenceBasis:'shared_textual_terms',verified:true,requiresModelVerification:true});
 });
 return {version:MULTIMODAL_FINDINGS_VERSION,findings,policy:{verifiedOnly:true,confidenceIsNotTruth:true,crossFileSignalsRequireVerification:true,locationsOnlyFromInput:true,noSyntheticObservations:true}};
}
export function findingsInstruction(report){
 if(!report?.findings?.length)return '';
 return '\n\nMOTOR DE HALLAZGOS MULTIMEDIA ('+MULTIMODAL_FINDINGS_VERSION+'):\n'+
 '- Trata cada hallazgo como evidencia estructurada, no como verdad absoluta.\n'+
 '- La confianza describe la base disponible, no garantiza que una interpretación sea correcta.\n'+
 '- Los hallazgos cross_file_signal son señales y requieren verificación antes de afirmar identidad o causalidad.\n'+
 '- Conserva archivo y localizador cuando estén disponibles.\n'+
 '- No inventes observaciones de imagen, audio o video que no hayan sido realmente accesibles.\n';
}
export function publicFindings(report){return {version:MULTIMODAL_FINDINGS_VERSION,findings:(report?.findings||[]).slice(0,32),policy:report?.policy};}