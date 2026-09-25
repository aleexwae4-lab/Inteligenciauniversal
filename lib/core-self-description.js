import { providerRegistry } from './providers.js';
import { toolRegistry } from './tools.js';
import { memoryStatus } from './memory.js';

export function isCoreSelfQuery(raw='') {
  // Only narrowly phrased identity/capability questions are answered from the
  // registry. "¿Crees que eres equivalente a Google?" is a COMPARISON, not an
  // introspection request; route it to the conversational model.
  const text=String(raw).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[¿?¡!.,:]/g,' ').replace(/\s+/g,' ').trim()
    .replace(/^(?:hola|oye|hey|buenas|disculpa|por favor)\s+/,'')
    .replace(/^(?:dime|cuentame|puedes decirme|me puedes decir)\s+/,'');
  return /^(?:(?:que|quien) eres(?: tu| exactamente| en realidad)?|que tan inteligente (?:eres|es)(?: tu)?|que modelo eres(?: tu)?|(?:que|cuales) (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|que (?:mas |otras cosas )?(?:puedes|sabes) hacer(?: tu)?|que otras (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|como funcionas(?: tu)?|eres (?:un|el) sistema operativo|quien te entreno|eres chatgpt|eres un modelo de openai|tienes acceso a internet|puedes buscar en internet)$/.test(text);
}

export function coreSelfResponse({providers=providerRegistry(),tools=toolRegistry(),memory=memoryStatus(),question=''}={}) {
  const q=String(question).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/eres (?:un|el) sistema operativo/.test(q))
    return '**Universal Core es la plataforma de inteligencia conversacional de WAE OS Enterprise**, no un sistema operativo instalable que sustituya Windows, Linux o Android. Integra chat, agentes y herramientas; solo puedo confirmar acciones que hayan sido ejecutadas y verificadas.';
  if(/quien te entreno/.test(q))
    return '**Universal Core es la inteligencia de WAE OS Enterprise.** WAE Production desarrolla, personaliza y evalúa este sistema. Eso no demuestra, por sí solo, que WAE haya entrenado desde cero un modelo fundacional; los detalles técnicos de entrenamiento deben basarse en registros verificables.';
  if(/(?:que|quien) eres/.test(q))
    return '**Soy Universal Core, la inteligencia de WAE OS Enterprise.** Te ayudo a investigar, desarrollar software y operar proyectos desde tu Workspace.';

  if(/(?:que (?:mas |otras cosas )?(?:puedes|sabes) hacer|que otras (?:capacidades|funciones)|capacidades|funciones)/.test(q))
    return [
      '**Puedo trabajar como núcleo de investigación, ingeniería y operación de WAE OS Enterprise.**',
      '**Software y producto:** analizar código, diseñar arquitectura, depurar, preparar cambios, pruebas y proyectos para Canvas/Fábrica/Workspace.',
      '**Investigación y documentos:** resumir, comparar y estructurar información; cuando una respuesta depende de actualidad, debo verificar fuentes disponibles.',
      '**Empresa y estrategia:** modelar operaciones, producto, finanzas, riesgos, procesos, métricas y planes de ejecución.',
      '**Legal y profesional:** organizar expedientes, cronologías, matrices de evidencia y borradores; para leyes o jurisprudencia vigentes necesito jurisdicción y fuentes actuales.',
      '**Industria y sistemas:** apoyar análisis de ingeniería, manufactura, robótica, cómputo y organizaciones, sin fingir ejecución física o certificaciones.',
      'Puedo diseñar automatizaciones e integraciones, pero solo debo afirmar que ejecuté una acción externa cuando exista evidencia real de esa herramienta.'
    ].join('\n\n');

  const web=tools.find(x=>x.id==='web_search')?.configured;
  const github=tools.find(x=>x.id==='github_search')?.configured;
  const capability='**Soy Universal Core, la plataforma de inteligencia de WAE OS Enterprise.** Combino chat, agentes, herramientas y Workspace para investigar, programar, analizar, diseñar, abordar retos mundiales con evidencia y preparar entregables. El código propuesto no equivale a una ejecución verificada.';
  const status=(web?'Hay búsqueda web configurada en Render.':'No hay búsqueda web configurada en Render; otras rutas pueden ofrecerla.')+(github?' La búsqueda de GitHub está configurada.':'')+(memory?.configured?' La memoria del respaldo está configurada.':' La memoria persistente del respaldo no está verificada.');
  return capability+'\n\n**Ingeniería y organizaciones:** asistencia para aeronaves, motores, robótica, software y universidades. No opero equipos físicos ni certifico intervenciones.\n\n**Proyectos y economía:** apoyo a empresas, finanzas, laboratorios y otros proyectos. No garantizo ganancias.\n\n'+status;
}
