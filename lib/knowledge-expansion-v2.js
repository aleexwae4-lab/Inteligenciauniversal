export const KNOWLEDGE_EXPANSION_VERSION='knowledge-expansion/v2';

const clean=(s='',n=1000)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const norm=(s='')=>clean(s,1400).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const KNOWLEDGE=[
{id:'ai-pricing-current',topics:['modelo mas caro','modelo más caro','precio ia','precios ia','ai pricing','gpt-4','gpt-5','gpt-6'],facts:[
'No existe un único «modelo más caro» sin definir métrica y modalidad: precio por tokens, capacidad reservada, suscripción, herramienta especializada o infraestructura.',
'GPT-4 original no debe presentarse como el modelo más caro disponible actualmente. Su precio histórico publicado fue 0.03 USD por 1K tokens de entrada y 0.06 USD por 1K tokens de salida.',
'La información actual de precios debe verificarse en las páginas oficiales del proveedor antes de afirmar cuál es el modelo más caro.'
],sources:['OpenAI official pricing/model pages'],requiresLiveVerification:true},
{id:'ai-model-claims',topics:['modelo base','parametros','175b','contexto','multimodalidad','gpt-4','vision'],facts:[
'No se debe afirmar que Universal Core utiliza GPT-4 ni atribuirle 175B parámetros salvo que el runtime lo tenga configurado y verificable.',
'Las capacidades de un producto no se deben equiparar automáticamente con las capacidades de un modelo concreto.',
'GPT-4.1, por ejemplo, tiene una ventana de contexto publicada de 1,047,576 tokens y admite imagen como entrada, pero no audio ni video según su ficha oficial.'
],sources:['OpenAI official model documentation'],requiresLiveVerification:true},
{id:'universal-core-capabilities',topics:['conocimientos','capacidades','programacion','machine learning','bases de datos','seguridad','devops'],facts:[
'Universal Core dispone de rutas nativas para investigación, razonamiento, ejecución y procesamiento multimodal según la configuración desplegada.',
'El sistema debe distinguir entre capacidad registrada en el runtime y capacidad teórica de un proveedor.',
'Las capacidades de fotos, audio, video y documentos requieren una ruta multimodal compatible; recibir un archivo no demuestra que su contenido haya sido interpretado.'
],sources:['Universal Core runtime capability registry'],requiresLiveVerification:false},
{id:'knowledge-domains',topics:['conocimientos','areas de conocimiento','programacion','bases de datos','ingenieria de datos','machine learning','arquitectura','devops','seguridad','sistemas operativos','matematicas','ciencias de la computacion','gestion de proyectos','idiomas'],facts:[
'Áreas de conocimiento asistido: programación; desarrollo web; bases de datos; ingeniería de datos; IA y machine learning; arquitectura de software; DevOps; seguridad informática defensiva; sistemas operativos; matemáticas y estadística; ciencias de la computación; gestión de proyectos; idiomas.',
'La amplitud temática no garantiza exactitud ni actualidad: los hechos cambiantes deben verificarse.'
],sources:['Universal Core knowledge registry'],requiresLiveVerification:false}
];

export function expandKnowledgeForQuery(query=''){
 const n=norm(query);
 const matched=KNOWLEDGE.filter(x=>x.topics.some(t=>n.includes(norm(t))||norm(t).includes(n))).slice(0,6);
 return {version:KNOWLEDGE_EXPANSION_VERSION,matched:matched.map(x=>({id:x.id,facts:x.facts,sources:x.sources,requiresLiveVerification:x.requiresLiveVerification})),policy:{knowledgeIsVersioned:true,currentClaimsRequireVerification:true,pricingClaimsRequireLiveVerification:true,noUnsupportedModelClaims:true,noInventedCapabilities:true}};
}
export function knowledgeExpansionInstruction(query=''){
 const report=expandKnowledgeForQuery(query);
 if(!report.matched.length)return '';
 return '\n\nBASE DE CONOCIMIENTO EXPANDIDA ('+KNOWLEDGE_EXPANSION_VERSION+'):\n'+JSON.stringify(report)+'\n- Esta base corrige registros obsoletos y evita atribuciones no verificadas.\n- Para precios, modelos actuales, disponibilidad, benchmarks y cargos vigentes, realiza verificación web actual antes de afirmar.\n- No presentes un precio histórico como precio actual.\n- No atribuyas a Universal Core un modelo base, parámetros o modalidad que el runtime no confirme.\n';
}
export function publicKnowledgeExpansion(query=''){return expandKnowledgeForQuery(query);}
