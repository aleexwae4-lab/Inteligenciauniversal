import { capabilitySnapshot } from './capability-kernel.js';

export const GROUNDED_COMPETITION_VERSION='grounded-competition/v120';

const norm=value=>String(value||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[¿?¡!.,;:]+/g,' ')
  .replace(/\s+/g,' ').trim();

const TARGETS=[
  {pattern:/\bgoogle\b/,name:'Google',domain:'web_search',task:'búsqueda e investigación'},
  {pattern:/\bmicrosoft\b/,name:'Microsoft',domain:'document_generation',task:'productividad empresarial'},
  {pattern:/\bcopilot\b/,name:'Copilot',domain:'software_engineering',task:'asistencia de programación'},
  {pattern:/\b(?:chatgpt|gpt(?:[- ]?\d+)?(?:[- ]?astra)?)\b/,name:'GPT',domain:'conversation_reasoning',task:'razonamiento y generación'},
  {pattern:/\bgemini\b/,name:'Gemini',domain:'conversation_reasoning',task:'razonamiento multimodal'},
  {pattern:/\bgithub\b/,name:'GitHub',domain:'software_engineering',task:'trabajo con repositorios'},
  {pattern:/\bvercel\b/,name:'Vercel',domain:'software_engineering',task:'desarrollo y despliegue'},
  {pattern:/\bgrok\b/,name:'Grok',domain:'conversation_reasoning',task:'asistencia e investigación'},
  {pattern:/\bclaude\b/,name:'Claude',domain:'conversation_reasoning',task:'redacción y programación'}
];
const FIRST_PERSON=/\b(?:puedes|podrias|eres capaz|universal core|wae os|waeos)\b/;
const COMPETITION=/\b(?:competir|compite|competencia|compararte|compararse|comparacion|comparar|contra|superar|superas|igualar|rivalizar)\b/;
const CURRENT_OR_BENCHMARK=/\b(?:hoy|actualmente|ultimas?|reciente|investiga|verifica|fuentes|benchmark|resultados?|pruebas? realizadas|estadisticas?|cuota de mercado|que modelo gana|mediciones?)\b/;

export function classifyGroundedCompetitionV120(body={}){
  const raw=String(body.message||body.task||'').slice(0,2000);
  const query=norm(raw);
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  if(!['general','auto'].includes(mode)||body.web_enabled===true||body.deep===true
    ||(Array.isArray(body.attachments)&&body.attachments.length>0)
    ||!FIRST_PERSON.test(query)||!COMPETITION.test(query)||CURRENT_OR_BENCHMARK.test(query))
    return {eligible:false,targets:[]};
  const targets=TARGETS.filter(item=>item.pattern.test(query));
  return {eligible:targets.length>0,targets:targets.map(({name,domain,task})=>({name,domain,task}))};
}

function availability(domainId,snapshot){
  const domain=snapshot.domains.find(d=>d.id===domainId);
  if(!domain)return 'sin diagnóstico de disponibilidad';
  if(domain.status==='ready')return 'disponible';
  if(domain.status==='partial')return 'parcialmente disponible';
  if(domain.status==='blocked'||domain.status==='partial_blocked'||domain.status==='degraded')return 'condicionada por integraciones';
  return 'planificada, no disponible aún';
}

export function buildGroundedCompetitionReplyV120({targets=[],snapshot=capabilitySnapshot()}={}){
  const concrete=targets.slice(0,12);
  const lines=concrete.map(t=>`- **${t.name}:** ${t.task}. Capacidad relevante de Universal Core: **${availability(t.domain,snapshot)}**.`);
  const extra=targets.length>12?'\n- Los demás productos mencionados deben evaluarse por tarea, no como una sola categoría.':'';
  return `**Sí: Universal Core puede competir por trabajos y resultados concretos.** Eso no significa que hoy iguale toda la infraestructura, el catálogo o el rendimiento de cada empresa mencionada. La comparación útil es qué solicitud puede terminar con calidad, evidencia y herramientas realmente operativas.

### Dónde se compara
${lines.join('\n')}${extra}

**Qué haré con tu objetivo:** definir la tarea, ejecutar la capacidad disponible, entregar un resultado reutilizable (respuesta, investigación, código o activo digital) y medir precisión, finalización, latencia y costo. Si una integración todavía no existe o no está conectada, la identificaré sin simular su ejecución.

**Para afirmar superioridad** hacen falta pruebas emparejadas, bajo las mismas condiciones, con resultados verificables; no basta una promesa ni una tabla de marcas.`;
}
