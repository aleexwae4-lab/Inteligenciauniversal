export const CAPABILITY_KERNEL_VERSION='universal-capability-kernel/v36';

const envConfigured=(name)=>Boolean(process.env[name]);

export function dependencyState(){
  return{
    generative_runtime:true,
    orchestration:true,
    evaluation_plane:true,
    web_search:envConfigured('TAVILY_API_KEY'),
    github:envConfigured('GITHUB_TOKEN'),
    memory:envConfigured('SUPABASE_URL')&&envConfigured('SUPABASE_SERVICE_ROLE_KEY'),
    client_voice:true,
    file_ingestion:false,
    file_library:false,
    python_sandbox:false,
    vision_runtime:false,
    image_generation:false,
    image_editing:false,
    realtime_media:false,
    cloud_browser:false,
    computer_use:false,
    plugin_runtime:false,
    connected_apps:false,
    mcp_runtime:false,
    custom_assistants:false,
    marketplace:false,
    code_execution:false,
    office_documents:false,
    spreadsheets:false,
    presentations:false,
    record_runtime:false,
    study_runtime:false,
    widgets:false,
    enterprise_identity:false,
    native_desktop:false,
    native_mobile:false,
  };
}

export const CAPABILITY_DOMAINS=[
  {id:'conversation_reasoning',index:1,name:'Inteligencia conversacional y razonamiento',state:'ready',deps:['generative_runtime'],abilities:['responder preguntas','explicar conceptos','razonamiento lógico y matemático','análisis de problemas','comparar alternativas','planificación','brainstorming','generación de ideas','análisis crítico','extraer conclusiones','clasificar','transformar información','traducir','resumir','corregir ortografía','reescribir','redacción profesional','generar documentos e informes','seguir instrucciones complejas','mantener contexto conversacional']},
  {id:'web_search',index:2,name:'Búsqueda web',state:'conditional',deps:['web_search'],abilities:['buscar información actualizada','consultar noticias','verificar hechos recientes','consultar sitios web','comparar fuentes','investigar empresas, productos, personas y tecnologías','consultar precios','responder con referencias','búsqueda local','recuperar conocimiento externo reciente']},
  {id:'deep_research',index:3,name:'Investigación profunda',state:'partial',deps:['orchestration','web_search'],abilities:['investigación multietapa','comparar evidencia','análisis competitivo','inteligencia de mercado','investigación científica','revisión bibliográfica','due diligence','informes estructurados','detectar contradicciones','citas y enlaces','restricción por dominios','fuentes privadas compatibles']},
  {id:'file_analysis',index:4,name:'Análisis de archivos',state:'planned',deps:['file_ingestion'],abilities:['PDF','Word','TXT','CSV','Excel','presentaciones','imágenes','archivos estructurados','documentos largos','extraer datos','buscar dentro de archivos','comparar documentos','resumir','analizar','transformar contenidos']},
  {id:'file_library',index:5,name:'Biblioteca de archivos',state:'planned',deps:['file_library'],abilities:['guardar archivos generados','guardar archivos subidos','reutilizar archivos','buscar y filtrar archivos','organizar carpetas','biblioteca central','integración con almacenamiento conectado']},
  {id:'advanced_data_analysis',index:6,name:'Análisis avanzado de datos',state:'planned',deps:['python_sandbox'],abilities:['ejecutar Python','limpiar datasets','transformar datos','analizar CSV y Excel','estadística','agregaciones','análisis financiero','detectar patrones','proyecciones','crear tablas','crear gráficas','automatizar análisis']},
  {id:'vision',index:7,name:'Visión artificial',state:'planned',deps:['vision_runtime'],abilities:['interpretar fotografías','analizar capturas de pantalla','leer diagramas','interpretar gráficas','examinar diseños','analizar documentos visuales','identificar objetos','describir escenas','diagnosticar errores visuales','combinar texto e imagen']},
  {id:'image_generation',index:8,name:'Generación de imágenes',state:'planned',deps:['image_generation'],abilities:['crear imágenes desde texto','ilustraciones','conceptos visuales','publicidad','mockups','imágenes de producto','personajes','escenas','infografías','fondos','composiciones creativas']},
  {id:'image_editing',index:9,name:'Edición de imágenes con IA',state:'planned',deps:['image_editing'],abilities:['quitar elementos','agregar objetos','cambiar fondos','cambiar colores','transformar estilos','modificar iluminación','reconstruir regiones','edición por lenguaje natural']},
  {id:'voice',index:10,name:'Voz',state:'partial',deps:['client_voice'],abilities:['respuestas habladas','conversación por voz','síntesis natural','entrada de voz','memoria conversacional compatible','resultados visuales compatibles','múltiples modos de interacción']},
  {id:'camera_screen',index:11,name:'Cámara y pantalla',state:'planned',deps:['realtime_media'],abilities:['compartir cámara','mostrar objetos','compartir pantalla','asistencia contextual sobre pantalla']},
  {id:'memory',index:12,name:'Memoria',state:'conditional',deps:['memory'],abilities:['recordar contexto útil','preferencias','contexto de chats','recuperar memoria','persistir turnos','personalizar respuestas futuras','aislar sesiones']},
  {id:'projects',index:13,name:'Proyectos',state:'partial',deps:['memory'],abilities:['agrupar conversaciones','agrupar contexto','instrucciones por proyecto','archivos por proyecto','investigaciones relacionadas','contexto compartido']},
  {id:'scheduled_tasks',index:14,name:'Tareas programadas',state:'partial',deps:['orchestration'],abilities:['ejecuciones de tareas','recordatorios y recurrencia mediante scheduler futuro','reportes periódicos','monitoreo','alertas condicionales','disparadores por eventos']},
  {id:'work_mode',index:15,name:'Work / ejecución de objetivos',state:'partial',deps:['orchestration'],abilities:['recibir objetivo completo','dividir en pasos','investigar','analizar','trabajar con herramientas','crear entregables','ejecutar flujos multietapa','solicitar aprobación para acciones sensibles']},
  {id:'cloud_browser',index:16,name:'Cloud Browser',state:'planned',deps:['cloud_browser'],abilities:['abrir páginas','navegar sitios','hacer clic','completar formularios','trabajar en varias páginas','usar sesiones autenticadas','descargar información','ejecutar flujos web']},
  {id:'desktop_browser',index:17,name:'Navegador integrado de escritorio',state:'planned',deps:['native_desktop'],abilities:['navegar páginas','múltiples pestañas','iniciar sesión','descargar archivos','trabajo conjunto sobre páginas','usar herramientas de sitios']},
  {id:'computer_use',index:18,name:'Computer Use',state:'planned',deps:['computer_use'],abilities:['ver interfaces','hacer clic','escribir','manejar aplicaciones','ejecutar flujos gráficos de escritorio']},
  {id:'plugins',index:19,name:'Plugins',state:'planned',deps:['plugin_runtime'],abilities:['instrucciones especializadas','skills','aplicaciones','herramientas','plantillas','workflows','integraciones externas']},
  {id:'connected_apps',index:20,name:'Apps conectadas',state:'planned',deps:['connected_apps'],abilities:['buscar información externa','leer datos autorizados','usar datos como contexto','crear información','modificar información','ejecutar acciones autorizadas']},
  {id:'external_actions',index:21,name:'Acciones sobre servicios externos',state:'planned',deps:['connected_apps'],abilities:['leer y buscar correos','preparar respuestas','enviar mensajes','consultar archivos','editar información','crear recursos','consultar repositorios','revisar issues y pull requests','operaciones con aprobación']},
  {id:'mcp_external_tools',index:22,name:'MCP y herramientas externas',state:'planned',deps:['mcp_runtime'],abilities:['integrar fuentes MCP','integrar herramientas MCP','conectar fuentes privadas','conectar fuentes especializadas','descubrimiento de capabilities externas']},
  {id:'custom_assistants',index:23,name:'Asistentes personalizados',state:'planned',deps:['custom_assistants'],abilities:['nombre','instrucciones','personalidad','comportamiento','conocimiento','herramientas','APIs','capacidades específicas','distribución privada o pública']},
  {id:'assistant_marketplace',index:24,name:'Marketplace de asistentes',state:'planned',deps:['marketplace'],abilities:['descubrir asistentes','usar asistentes de terceros','publicar asistentes','crear especialistas por profesión o tarea']},
  {id:'software_engineering',index:25,name:'Ingeniería de software',state:'partial',deps:['github'],abilities:['trabajar con repositorios','analizar código fuente','Git','pull requests','refactorizaciones','migraciones','implementar funcionalidades','debugging','pruebas','revisión de código','Skills de ingeniería']},
  {id:'multiagent_engineering',index:26,name:'Desarrollo multiagente',state:'partial',deps:['orchestration'],abilities:['especialistas en paralelo','investigar componentes','separar submisiones','revisión cruzada','síntesis ejecutiva','trabajo paralelo limitado']},
  {id:'terminal_code_execution',index:27,name:'Terminal y ejecución de código',state:'planned',deps:['code_execution'],abilities:['ejecutar comandos','instalar dependencias','ejecutar tests','compilar','inspeccionar logs','manipular archivos','ejecutar scripts','usar servidores locales','depurar aplicaciones']},
  {id:'document_generation',index:28,name:'Generación de documentos',state:'partial',deps:['generative_runtime'],abilities:['documentos','reportes','propuestas','análisis','tablas','informes ejecutivos','contenido estructurado','exportación desde Workspace']},
  {id:'spreadsheets',index:29,name:'Hojas de cálculo',state:'planned',deps:['spreadsheets'],abilities:['crear hojas','modificar datos','usar fórmulas','hacer cálculos','limpiar información','estructurar tablas','gráficas','análisis financiero y estadístico']},
  {id:'presentations',index:30,name:'Presentaciones',state:'planned',deps:['presentations'],abilities:['estructura de slides','contenido','diseño','gráficas','imágenes','presentaciones terminadas']},
  {id:'writing_blocks',index:31,name:'Bloques de escritura',state:'partial',deps:['generative_runtime'],abilities:['emails','mensajes','publicaciones','documentos','texto reutilizable y editable']},
  {id:'record',index:32,name:'Record / reuniones y notas de voz',state:'planned',deps:['record_runtime'],abilities:['grabar reuniones','grabar notas de voz','transcribir','resumir','convertir en planes','recuperar información']},
  {id:'study_mode',index:33,name:'Modo de estudio',state:'planned',deps:['study_runtime'],abilities:['enseñanza guiada','preguntas interactivas','explicación progresiva','ejercicios','comprobación de conocimientos','preparación de exámenes','aprendizaje paso a paso']},
  {id:'interactive_widgets',index:34,name:'Herramientas interactivas y widgets',state:'planned',deps:['widgets'],abilities:['mapas','resultados visuales','tarjetas','listas','datos estructurados','interfaces especializadas de apps']},
  {id:'personalization',index:35,name:'Personalización',state:'partial',deps:['memory'],abilities:['instrucciones personalizadas','preferencias','memoria','apariencia','contexto persistente','configuración por proyecto']},
  {id:'sharing_collaboration',index:36,name:'Compartir y colaboración',state:'planned',deps:['enterprise_identity'],abilities:['compartir chats','compartir proyectos','compartir asistentes','colaborar en workspaces','permisos']},
  {id:'enterprise',index:37,name:'Funciones Enterprise',state:'planned',deps:['enterprise_identity'],abilities:['administración centralizada','controles de aplicaciones','permisos','gobierno de integraciones','políticas de workspace','SSO','controles de modelos','compliance','gestión de agentes','auditoría']},
  {id:'multiplatform',index:38,name:'Multiplataforma',state:'partial',deps:[],abilities:['web responsive','experiencia móvil web','PWA/base instalable','Android nativo futuro','iOS futuro','macOS futuro','Windows futuro']},
];

