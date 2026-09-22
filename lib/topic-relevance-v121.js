// Relevance firewall for retrieved sources and AI answers, independent of providers.
// A missing search hit is not proof of a negative fact, and irrelevant hits are
// NOT evidence for the question. All functions here are pure.
const plain=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const filler=new Set('cuantos cuantas cuanto cuanta tiene tienen para el la los las de del su sus una uno unos unas por que cual cuales es son sobre hace hacen inteligencia artificial desarrollo desarrollan empresa compania numero cantidad total persona personas ingenieros ingeniero equipo equipos empleados empleado actualmente hoy actual informacion fuentes fuente referencias verifica buscar busca buscarme respuesta dato datos exacto exacta estimado estimacion aproximado aproximadamente en y o a como esta este'.split(' '));
const aliases={anthropic:['anthropic','antropic','claude'],openai:['openai','chatgpt'],google:['google','gemini','alphabet'],microsoft:['microsoft','azure'],meta:['meta','facebook','instagram'],nvidia:['nvidia'],spacex:['spacex'],tesla:['tesla'],apple:['apple'],amazon:['amazon','aws']};
const aliasesIn=question=>{
 const q=plain(question);
 return Object.entries(aliases).filter(([,variants])=>variants.some(v=>new RegExp('\\b'+v+'\\b').test(q))).map(([key])=>key);
};
export function relevantSources(question='',sources=[]){
 if(!Array.isArray(sources))return [];
 const keys=aliasesIn(question);
 const tokens=(plain(question).match(/[a-z0-9]{5,}/g)||[]).filter(t=>!filler.has(t));
 return sources.filter(item=>{
  if(!item||typeof item!=='object')return false;
  const s=plain([item.title,item.snippet,item.content,item.url].filter(Boolean).join(' '));
  if(!s)return false;
  if(keys.length)return keys.some(key=>aliases[key].some(v=>new RegExp('\\b'+v+'\\b').test(s)));
  return tokens.length===0 || tokens.some(t=>s.includes(t));
 });
}
export function isHeadcountQuestion(question=''){
 const q=plain(question);
 return /\b(?:cuant[oa]s?|numero|cantidad|plantilla|headcount|cuantos empleados)\b/.test(q)&&
   /\b(?:ingenier\w*|emplead\w*|trabajador\w*|plantilla|personas|personal|engineers|employees)\b/.test(q)&&
   /\b(?:tiene|tienen|trabajan|contrata|hay|cuenta|emplea|at|en|para|de)\b/.test(q);
}
export const EVIDENCE_RELEVANCE_GUIDANCE=[
 'Contesta primero la pregunta del usuario con el conocimiento general pertinente; busca datos actuales cuando la pregunta sea temporal y solo atribuye cifras verificadas a fuentes realmente pertinentes.',
 'La falta de resultados web no es una respuesta: no hables de la evidencia proporcionada, enlaces W1-W5, proveedores ni errores de búsqueda si nadie preguntó por la búsqueda misma.',
 'Si preguntan cuántos ingenieros tiene una empresa y no se ha verificado un desglose público, di concisamente que no puedes confirmar la cifra exacta. NO confundas el total de empleados con ingenieros, NO inventes cifras ni porcentajes.',
 'Solo ofrece una estimación numérica cuando puedas declarar sus datos de entrada y supuesto; no atribuyas un dato a un informe que no lo dice.',
 'Fuentes sin relación temática (p. ej. CDC, autenticación de Google o OpenAI para el equipo de Anthropic) no respaldan ningún enunciado: descártalas por completo, no enumeres ni critiques su irrelevancia al usuario.',
 'A las preguntas generales, creativas, históricas o conceptuales responde de forma normal, aunque no haya búsqueda web. Explica limitaciones solo cuando modifiquen materialmente la respuesta.'
].join(' ');
export function irrelevantEvidenceAnswer(answer='',question=''){
 const reply=plain(answer),q=plain(question);
 if(!reply)return 'empty_answer';
 const audit=/\b(?:evidencia|fuentes|documentos|bibliografia|busqueda|buscador)\b/.test(q)&&/\b(?:analiza|revisa|audita|evalua|por que|por que no|limitaciones)\b/.test(q);
 if(audit)return '';
 if(/(?:no existe informacion|no hay informacion|no encuentro|no se encontro|no encontre|no hay datos)\s.{0,75}(?:evidencia|fuentes|documentos)/.test(reply))return 'evidence_as_nonanswer';
 if(/(?:evidencia|fuentes|documentos)\s+(?:web\s+)?(?:proporcionad[oa]s?|recuperad[oa]s?|disponibles?)\s+(?:para\s+)?(?:determinar|responder|encontrar)/.test(reply))return 'evidence_as_nonanswer';
 if(/\b(?:documentos?|resultados?) de la evidencia web\b/.test(reply)||/\b(?:w1\s*[-–]\s*w5|w\d\s*[-–]\s*w\d)\b/.test(reply))return 'internal_evidence_dump';
 if(/(?:no hay|no existe|no se encontro)\s+evidencia\s+(?:publica|suficiente|disponible|proporcionada)/.test(reply))return 'evidence_as_nonanswer';
 return '';
}
