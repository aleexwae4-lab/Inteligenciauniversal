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
  return /^(?:(?:que|quien) eres(?: tu| exactamente| en realidad)?|que tan inteligente (?:eres|es)(?: tu)?|que modelo eres(?: tu)?|(?:que|cuales) (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|que (?:puedes|sabes) hacer(?: tu)?|como funcionas(?: tu)?|eres chatgpt|eres un modelo de openai|tienes acceso a internet|puedes buscar en internet)$/.test(text);
}

export function coreSelfResponse({providers=providerRegistry(),tools=toolRegistry(),memory=memoryStatus()}={}) {
  const connected=providers.filter(x=>x.configured).map(x=>x.id);
  const web=tools.find(x=>x.id==='web_search')?.configured;
  const github=tools.find(x=>x.id==='github_search')?.configured;
  return [
    '**Soy Universal Core, el sistema de IA conversacional de WAE OS Enterprise.** No soy un modelo único y fijo: combino un chat, rutas de IA, herramientas y un Workspace.',
    '**Puedo ayudarte** a explicar e investigar temas, redactar, analizar, diseñar productos y crear o revisar código. La generación de código no significa que haya sido ejecutado o desplegado.',
    '**En esta instalación:** '+(connected.length?'hay configuración para '+connected.join(', ')+', pero eso no demuestra que sus modelos estén disponibles en este momento.':'el servidor de respaldo no reporta proveedores IA configurados.')+' '+(web?'Hay búsqueda web configurada en el servidor de respaldo; los hechos actuales requieren fuentes recuperadas.':'No hay búsqueda web configurada en el servidor de respaldo de Render; la ruta principal de Supabase puede tener capacidades independientes.')+(github?' La búsqueda GitHub está configurada.':'')+(memory?.configured?' El servidor de respaldo tiene memoria configurada.':' La memoria persistente del servidor de respaldo no está verificada.')
  ].join('\\n\\n');
}