const INTENT_RULES=[
  ['web_search',/\b(web|internet|noticias?|actual|reciente|precio|fuentes?|verifica)\b/i],
  ['deep_research',/\b(investigaci[oó]n profunda|deep research|due diligence|mercado|competencia|bibliogr[aá]fica|cient[ií]fica)\b/i],
  ['file_analysis',/\b(pdf|word|docx|archivo|excel|xlsx|csv|presentaci[oó]n|pptx)\b/i],
  ['advanced_data_analysis',/\b(dataset|datos|estad[ií]stica|python|proyecci[oó]n|gr[aá]fica|regresi[oó]n|financiero)\b/i],
  ['vision',/\b(imagen|foto|captura|screenshot|diagrama|gr[aá]fica visual|interfaz)\b/i],
  ['image_generation',/\b(genera|crea|diseña).{0,30}\b(imagen|ilustraci[oó]n|mockup|publicidad|infograf[ií]a)\b/i],
  ['image_editing',/\b(edita|quita|agrega|fondo|color|iluminaci[oó]n).{0,30}\b(imagen|foto)\b/i],
  ['voice',/\b(voz|habla|audio|tts|speech|micr[oó]fono)\b/i],
  ['memory',/\b(memoria|recuerda|recordar|preferencias?|contexto previo)\b/i],
  ['scheduled_tasks',/\b(programa|recordatorio|cada d[ií]a|cada semana|monitorea|alerta|recurrente)\b/i],
  ['cloud_browser',/\b(navegador|browser|formulario|haz clic|inicia sesi[oó]n|p[aá]gina web)\b/i],
  ['connected_apps',/\b(gmail|drive|slack|calendar|app conectada|conector)\b/i],
  ['mcp_external_tools',/\b\bmcp\b|model context protocol/i],
  ['software_engineering',/\b(c[oó]digo|github|repositorio|bug|debug|refactor|api|backend|frontend|deploy|pr\b|pull request)\b/i],
  ['terminal_code_execution',/\b(terminal|comando|npm|pnpm|pip|tests?|compila|logs?|script)\b/i],
  ['document_generation',/\b(documento|informe|reporte|propuesta|contrato|word|pdf)\b/i],
  ['spreadsheets',/\b(hoja de c[aá]lculo|spreadsheet|excel|f[oó]rmula)\b/i],
  ['presentations',/\b(presentaci[oó]n|slides?|powerpoint|pptx)\b/i],
  ['study_mode',/\b(estudia|ens[eé]ñame|examen|quiz|ejercicios?|tutor)\b/i],
  ['conversation_reasoning',/.+/s],
];

