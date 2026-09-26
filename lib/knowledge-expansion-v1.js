export const KNOWLEDGE_EXPANSION_VERSION='knowledge-expansion/v1';

const clean=(s='',n=900)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const norm=(s='')=>clean(s,1200).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const KNOWLEDGE=[
 {id:'ai-model-pricing-2026',topics:['modelos de ia','precio','modelo mas caro','ai pricing','gpt-4','claude','gemini'],facts:[
  'GPT-4 original no debe tratarse como el modelo de IA más caro disponible en 2026; su precio histórico publicado fue de 0.03 USD por 1K tokens de entrada y 0.06 USD por 1K tokens de salida.',
  'Las comparaciones de precios deben usar la fecha y la modalidad (API, suscripción o infraestructura), porque los precios cambian y no son directamente equivalentes.',
  'Las respuestas sobre el modelo más caro deben verificar precios actuales de proveedores antes de afirmar un ganador.'
 ],sources:['OpenAI GPT-4 pricing/research page','provider pricing pages']},
 {id:'ai-capabilities',topics:['conocimientos','capacidades','programacion','ia','machine learning','software'],facts:[
  'Universal Core puede describir capacidades del sistema por módulos, pero no debe atribuirse un modelo base, número de parámetros o capacidad multimodal que no esté configurada y verificada.',
  'Las capacidades de fotos, audio, video y documentos dependen de la ruta multimodal disponible y de los proveedores/modelos configurados; la entrada de un archivo no equivale por sí sola a haber observado su contenido.',
  'Las afirmaciones de actualidad deben pasar por recuperación y verificación, no por memoria estática.'
 ],sources:['Universal Core runtime capability registry']},
 {id:'knowledge-domains',topics:['conocimientos','areas','programacion','bases de datos','seguridad','matematicas','idiomas','devops'],facts:[
  'Áreas soportadas para razonamiento asistido: programación y desarrollo web; bases de datos; ingeniería de datos; machine learning e IA; arquitectura de software; DevOps; seguridad informática defensiva; sistemas operativos; matemáticas y estadística; ciencias de la computación; gestión de proyectos; idiomas.',
  'La cobertura temática no implica que cada afirmación sea actual o correcta sin verificación; hechos cambiantes deben recuperarse y citarse.'
 ],sources:['Universal Core knowledge registry']}
];

export function expandKnowledgeForQuery(query=''){
 const n=norm(query);
 const matched=KNOWLEDGE.filter(x=>x.topics.some(t=>n.includes(norm(t))||norm(t).includes(n))).slice(0,4);
 return {version:KNOWLEDGE_EXPANSION_VERSION,matched:matched.map(x=>({id:x.id,facts:x.facts,sources:x.sources})),policy:{knowledgeIsVersioned:true,currentClaimsRequireVerification:true,noUnsupportedModelClaims:true,noInventedCapabilities:true}};
}
export function knowledgeExpansionInstruction(query=''){
 const report=expandKnowledgeForQuery(query);
 if(!report.matched.length)return '';
 return '\n\nBASE DE CONOCIMIENTO EXPANDIDA ('+KNOWLEDGE_EXPANSION_VERSION+'):\n'+JSON.stringify(report)+'\n- Usa estos registros como contexto estructurado, no como sustituto de evidencia actual.\n- Para precios, modelos disponibles y hechos cambiantes, verifica fuentes actuales.\n- No atribuyas parámetros, benchmarks o capacidades a Universal Core si no están registrados y verificados.\n';
}
export function publicKnowledgeExpansion(query=''){return expandKnowledgeForQuery(query);}
