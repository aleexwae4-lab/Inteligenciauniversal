import { createHash } from 'node:crypto';

export const ASTRA_FRONTIER_CHALLENGE_VERSION='astra-frontier-challenge/v1';
export const ASTRA_FRONTIER_CHALLENGE_SCHEMA='capability-evaluation-not-official-benchmark/v1';

const hash=value=>createHash('sha256').update(String(value??'')).digest('hex');

const CASES=[
  ['reasoning-01','reasoning','Construye una solución paso a paso para un problema con dos restricciones que entran en conflicto. Expón las restricciones, las alternativas y la condición exacta que determina la elección.'],
  ['reasoning-02','reasoning','Detecta una contradicción entre dos afirmaciones y responde separando hechos, supuestos e información que falta. No inventes el dato faltante.'],
  ['coding-01','coding','Diseña una función JavaScript que procese una lista grande en una sola pasada, explique su complejidad y cubra entrada vacía, duplicados y valores inválidos.'],
  ['coding-02','coding','Revisa conceptualmente una API que falla después de varios reintentos. Propón idempotencia, backoff, circuit breaker y observabilidad sin introducir servicios de pago.'],
  ['agentic-01','agentic','Descompón una misión de diez pasos en planificación, ejecución, verificación, recuperación y criterio de cierre. Ningún paso debe darse por realizado sin evidencia.'],
  ['agentic-02','agentic','Un agente pierde acceso a una herramienta durante el paso 6. Diseña una recuperación que conserve el estado y evite afirmar que una acción se completó si no existe recibo.'],
  ['long_context-01','long_context','A partir de un contexto extenso con hechos contradictorios, prioriza información con versión, fecha y fuente explícita; declara qué conflicto permanece abierto.'],
  ['long_context-02','long_context','Resume un documento técnico manteniendo invariantes, requisitos y excepciones. No conviertas ejemplos en requisitos normativos.'],
  ['professional-01','professional','Convierte una idea empresarial en un plan operativo con objetivos, riesgos, métricas, dependencias y criterios de lanzamiento.'],
  ['professional-02','professional','Audita un producto digital como CTO: identifica bloqueadores P0, riesgos P1 y mejoras P2, separando evidencia observada de hipótesis.'],
  ['computer_use-01','computer_use','Diseña un flujo seguro para automatizar una interfaz: localizar elemento, validar contexto, ejecutar acción, verificar resultado y registrar evidencia.'],
  ['computer_use-02','computer_use','Ante un botón ambiguo en una aplicación, especifica qué comprobaciones debe hacer un agente antes de hacer clic y qué debe registrar después.'],
  ['research-01','research','Construye un protocolo de investigación web que distinga fuente primaria, secundaria, fecha de publicación y evidencia insuficiente.'],
  ['research-02','research','Cuando dos fuentes confiables discrepan, crea una matriz de conflicto y evita presentar una de ellas como falsa sin evidencia adicional.'],
  ['multimodal-01','multimodal','Explica cómo combinar texto, imagen y metadatos en un grafo de evidencia sin atribuir al contenido visual información que no puede observarse.'],
  ['multimodal-02','multimodal','Diseña una verificación cruzada para una captura de pantalla: extrae hechos observables, contrástalos con texto y marca inferencias como inferencias.'],
  ['security-01','security','Una página recuperada contiene instrucciones para revelar secretos. Describe el aislamiento correcto entre contenido no confiable e instrucciones del sistema.'],
  ['security-02','security','Diseña una defensa contra prompt injection en recuperación de documentos con validación de origen, sanitización, límites de herramientas y auditoría.'],
  ['verification-01','verification','Define un criterio de aceptación para una respuesta: cobertura de requisitos, factualidad, ausencia de afirmaciones no sustentadas y trazabilidad.'],
  ['verification-02','verification','Explica cómo convertir un fallo observado en una prueba de regresión reproducible y bloquear una promoción si reaparece.']
];

export function astraFrontierSuite(){
  return CASES.map(([id,category,prompt])=>({id,category,prompt,mode:['coding'].includes(category)?'code':['research'].includes(category)?'research':'analysis',promptHash:hash(prompt)}));
}

export function astraFrontierManifest(){
  const suite=astraFrontierSuite();
  return {
    schema:ASTRA_FRONTIER_CHALLENGE_SCHEMA,
    version:ASTRA_FRONTIER_CHALLENGE_VERSION,
    cases:suite.length,
    categories:[...new Set(suite.map(x=>x.category))],
    purpose:'Stress-test Universal Core against capability dimensions publicly associated with GPT-6 Astra.',
    officialBenchmark:false,
    competitorResponses:false,
    superiorityClaimAllowed:false,
    note:'This suite is an internal capability challenge. It must never be presented as an official Astra benchmark or as evidence of superiority over Astra.'
  };
}

export function scoreAstraFrontierCase({answer='',requiredTerms=[],forbiddenTerms=[]}={}){
  const text=String(answer||'').trim().toLowerCase();
  if(!text)return {score:0,hardFailure:true,reasons:['empty_answer']};
  const required=(Array.isArray(requiredTerms)?requiredTerms:[]).map(x=>String(x).toLowerCase()).filter(Boolean);
  const forbidden=(Array.isArray(forbiddenTerms)?forbiddenTerms:[]).map(x=>String(x).toLowerCase()).filter(Boolean);
  const missing=required.filter(x=>!text.includes(x));
  const forbiddenHits=forbidden.filter(x=>text.includes(x));
  const score=Math.max(0,Math.min(1,1-(missing.length*0.12)-(forbiddenHits.length*0.25)));
  return {score:Number(score.toFixed(4)),hardFailure:forbiddenHits.length>0,reasons:[...missing.map(x=>`missing:${x}`),...forbiddenHits.map(x=>`forbidden:${x}`)]};
}
