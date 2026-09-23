// Quality is information per paragraph, not the number of characters.
// A long deliverable stays long when the user asks for depth or the task requires it.
// This module never rejects a provider response or invents missing information.
const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function answerScope(question='',mode='general',hasAttachments=false){
 const q=normalize(question);
 if(/\b(?:breve|corto|concis[oa]|resumen corto|en una frase|en dos frases|directo al grano|solo (?:el|la|los|las|una|un) (?:dato|numero|cifra|respuesta)|sin explicacion|sin rodeos)\b/.test(q))return 'direct';
 if(hasAttachments||['code','research','analysis','design','executive'].includes(String(mode||'').toLowerCase()) ||
   /\b(?:detallad[oa]|a fondo|profund[oa]|exhaustiv[oa]|complet[oa]|paso a paso|todos los pasos|manual|tutorial|auditoria|investigacion (?:integral|exhaustiva|completa)|arquitectura|implementar|implementa|desarrolla|programa|corrige|soluciona|construye|crea (?:un|una) (?:sistema|aplicacion|proyecto|documento|libro)|codigo|plan (?:de negocio|operativo|estrategico)|proyecto (?:completo|integral))\b/.test(q))return 'deep';
 if(q.length<=250&&/\b(?:cuant[oa]s?|que (?:es|significa)|quien|cual|cuando|donde|en que se diferencia|es cierto|puedes|podrias|por que)\b/.test(q))return 'direct';
 return 'balanced';
}
export function focusGuidance(question='',mode='general',hasAttachments=false){
 const scope=answerScope(question,mode,hasAttachments);
 const shared=[
  'OBJETIVO EDITORIAL: maximiza utilidad, precisión y novedad de cada párrafo; NO confundas respuesta extensa con respuesta profunda.',
  'Primero resuelve lo solicitado. Cada párrafo adicional debe aportar un dato, explicación causal, paso ejecutable, prueba, ejemplo pertinente o decisión que aún no aparezca.',
  'No repitas una conclusión en introducción, tabla y lista. No agregues un índice, autopresentación, definición genérica, advertencia ritual, próximos pasos o invitación a seguir conversando si no agregan valor.',
  'Markdown, tarjetas y tablas solo cuando hagan la información más fácil de consumir; no infles una respuesta con apartados obligatorios. No inventes investigación, fuentes, acciones, cifras ni capacidades.',
  'Una limitación real se menciona de forma precisa y proporcional, nunca desplaza una respuesta que sí puedes dar.'
 ];
 const byScope={
  direct:'CONSULTA PUNTUAL: da la respuesta concreta primero, seguida únicamente de la precisión indispensable y fuente pertinente si realmente la hay. Por defecto bastan uno o dos párrafos breves; NO impongas un límite si el usuario pidió más o el asunto exige matices.',
  balanced:'CONSULTA GENERAL: da respuesta, explicación y aplicación práctica solo cuando aporten algo distinto; no uses una plantilla de secciones por inercia.',
  deep:'ENCARGO AMPLIO O PROFESIONAL: desarrolla todo el detalle necesario para un entregable aprovechable. Incluye código completo, metodología, ejemplos, fuentes, riesgos y validaciones cuando correspondan; no acortes información útil por una cuota de palabras.'
 };
 return [...shared,byScope[scope]].join('\n');
}
export function removeRedundantParagraphs(answer='',question='',mode='general',hasAttachments=false){
 const original=String(answer??'');
 if(answerScope(question,mode,hasAttachments)==='deep'||original.length<150||
    /\x60{3}|~~~/.test(original)||/^\s*\|.*\|\s*$/m.test(original))return original;
 // Only exact repeated prose paragraphs are removed; near-synonyms can differ
 // in meaning, so a regex must never compress them or delete cited evidence.
 const blocks=original.split(/(\n[ \t]*\n+)/);
 const seen=new Set();
 const output=[];
 for(let i=0;i<blocks.length;i++){
  const block=blocks[i],separator=i%2===1;
  if(separator){output.push(block);continue}
  const norm=normalize(block).replace(/\s+/g,' ').replace(/^\*{1,2}/,'').replace(/\*{1,2}$/,'');
  if(norm.length>=65&&seen.has(norm))continue;
  if(norm.length>=65)seen.add(norm);
  output.push(block);
 }
 return output.join('').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n').trim();
}
