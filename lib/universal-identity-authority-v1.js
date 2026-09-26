export const UNIVERSAL_IDENTITY_AUTHORITY_VERSION='universal-identity-authority/v1';

const norm=(s='')=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();

export function classifyIdentityAuthority(message=''){
  const q=norm(message);
  if(!q)return{eligible:false,kind:'none',query:q};
  if(/\b(corte de entrenamiento|fecha de corte|hasta cuando sabes|hasta que fecha sabes|conocimiento del modelo|conocimiento de universal core|fecha de conocimiento|datos de entrenamiento|entrenamiento del modelo)\b/.test(q))
    return{eligible:true,kind:'knowledge',query:q};
  if(/\b(tienes internet|tienes acceso a internet|puedes buscar en internet|puedes buscar en la web|acceso web|busqueda en tiempo real|informacion actual|datos actuales)\b/.test(q))
    return{eligible:true,kind:'web',query:q};
  if(/\b(que modelo eres|que modelo usas|que ia eres|que proveedor usas|modelo subyacente)\b/.test(q))
    return{eligible:true,kind:'model',query:q};
  return{eligible:false,kind:'none',query:q};
}

export function identityAuthorityInstruction(snapshot={}){
  return '\n\nAUTORIDAD DE IDENTIDAD UNIVERSAL CORE ('+UNIVERSAL_IDENTITY_AUTHORITY_VERSION+'):\n'+
    '- Universal Core es una capa de inteligencia/orquestación; no debe inventar una fecha única de corte de conocimiento para todos sus proveedores.\n'+
    '- No atribuyas a Universal Core el corte de entrenamiento de un proveedor o modelo salvo que el runtime lo identifique y ese dato esté verificado.\n'+
    '- Para hechos actuales usa investigación web cuando esté disponible; no digas que no existe acceso web si el runtime dispone de la capa de investigación.\n'+
    '- Distingue conocimiento estático del modelo, conocimiento recuperado en tiempo de ejecución y capacidades propias del sistema.\n'+
    '- No afirmes acceso privado, entrenamiento continuo ni modificación de pesos si no existe evidencia de runtime.\n'+
    '- Si no se conoce el modelo/proveedor de una respuesta, dilo explícitamente en vez de inventarlo.\n'+
    '- Estado runtime: '+JSON.stringify(snapshot).slice(0,5000)+'\n';
}

export function buildIdentityAuthorityReply(kind='knowledge',snapshot={}){
  const web=snapshot?.webResearch||{};
  const providers=Array.isArray(snapshot?.providers)?snapshot.providers:[];
  if(kind==='knowledge'){
    const configured=providers.filter(x=>x?.configured).map(x=>x.id).slice(0,8);
    return 'Universal Core no tiene un único "corte de entrenamiento" como el que describe esa respuesta. Su conocimiento proviene de los modelos/proveedores configurados en el runtime y de las capas propias de recuperación, memoria, conocimiento versionado y herramientas. Para información actual, la arquitectura puede recuperar evidencia web cuando esa capacidad está habilitada.\n\nNo sería correcto afirmar "hasta junio de 2024" como fecha universal de Universal Core sin identificar y verificar el modelo que respondió esa consulta. Tampoco sería correcto afirmar que todo su conocimiento está limitado a entrenamiento estático: el sistema puede incorporar información recuperada durante la ejecución.\n\nProveedores configurados detectados en el runtime: '+(configured.join(', ')||'no expuestos en esta ruta')+'. La identidad de Universal Core permanece separada del proveedor subyacente.';
  }
  if(kind==='web'){
    return web.generalSearchConfigured
      ? 'Sí. Universal Core dispone de una capa de investigación web configurada para recuperar información actual. Eso no significa navegación gráfica completa: significa búsqueda y recuperación de fuentes desde el backend. La disponibilidad efectiva se comprueba ejecutando la consulta.'
      : 'Universal Core tiene una capa web implementada, pero el runtime actual no reporta un buscador general configurado. No voy a afirmar que una búsqueda actual funcionó sin resultados verificables.';
  }
  if(kind==='model'){
    const configured=providers.filter(x=>x?.configured).map(x=>x.id).slice(0,8);
    return 'Universal Core es la identidad del sistema, no necesariamente el nombre del modelo base. El proveedor/modelo concreto puede cambiar según la ruta de ejecución. En esta ruta, los proveedores configurados reportados son: '+(configured.join(', ')||'no expuestos')+'. No atribuiré un modelo específico sin evidencia del turno.';
  }
  return 'Universal Core separa identidad, modelo subyacente, conocimiento estático y conocimiento recuperado en tiempo de ejecución. Para afirmar un dato concreto, usa la evidencia que el runtime realmente expone.';
}

export function publicIdentityAuthority(snapshot={}){
  return {version:UNIVERSAL_IDENTITY_AUTHORITY_VERSION,identity:'Universal Core',providerIdentityIsolated:true,staticKnowledgeIsNotUniversalCutoff:true,liveResearchDependsOnRuntime:true};
}