function availabilityFor(domain,deps){
  const missing=domain.deps.filter((dep)=>!deps[dep]);
  if(domain.state==='ready')return{status:missing.length?'degraded':'ready',missing};
  if(domain.state==='conditional')return{status:missing.length?'blocked':'ready',missing};
  if(domain.state==='partial')return{status:missing.length?'partial_blocked':'partial',missing};
  return{status:'planned',missing};
}

export function capabilitySnapshot(){
  const deps=dependencyState();
  const domains=CAPABILITY_DOMAINS.map((domain)=>({
    ...domain,
    ...availabilityFor(domain,deps),
    abilityCount:domain.abilities.length,
  }));
  const byStatus=domains.reduce((acc,domain)=>{acc[domain.status]=(acc[domain.status]||0)+1;return acc;},{});
  return{
    version:CAPABILITY_KERNEL_VERSION,
    domainCount:domains.length,
    abilityCount:domains.reduce((sum,domain)=>sum+domain.abilityCount,0),
    byStatus,
    dependencies:deps,
    domains,
  };
}

export function classifyCapabilityIntent(message='',limit=8){
  const text=String(message||'').slice(0,30000);
  const ids=[];
  for(const [id,rule] of INTENT_RULES){
    if(rule.test(text)&&!ids.includes(id))ids.push(id);
    if(ids.length>=limit)break;
  }
  const snapshot=capabilitySnapshot();
  const lookup=new Map(snapshot.domains.map((domain)=>[domain.id,domain]));
  return ids.map((id)=>lookup.get(id)).filter(Boolean).map(({id,index,name,status,missing})=>({id,index,name,status,missing}));
}

export function capabilityPlan(message=''){
  const matched=classifyCapabilityIntent(message);
  const executable=matched.filter((item)=>['ready','partial'].includes(item.status));
  const conditional=matched.filter((item)=>['blocked','partial_blocked','degraded'].includes(item.status));
  const planned=matched.filter((item)=>item.status==='planned');
  return{
    schema:'universal-capability-plan/v1',
    kernel:CAPABILITY_KERNEL_VERSION,
    matched,
    executable,
    conditional,
    planned,
    failClosedOnUnavailableTools:true,
  };
}

export function capabilityDomain(id){
  const snapshot=capabilitySnapshot();
  return snapshot.domains.find((domain)=>domain.id===id||String(domain.index)===String(id))||null;
}
