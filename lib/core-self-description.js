import { providerRegistry } from './providers.js';
import { toolRegistry } from './tools.js';
import { memoryStatus } from './memory.js';

export function isCoreSelfQuery(raw='') {
  // Only narrowly phrased identity/capability questions are answered from the
  // registry. "¿Crees que eres equivalente a Google?" is a COMPARISON, not an
  // introspection request; route it to the conversational model.
  const text=String(raw).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()
    .replace(/[¿?¡!.,:]/g,' ').replace(/\\s+/g,' ').trim()
    .replace(/^(?:hola|oye|hey|buenas|disculpa|por favor)\\s+/,'')
    .replace(/^(?:dime|cuentame|puedes decirme|me puedes decir)\\s+/,'');
  return /^(?:(?:que|quien) eres(?: tu| exactamente| en realidad)?|que tan inteligente (?:eres|es)(?: tu)?|que modelo eres(?: tu)?|(?:que|cuales) (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|que (?:puedes|sabes) hacer(?: tu)?|como funcionas(?: tu)?|eres chatgpt|eres un modelo de openai|tienes acceso a internet|puedes buscar en internet)$/.test(text);
}

export function coreSelfResponse({providers=providerRegistry(),tools=toolRegistry(),memory=memoryStatus()}={}) {
  const connected=providers.filter(x=>x.configured).map(x=>x.id);
  const web=tools.find(x=>x.id==='web_search')?.configured;
  const github=tools.find(x=>x.id==='github_search')?.configured;
  return [
    '**Soy Universal Core, el asistente de WAE OS Enterprise.** No soy un único modelo con un coeficiente intelectual medible: este producto combina chat, un runtime de IA, herramientas y un Workspace.',
    '**Qué puedo ayudarte a hacer aquí:** investigar y explicar temas, redactar documentos, analizar problemas, diseñar productos y proponer o revisar código. Puedo organizar una respuesta en el Workspace y ofrecer copia, lectura por voz y dictado cuando tu navegador lo admita. Generar código no equivale a ejecutarlo o desplegarlo.',
    '**Conexiones de esta instalación:** '+(connected.length?'se detecta configuración para '+connected.join(', ')+'. Eso no garantiza que cada proveedor esté respondiendo ahora.':'el servidor no informa proveedores de IA configurados; la ruta web de Supabase puede funcionar por separado.'),
    '**Información reciente:** '+(web?'hay una búsqueda web configurada, pero solo afirmaré hechos actuales cuando se recupere evidencia real.':'no hay búsqueda web del servidor configurada; no afirmaré datos en tiempo real sin una consulta verificable.')+(github?' Hay integración de búsqueda en GitHub configurada.':' La búsqueda de código en GitHub no figura configurada en el servidor.')+(memory?.configured?' El almacenamiento de memoria está configurado.':' No puedo confirmar memoria persistente desde este servidor.'),
    '**Cómo comprobar la calidad:** dame una tarea concreta y evaluaré el resultado. No afirmaré tener acceso ilimitado, conocer una fecha de corte exacta, ser un modelo específico ni haber realizado una acción externa sin evidencia.'
  ].join('\n\n');
}
