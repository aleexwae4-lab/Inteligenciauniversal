import { providerRegistry } from './providers.js';
import { toolRegistry } from './tools.js';
import { memoryStatus } from './memory.js';
import { industrialCatalog } from './universal-industrial-v115.js';
import { professionalCatalog } from './universal-professional-v116.js';
import { worldCatalog } from './universal-world-intelligence-v117.js';
import { researchCapabilities } from './live-research-v119.js';
import { collaborationCapabilities } from './live-collaboration-v119.js';

export const CORE_CAPABILITY_VERSION='universal-capability-registry/v132';

const normalize=raw=>String(raw??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[¿?¡!.,:]/g,' ').replace(/\s+/g,' ').trim()
  .replace(/^(?:hola|oye|hey|buenas|disculpa|por favor)\s+/,'')
  .replace(/^(?:dime|cuentame|puedes decirme|me puedes decir)\s+/,'');

export function isCoreSelfQuery(raw='') {
  // Keep this deliberately narrow. Comparisons such as "¿eres equivalente a Google?"
  // belong to conversational reasoning, not the identity fast path.
  const text=normalize(raw);
  return /^(?:(?:que|quien) eres(?: tu| exactamente| en realidad)?|que tan inteligente (?:eres|es)(?: tu)?|que modelo eres(?: tu)?|(?:(?:que|cuales) (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|(?:que|cuales) son (?:tus|sus) (?:capacidades|funciones))|que (?:mas |otras cosas )?(?:puedes|sabes) hacer(?: tu)?|que otras (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|como funcionas(?: tu)?|eres (?:un|el) sistema operativo|quien te entreno|eres chatgpt|eres un modelo de openai|tienes acceso a internet|puedes buscar en internet)$/.test(text);
}

function configured(tools,id){return !!tools.find(x=>x?.id===id)?.configured}
function previousAssistant(history=[]){
  return [...(Array.isArray(history)?history:[])].reverse().find(x=>x?.role==='assistant'&&typeof x.text==='string')?.text||'';
}

export function capabilitySnapshot({providers=providerRegistry(),tools=toolRegistry(),memory=memoryStatus()}={}) {
  const industrial=industrialCatalog(),professional=professionalCatalog(),world=worldCatalog();
  const research=researchCapabilities(),collaboration=collaborationCapabilities();
  const web=configured(tools,'waeweb_search')||configured(tools,'web_search')||research.generalWeb?.configured===true;
  const github=configured(tools,'github_search');
  const publicResearch=configured(tools,'public_research')||research.academic?.configured===true||research.encyclopedia?.configured===true;
  return {
    version:CORE_CAPABILITY_VERSION,
    identity:{product:'Universal Core',company:'WAE OS Enterprise',kind:'metasistema operativo de inteligencia y trabajo digital'},
    operational:{
      generativeInference:(providers||[]).some(x=>x?.configured===true),
      webResearch:web,
      publicResearch,
      githubSearch:github,
      persistentMemory:memory?.configured===true,
      voiceInterface:true,
      visualEvidence:true,
      workspace:true,
      canvas:true,
      softwareFactory:true,
      projects:true,
      temporaryCollaboration:collaboration.temporaryRooms===true
    },
    intelligence:{
      agentModes:['general','research','code','analysis','design','executive'],
      industrialDomains:industrial.domains.length,
      industrialSpecialists:industrial.specialistProfileCount,
      professionalDomains:professional.domainCount,
      professionalSpecialists:professional.specialistProfileCount,
      worldDomains:world.domainCount,
      worldSpecialists:world.specialistProfileCount,
      worldMethod:world.phases.map(x=>x.id)
    },
    research:{
      generalWeb:web,
      academic:research.academic?.configured===true,
      recentNews:research.recentNews?.configured===true,
      encyclopedia:research.encyclopedia?.configured===true
    },
    collaboration:{transport:collaboration.transport,persistent:collaboration.persistent===true,ttlHours:collaboration.ttlHours}
  };
}

function internetAnswer(snapshot){
  if(snapshot.operational.webResearch)
    return '**Sí. Universal Core tiene una ruta de investigación web configurada.** Cuando una consulta depende de información actual, puedo recuperar fuentes, contrastarlas y devolver enlaces/citas visibles; la cobertura depende de los índices disponibles en ese turno.';
  if(snapshot.operational.publicResearch)
    return '**Tengo investigación pública y académica, pero no una búsqueda web general verificada en este momento.** Puedo consultar índices de literatura académica, noticias indexadas y referencias enciclopédicas cuando la consulta lo requiera.';
  return '**No hay búsqueda web configurada en este runtime.** Puedo razonar con el contexto disponible, pero no debo presentar información actual como si la hubiera verificado en Internet.';
}

function capabilityAnswer(snapshot){
  const status=snapshot.operational.webResearch?'web con fuentes activa':'fuentes públicas/académicas disponibles';
  const memory=snapshot.operational.persistentMemory?'memoria persistente conectada':'memoria local/proyecto disponible; persistencia remota no verificada';
  const github=snapshot.operational.githubSearch?'GitHub conectado':'GitHub solo cuando exista conexión autorizada';
  return [
    '**Universal Core es el núcleo de inteligencia y trabajo digital de WAE OS Enterprise.** Estas son mis capacidades reales principales:',
    `- **Investigación verificable:** ${status}; búsqueda académica, noticias indexadas y referencias de contexto, con separación entre evidencia e inferencia.`,
    '- **Ingeniería y Fábrica de software:** arquitectura, código, debugging, pruebas, APIs, backend/frontend, Canvas HTML, Workspace y construcción de proyectos digitales.',
    '- **Análisis y datos:** cálculos, tablas, JSON, escenarios, riesgos, métricas, síntesis documental y unit economics con entradas explícitas.',
    '- **Empresa y profesiones:** estrategia, producto, operaciones, finanzas, proyectos, laboratorios, arquitectura/construcción y organización de trabajo legal/profesional.',
    `- **Industria y sistemas:** ${snapshot.intelligence.industrialDomains} dominios de ingeniería/operación y ${snapshot.intelligence.industrialSpecialists} perfiles especializados para software, manufactura, automoción, aeronáutica, robótica, cómputo, chips, infraestructura, universidades, gobierno y más.`,
    `- **Problemas complejos y globales:** ${snapshot.intelligence.worldDomains} dominios con método de definición → línea base → mapa del sistema → opciones → piloto → escala → verificación.`,
    `- **Experiencia de trabajo:** proyectos, ${memory}, evidencia visual, lectura por voz y colaboración temporal en tiempo real. ${github}.`
  ].join('\n\n');
}

function advancedCapabilityAnswer(snapshot,history=[]){
  const prior=previousAssistant(history);
  const continuation=/(capacidades de universal core|estas son mis capacidades|ingenier[ií]a y f[aá]brica|investigaci[oó]n verificable)/i.test(prior);
  return [
    continuation?'**Sí. Además de lo anterior, puedo bajar de “respuesta” a “sistema de trabajo”.**':'**Adelás de responder consultas, Universal Core puede operar como una capa de trabajo estructurada.**',
    '- **Convertir una idea en activo:** especificación → arquitectura → implementación → pruebas → documentación → entrega en Workspace/Canvas/Fábrica.',
    '- **Mantener contexto:** trabajar con historial, proyectos, instrucciones, archivos y memoria disponible para continuar una misión sin empezar desde cero.',
    '- **Orquestar especialidades:** cambiar entre investigación, ingeniería, análisis, diseño y dirección ejecutiva según el objetivo, en vez de responder siempre con el mismo perfil.',
    '- **Trabajar con evidencia:** analizar texto y archivos; cuando la ruta visual está disponible, incorporar imágenes/video como evidencia sin fingir observaciones que no recibió.',
    '- **Modelar organizaciones y operaciones:** procesos, riesgos, KPIs, finanzas, productos, planes de ejecución, continuidad y decisiones C-level.',
    `- **Aplicar inteligencia sectorial:** ${snapshot.intelligence.professionalDomains} dominios profesionales, ${snapshot.intelligence.industrialDomains} industriales y ${snapshot.intelligence.worldDomains} de problemas globales, cada uno con métodos y restricciones propios.`,
    '- **Producir entregables accionables:** código, planes, matrices, cronologías, documentos, modelos operativos, análisis de riesgos y artefactos editables.',
    '**La diferencia importante:** no me limito a “saber cosas”; el objetivo de Universal Core es convertir conocimiento y contexto en trabajo utilizable y verificable.'
  ].join('\n\n');
}

function architectureAnswer(snapshot){
  const parts=[
    '**Universal Core funciona como un orquestador de inteligencia de WAE OS Enterprise.**',
    '1. Interpreta la intención y selecciona el modo/agente adecuado.',
    '2. Recupera contexto de conversación, proyecto y memoria disponible.',
    '3. Activa herramientas o investigación solo cuando la tarea lo requiere.',
    '4. Enruta la generación por proveedores configurados con fallback y filtros de calidad.',
    '5. Convierte la salida en un paquete de respuesta con texto, fuentes, voz, acciones y metadata operativa.',
    '6. Lleva el resultado a Workspace/Canvas/Fábrica para continuar el trabajo.'
  ];
  if(!snapshot.operational.generativeInference)parts.push('**Estado:** no hay una ruta generativa verificada en este proceso; el sistema debe degradar de forma explícita, no fingir una respuesta.');
  return parts.join('\n\n');
}

export function coreSelfResponse({providers=providerRegistry(),tools=toolRegistry(),memory=memoryStatus(),question='',history=[]}={}) {
  const q=normalize(question),snapshot=capabilitySnapshot({providers,tools,memory});
  if(/eres (?:un|el) sistema operativo/.test(q))
    return '**Universal Core es un metasistema operativo de inteligencia y trabajo digital de WAE OS Enterprise**, no un sistema operativo instalable que sustituya Windows, Linux o Android. Orquesta conversación, agentes, herramientas, memoria y espacios de trabajo para ejecutar procesos digitales.';
  if(/quien te entreno/.test(q))
    return '**Universal Core es la inteligencia de WAE OS Enterprise.** WAE Production desarrolla, personaliza y evalúa este sistema. Eso no demuestra, por sí solo, que WAE haya entrenado desde cero un modelo fundacional; cualquier afirmación sobre entrenamiento debe apoyarse en registros verificables.';
  if(/(?:que|quien) eres/.test(q))
    return '**Soy Universal Core, el núcleo de inteligencia y orquestación de WAE OS Enterprise.** Investigo, desarrollo software, analizo, coordino agentes y convierto respuestas en trabajo dentro de Workspace, Canvas y Fábrica. Soy la capa operativa de IA de WAE OS, no un sustituto de Windows o Android.';
  if(/tienes acceso a internet|puedes buscar en internet/.test(q))return internetAnswer(snapshot);
  if(/como funcionas/.test(q))return architectureAnswer(snapshot);
  if(/que modelo eres|eres chatgpt|eres un modelo de openai/.test(q))
    return '**Soy Universal Core, el producto de inteligencia de WAE OS Enterprise.** Mi identidad de producto no equivale al proveedor de inferencia subyacente: el runtime puede usar rutas externas configuradas y esa procedencia solo debe afirmarse cuando exista metadata verificable del turno.';
  if(/que tan inteligente/.test(q))
    return '**Mi capacidad se mide mejor por lo que puedo resolver y verificar que por una puntuación humana.** Puedo combinar investigación, ingeniería, análisis, diseño, operación empresarial, herramientas y memoria disponible; mis límites reales dependen de las fuentes, integraciones y permisos activos en cada tarea.';
  if(/que (?:mas |otras cosas )?(?:puedes|sabes) hacer|que otras (?:capacidades|funciones)/.test(q))
    return advancedCapabilityAnswer(snapshot,history);
  if(/capacidades|funciones|que puedes hacer/.test(q))return capabilityAnswer(snapshot);

  const web=snapshot.operational.webResearch;
  const github=snapshot.operational.githubSearch;
  const mem=snapshot.operational.persistentMemory;
  return '**Soy Universal Core, la plataforma de inteligencia de WAE OS Enterprise.** Integro investigación, ingeniería, análisis, agentes y Workspace para convertir consultas en entregables y proyectos.\n\n'
    +'**Ingeniería y organizaciones:** puedo asistir en software, manufactura, robótica, cómputo, aeronaves, sistemas e instituciones. No opero equipos físicos ni certifico intervenciones no verificadas.\n\n'
    +'**Proyectos y economía:** puedo estructurar proyectos, empresas, finanzas y escenarios con datos explícitos. No garantizo ganancias ni resultados futuros.\n\n'
    +'**Retos mundiales con evidencia:** puedo estructurar problemas complejos mediante línea base, mapa del sistema, opciones, piloto, escala y verificación, sin fingir intervención material.\n\n'
    +(web?'Hay búsqueda web configurada en Render.':'No hay búsqueda web configurada en Render; puedo usar fuentes públicas/académicas cuando corresponda.')
    +(github?' GitHub está conectado para búsquedas autorizadas.':' GitHub requiere una conexión autorizada para búsqueda de código.')
    +(mem?' La memoria persistente está configurada.':' La memoria persistente del respaldo no está verificada.');
}
