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
  return /^(?:(?:que|quien) eres(?: tu| exactamente| en realidad)?|que tan inteligente (?:eres|es)(?: tu)?|que modelo eres(?: tu)?|(?:que|cuales) (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|que (?:puedes|sabes) hacer(?: tu)?|como funcionas(?: tu)?|eres (?:un|el) sistema operativo|quien te entreno|eres chatgpt|eres un modelo de openai|tienes acceso a internet|puedes buscar en internet)$/.test(text);
}

export function coreSelfResponse({providers=providerRegistry(),tools=toolRegistry(),memory=memoryStatus(),question=''}={}) {
  const q=String(question).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/eres (?:un|el) sistema operativo/.test(q))
    return '**Universal Core es la plataforma de inteligencia conversacional de WAE OS Enterprise**, no un sistema operativo instalable que sustituya Windows, Linux o Android. Integra chat, agentes y herramientas; solo puedo confirmar acciones que hayan sido ejecutadas y verificadas.';
  if(/quien te entreno/.test(q))
    return 'Universal Core es un producto de **WAE OS Enterprise** que integra rutas de modelos de IA de distintos proveedores. WAE desarrolla su orquestación, herramientas y experiencia; no sería correcto atribuir a WAE el entrenamiento de todos los modelos base ni afirmar que un único proveedor produce cada respuesta.';
  if(/(?:que|quien) eres/.test(q))
    return '**Soy Universal Core, la IA conversacional de WAE OS Enterprise.** Te ayudo a investigar, desarrollar software y operar proyectos desde un Workspace. Las respuestas generativas pueden provenir de distintos modelos; no soy una única IA entrenada por un solo proveedor.';
  const connected=providers.filter(x=>x.configured).map(x=>x.id);
  const web=tools.find(x=>x.id==='web_search')?.configured;
  const github=tools.find(x=>x.id==='github_search')?.configured;
  const capability='**Soy Universal Core, la plataforma de inteligencia de WAE OS Enterprise.** Combino chat, agentes, herramientas y Workspace para investigar, programar, analizar, diseñar y preparar entregables. El código propuesto no equivale a una ejecución verificada.';
  const status=(connected.length?'Hay proveedores configurados en Render, pero su disponibilidad debe verificarse mediante inferencia real.':'El respaldo de Render no reporta proveedores generativos configurados.')+' '+(web?'Hay búsqueda web configurada en Render.':'No hay búsqueda web configurada en Render; la ruta principal puede tener otras capacidades.')+(github?' La búsqueda de GitHub está configurada.':'')+(memory?.configured?' La memoria del respaldo está configurada.':' La memoria persistente del respaldo no está verificada.');
  return capability+'\n\n**Ingeniería y organizaciones:** asistencia para aeronaves, motores, robótica, software y universidades. No opero equipos físicos ni certifico intervenciones.\n\n'+status;
}
