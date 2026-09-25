const plain=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,:]/g,' ').replace(/\s+/g,' ').trim();
export function isLegalCapabilityQuestion(raw=''){
 const q=plain(raw);
 return /^(?:(?:hola|oye|dime|por favor)\s+)*(?:puedes|podrias|me puedes|me podrias|puede universal core)\s+(?:ayudar(?:me)?|apoyar(?:me)?|trabajar conmigo)\s+(?:con|en)\s+(?:un|mi|el)?\s*(?:expediente|caso|asunto)\s+(?:legal|juridico)?$/.test(q)||
        /^(?:puedes|podrias)\s+(?:revisar|analizar|organizar)\s+(?:un|mi)?\s*(?:expediente|caso)\s+(?:legal|juridico)?$/.test(q);
}
export function legalCapabilityFastAnswer(){
 return [
  '**Sí. Puedo ayudarte a trabajar un expediente legal como herramienta de análisis y organización.**',
  'Puedo ordenar documentos, construir una cronología, identificar hechos y contradicciones, separar afirmaciones de evidencia, crear índices y matrices de pruebas, resumir escritos y preparar borradores o preguntas para revisión profesional.',
  'Si compartes archivos, trabajaré sobre su contenido sin asumir hechos que no aparezcan ahí. Para citar leyes, jurisprudencia o criterios vigentes necesito conocer la jurisdicción y verificar fuentes actuales.',
  'No sustituyo la representación de un abogado ni debo presentar como presentada, firmada o validada una actuación que no haya ocurrido.'
 ].join('\n\n');
}
