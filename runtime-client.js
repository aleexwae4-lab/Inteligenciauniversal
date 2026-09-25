(()=>{
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const VISUAL_EDGE=`${SUPABASE_URL}/functions/v1/wae-ai-stream`;
  const nativeFetch=window.fetch.bind(window);
  const responsePolicy='IDENTIDAD WAE: eres Universal Core, la inteligencia de WAE OS Enterprise. En respuestas normales no enumeres proveedores ni modelos técnicos ni te identifiques como otra marca. Si preguntan directamente por procedencia, entrenamiento o privacidad, responde con hechos verificables sin atribuir a WAE entrenamiento fundacional desde cero no demostrado. CALIDAD UNIVERSAL CORE: Responde primero al fondo de la pregunta; no conviertas la falta de resultados de búsqueda en una respuesta sobre evidencia ausente ni enumeres fuentes ajenas al tema. Para cifras empresariales actuales, diferencia empleados totales de ingenieros y no inventes números si el desglose no se ha confirmado. Las búsquedas no pertinentes y los errores de herramientas nunca prueban que un dato no exista. Responde primero a lo pedido, con criterio y especificidad. Distingue hechos, inferencias y límites. Si la pregunta exige actualidad, fundamenta lo que afirmas solo en fuentes recuperadas y pertinentes. No agregues fuentes tangenciales ni un listado de enlaces por defecto; si una cifra exacta no está confirmada, di solamente qué parte no puedes confirmar y aporta contexto útil. Para código, entrega cambios reproducibles, pruebas pertinentes y riesgos, sin afirmar ejecuciones que no hiciste. Usa Markdown, tablas o ejemplos únicamente cuando mejoren la explicación. Mantén un tono natural, sin relleno ni texto interno. Si comparan Universal Core con Google, un buscador, Gemini u otro sistema, contesta directamente en una o dos frases qué es semejante y qué es distinto. No transformes una pregunta comparativa en una autopresentación larga o lista de proveedores y limitaciones, salvo que esa información sea esencial para la respuesta. Contrato visual opcional WAE: si realmente mejora la respuesta puedes incluir un bloque de código ```wae-card con JSON válido {"title":"Título","description":"Resumen","badge":"Estado","metrics":[{"label":"Indicador","value":"—"}],"actions":[{"type":"workspace","label":"Abrir Workspace"}]}; o un bloque ```wae-chart con JSON válido {"title":"Título","data":[{"label":"Categoría","value":10}],"basis":"demo"}. Cierra ambos con tres acentos graves. No uses estos bloques por defecto ni si bastan párrafos, listas o tablas. Usa basis=user solo si todos los números los dio el usuario; si no hay cifras reales, evita gráficos o etiqueta basis=demo con claridad. No inventes acciones, resultados, enlaces, valores reales ni pruebas ejecutadas. Las acciones disponibles son copy, workspace o ask y deben ser relevantes.';
  function needsFreshWeb(message, mode){
    const q=String(message||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/\b(sin internet|sin buscar en internet|no busques en la web|no uses la web)\b/.test(q))return false;
    if(mode==='research')return true;
    if(/\b(?:cuant[oa]s?|numero|cantidad|plantilla|headcount)\b/.test(q)&&/\b(?:ingenier\w*|emplead\w*|trabajador\w*|plantilla|personas|personal|engineers|employees)\b/.test(q)&&/\b(?:tiene|tienen|trabajan|contrata|hay|cuenta|emplea|at|en|para|de)\b/.test(q))return true;
    return /\b(hoy|ahora|actualizad[oa]s?|reciente[s]?|ultim[oa]s?|noticias|tiempo real|en vivo|vigente[s]?|cotizacion|tipo de cambio|precio[s]? actual(?:es)?|verifica|verificar|comprueba|busca en internet|busca en la web|investiga en la web|fuentes actuales|con fuentes|cita fuentes|jurisprudencia vigente|reforma legal|normativa vigente)\b/.test(q);
  }
  const wantsSources=question=>/\b(fuentes?|referencias?|bibliografia|cit[ae]s?|enlaces?|links?|sources?|references?)\b/i.test(String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
  const commonTerms=new Set('que como cual cuales donde cuando porque para sobre entre desde hasta acerca tema libro libros autor autores quiero dame dime conoces sabes explicame tienes con sin los las unas unos una uno del por fue son esta este estos estas ese esa esos esas mas muy todo toda todos todas fuente fuentes referencias bibliografia cita citas enlace enlaces link links actual actualidad informacion original pagina paginas sitio sitios oficial confiable verificada'.split(' '));
  function topicTerms(value){
    const normalized=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b4\b/g,'cuatro');
    return new Set((normalized.match(/[a-z0-9]{4,}/g)||[]).filter(t=>!commonTerms.has(t)));
  }
  function withRetrievedSources(reply,sources,question){
    const answer=String(reply||'').trim();
    if(!answer||!Array.isArray(sources)||!wantsSources(question))return answer;
    const queryTerms=topicTerms(question);if(!queryTerms.size)return answer;
    const seen=new Set(),lines=[];
    for(const item of sources){
      if(!item||typeof item!=='object'||typeof item.url!=='string'||!item.title)continue;
      let url;try{url=new URL(item.url);if(!['https:','http:'].includes(url.protocol)||!url.hostname||/[<>"\s]/.test(item.url))continue}catch{continue}
      if(seen.has(url.href)||answer.includes(url.href))continue;
      const title=String(item.title).replace(/[\r\n\[\]()]/g,' ').replace(/\s+/g,' ').slice(0,130).trim();
      const overlaps=[...topicTerms(title+' '+url.pathname)].filter(t=>queryTerms.has(t));
      if(overlaps.length<Math.min(2,queryTerms.size)||(queryTerms.size===1&&overlaps[0].length<6))continue;
      seen.add(url.href);lines.push('- ['+title+']('+url.href+')');if(lines.length>=3)break;
    }
    return lines.length?answer+'\n\n### Fuentes relacionadas\n'+lines.join('\n'):answer;
  }
  const SESSION_ID='iu.sessionId',SESSION_SECRET='iu.sessionSecret',CONVERSATION_ID='iu.conversationId';
  if(!localStorage.getItem('wae.endpoint')||localStorage.getItem('wae.endpoint')==='/api/chat')localStorage.setItem('wae.endpoint','/api/chat');
  window.__waeRuntimeAttachments=[];

  // A single outbound request must honor the parent /api/chat cancellation.
  // Previously only the inner 32s timer was used: the visible 65s chat deadline
  // could expire while the intercepted request kept running and later fell back.
  const linkedAbort=(outer,ms)=>{
    const controller=new AbortController();
    const onAbort=()=>controller.abort();
    if(outer?.aborted)controller.abort();
    else outer?.addEventListener?.('abort',onAbort,{once:true});
    const timer=setTimeout(onAbort,ms);
    return {signal:controller.signal,cleanup:()=>{clearTimeout(timer);outer?.removeEventListener?.('abort',onAbort)}};
  };
  const edge=async(payload,outerSignal=null,ms=32000)=>{
    const linked=linkedAbort(outerSignal,ms);
    try{
      const res=await nativeFetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-inteligencia-universal/1.2'},body:JSON.stringify(payload),cache:'no-store',signal:linked.signal});
      const data=await res.json().catch(()=>({success:false,error:`HTTP ${res.status}`}));
      if(!res.ok||(data?.error&&!data?.reply))throw Object.assign(new Error(String(data.error||`HTTP ${res.status}`).slice(0,180)),{status:res.status,data});
      return data;
    }finally{linked.cleanup()}
  };

  let bootPromise;
  const sessionPayload=()=>({session_id:localStorage.getItem(SESSION_ID)||'',session_secret:localStorage.getItem(SESSION_SECRET)||''});
  // Don't repeat a cold cross-origin bootstrap for a session already saved by
  // this browser. A real authentication rejection triggers one safe renewal.
  const bootstrap=signal=>{
    const saved=sessionPayload();
    if(saved.session_id&&saved.session_secret)return Promise.resolve(saved);
    return bootPromise||(bootPromise=edge({action:'bootstrap',...saved},signal,7000).then(data=>{
      if(!data?.session_id||!data?.session_secret)throw new Error('invalid_bootstrap');
      localStorage.setItem(SESSION_ID,data.session_id);localStorage.setItem(SESSION_SECRET,data.session_secret);return data;
    }).catch(err=>{bootPromise=null;throw err}));
  };
  const refreshBootstrap=signal=>{
    bootPromise=null;
    localStorage.removeItem(SESSION_ID);
    localStorage.removeItem(SESSION_SECRET);
    localStorage.removeItem(CONVERSATION_ID);
    return bootstrap(signal);
  };
  // Reuse the IU custom session; never copy the other WAE OS product's org token or Gemini key.
  // Multimodal photo / video requests stay first-party. Render proxies to the
  // same IU-authenticated WAE function, so Android avoids a large cross-origin POST.
  async function ensureVisualSession(force=false){
    // Do not force a cross-origin bootstrap just to send a photograph.
    if(!force&&localStorage.getItem(SESSION_ID)&&localStorage.getItem(SESSION_SECRET))return;
    let recovery;
    try{
      recovery=await nativeFetch('/api/vision',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'bootstrap',...sessionPayload()}),cache:'no-store',
        signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(20000):undefined
      });
    }catch(_){
      throw Object.assign(Error('No se pudo conectar para iniciar una sesión visual. Verifica tu conexión.'),{code:'visual_bootstrap_transport'});
    }
    const session=await recovery.json().catch(()=>({}));
    if(!recovery.ok||!session.session_id||!session.session_secret)
      throw Object.assign(Error(session.message||'No fue posible iniciar la sesión visual. Tu captura se conserva.'),{code:session.error||'visual_bootstrap_failed',status:recovery.status});
    localStorage.setItem(SESSION_ID,session.session_id);localStorage.setItem(SESSION_SECRET,session.session_secret);
    bootPromise=Promise.resolve(session);
  }
  async function visualRequest({question,kind,frames,mode}){
    let response;
    try{
      response=await nativeFetch('/api/vision',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({...sessionPayload(),question,kind,frames,mode}),cache:'no-store',
        signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(65000):undefined
      });
    }catch(error){
      const aborted=error?.name==='AbortError'||error?.name==='TimeoutError';
      throw Object.assign(Error(aborted?'Se agotó el tiempo de análisis. Conservamos la captura para reintentar.':'La conexión con Universal Core se interrumpió antes del análisis. Conservamos la captura para reintentar.'),{code:aborted?'visual_timeout':'visual_transport'});
    }
    const body=await response.json().catch(()=>({}));
    if(!response.ok||typeof body.reply!=='string'||!body.reply.trim())
      throw Object.assign(Error(body.message||'El motor visual no devolvió una respuesta. Tu captura continúa preparada.'),{code:body.error||'vision_unavailable',status:response.status});
    return body;
  }
  window.WAEVisualRuntime=Object.freeze({
    analyze:async payload=>{
      try{return await visualRequest(payload)}
      catch(error){
        // An authentication rejection happens before any provider call. It is
        // safe to renew once; never repeat a costly/in-flight model inference.
        if(error?.code!=='iu_invalid_session'&&error?.code!=='iu_session_required')throw error;
        await ensureVisualSession(true);
        return visualRequest(payload);
      }
    },
    transport:'render_native_or_guarded_gateway'
  });

  function isLocalRuntime(input){
    try{const raw=typeof input==='string'?input:input?.url;const url=new URL(raw,location.href);return url.origin===location.origin&&url.pathname==='/api/chat'}catch{return false}
  }

  // Mirror lib/core-self-description.js. Broad substring matching caused
  // "Se podría decir que eres equivalente a Google?" to bypass the AI.
  const selfQuery=value=>{
    const question=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[¿?¡!.,:]/g,' ').replace(/\s+/g,' ').trim()
      .replace(/^(?:hola|oye|hey|buenas|disculpa|por favor)\s+/,'')
      .replace(/^(?:dime|cuentame|puedes decirme|me puedes decir)\s+/,'');
    return /^(?:(?:que|quien) eres(?: tu| exactamente| en realidad)?|que tan inteligente (?:eres|es)(?: tu)?|que modelo eres(?: tu)?|(?:que|cuales) (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|que (?:mas |otras cosas )?(?:puedes|sabes) hacer(?: tu)?|que otras (?:capacidades|funciones) (?:tienes|tiene)(?: tu)?|como funcionas(?: tu)?|eres (?:un|el) sistema operativo|quien te entreno|eres chatgpt|eres un modelo de openai|tienes acceso a internet|puedes buscar en internet)$/.test(question);
  };
  // Relevant product context, not a canned answer. Do not confuse this
  // application with ChatGPT, Google Search, Gemini or Google as a company.
  const coreComparison=value=>{
    const q=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    return q.length>=12&&q.length<=650&&
      /\b(google|gemini|chatgpt|gpt|claude|copilot|grok|buscador(?:es)?|motor(?:es)? de busqueda|asistente(?:s)? de ia)\b/.test(q)&&
      /\b(universal core|wae os|waeos|eres|serias|puedes|podrias|tu sistema|este sistema|esta plataforma|tu inteligencia)\b/.test(q)&&
      /\b(equivalent[ea]|igual(?:es)?|compara(?:r|cion)?|comparad[oa]|diferente[s]?|distint[oa]s?|mejor|peor|versus|vs|como|parecid[oa]s?|simil(?:ar|ares)|compet(?:ir|encia)|alternativa|sustitu(?:ir|ye)|supera|mismo nivel)\b/.test(q);
  };
  // Mirror the server-side, short Google capability reply: do not route this
  // particular video repro through two remote model attempts.
  const quickGoogleComparison=value=>{
    const q=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,:]/g,' ').replace(/\s+/g,' ').trim();
    return q.length<=105 && /^(?:(?:hola|oye|dime|me dices|una pregunta|por favor) )*(?:(?:tu|universal core|wae os) )?(?:(?:puedes|podrias|puede|podria|podemos) )?(?:competir|compites|compite|competencia) (?:contra|con|vs|versus) google(?: (?:search|gemini))?$/.test(q);
  };
  const comparisonBrief='CONTEXTO DE IDENTIDAD, NO RESPUESTA PREFABRICADA: La persona conversa con Universal Core, producto WAE OS Enterprise; NO está conversando con ChatGPT como producto. Universal Core combina chat, rutas de IA, Workspace, Canvas y Fábrica. Google puede significar Search, Gemini o la empresa/ecosistema: distingue solo los sentidos pertinentes. No atribuyas a Universal Core el índice web, la infraestructura, el entrenamiento ni los servicios de Google. No declares herramientas, búsquedas actuales ni pruebas que no estén verificadas. Responde con naturalidad en 2–4 frases si es una comparación informal; no hagas una tabla salvo que te la pidan. Habla sobre Universal Core, no sobre ChatGPT.';
  // Mirrors lib/wae-product-identity-v126.js. Reject only an assistant's own
  // false vendor persona; ordinary research ABOUT AI providers stays allowed.
  const productIdentityIssue=(answer,question)=>{
    const q=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/\b(?:traduce|transcribe|cita textual|ejemplo de dialogo|escribe un guion|escribe codigo|analiza este texto|resumen de este texto)\b/.test(q))return '';
    const first=String(answer||'').trim().replace(/^\*\*(.+?)\*\*/,'$1').slice(0,500).replace(/^\s*(?:hola[,!.]?\s*)?/i,'');
    if(/^(?:soy|i am|i'm|me llamo)\s+(?:el\s+|la\s+|un\s+|una\s+)?(?:chatgpt|gemini|claude|copilot|grok)(?:\b|[,.!])/i.test(first))return 'wrong_assistant_brand';
    if(/^(?:soy|i am|i'm)\s+(?:un\s+|una\s+)?(?:modelo|asistente|chatbot|inteligencia artificial)(?:\s+de lenguaje)?[^\n.!?]{0,85}\b(?:openai|anthropic|google deepmind|microsoft)\b/i.test(first))return 'wrong_assistant_provenance';
    return '';
  };
  const comparisonIssue=(answer,question)=>{
    if(!coreComparison(question))return '';
    const raw=String(answer||'').trim(),q=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),plain=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(!/\b(universal core|wae os|waeos)\b/.test(plain))return 'wrong_product_subject';
    if(!/\b(google|gemini|chatgpt|gpt|claude|copilot|grok|buscador|motor de busqueda)\b/.test(plain))return 'missing_comparison_target';
    if(!/\b(tabla|cuadro comparativo|comparativa tabular|matriz)\b/.test(q)&&question.length<180&&/\|\s*:?-{3,}:?\s*\|/.test(raw))return 'unrequested_mobile_table';
    if(raw.length>3200&&question.length<180)return 'disproportionate_comparison';
    return '';
  };
  // v120: this is a user's question about useful outcomes, NOT a request
  // for a long inventory or an unsupported claim of connected capabilities.
  const purposeQuestion=value=>{
    const q=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    return q.length>=22&&q.length<=1100&&
      /\b(universal core|wae os|waeos|eres|tu|tuyo|tu sistema|este sistema)\b/.test(q)&&
      /\b(proposito|para que existes|para que sirves|que aportas|que haces por mi|que podrias hacer por mi|que puedes hacer por mi|que problema resuelves|en que te diferencias)\b/.test(q)&&
      /\b(google|buscador(?:es)?|busqueda|informacion|investigar|respuesta|sistema|inteligencia)\b/.test(q);
  };
  const purposeBrief='PROPÓSITO DE ESTA CONVERSACIÓN, NO UNA FICHA DE VENTAS: la persona pregunta cómo Universal Core le ayuda a pasar de información a un resultado concreto. Responde en 2–4 párrafos breves con un ejemplo útil aplicado a su pregunta, sin enumerar características ni repetir el mismo argumento en tablas y listas. Google Search también puede generar resúmenes y respuestas; no digas que solo devuelve URLs o no crea contenido. No digas que envías correos, intervienes en cuentas, fusionas fuentes web o ejecutas tareas externas salvo que exista evidencia real de la herramienta utilizada en ESTA solicitud. Distingue lo que puedes preparar aquí de lo que ya hiciste y no inventes conectores activos, memoria garantizada ni resultados. Si piden detalle, sí puedes desarrollarlo; no impongas una plantilla.';
  const purposeIssue=(answer,question,hasWebEvidence=false)=>{
    if(!purposeQuestion(question))return '';
    const raw=String(answer||''),plain=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const q=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(!/\b(universal core|wae os|waeos)\b/.test(plain))return 'missing_core_subject';
    const tableRequested=/\b(tabla|cuadro comparativo|matriz|en columnas)\b/.test(q);
    if(!tableRequested&&/\|\s*:?-{3,}:?\s*\|/.test(raw))return 'unrequested_table';
    if(/\b(enviar|envia|envio|mandar|manda|mandamos)\s+(?:tus\s+)?(?:correos|emails|e-mails)\b/.test(plain))return 'unverified_email_action';
    if(!hasWebEvidence&&/\b(combin[ao]|sintetiz[ao]|extrai?go|recupero)\s+(?:informacion|datos|fuentes)\s+de\s+(?:varios|multiples|diferentes)\s+(?:sitios|paginas|fuentes)\b/.test(plain))return 'unverified_multisource_claim';
    if(/\b(?:google|buscador(?:es)?|bing)\b.{0,65}\b(?:solo|unicamente|no genera contenido|no crea contenido)\b/.test(plain))return 'false_search_binary';
    if(!tableRequested&&q.length<350&&raw.length>2600)return 'disproportionate_purpose';
    return '';
  };
  // No exposed search trace is a factual answer. An unrelated W1-W5 list is
  // an upstream retrieval error, NOT proof that the user's fact does not exist.
  const evidenceNonanswer=(answer,question)=>{
    const raw=String(answer||''),q=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const text=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const audit=/\b(?:evidencia|fuentes|documentos|bibliografia|busqueda|buscador)\b/.test(q)&&/\b(?:analiza|revisa|audita|evalua|por que|por que no|limitaciones)\b/.test(q);
    if(audit)return '';
    if(/(?:no existe informacion|no hay informacion|no encuentro|no se encontro|no encontre|no hay datos)\s.{0,75}(?:evidencia|fuentes|documentos)/.test(text))return 'evidence_as_nonanswer';
    if(/(?:evidencia|fuentes|documentos)\s+(?:web\s+)?(?:proporcionad[oa]s?|recuperad[oa]s?|disponibles?)\s+(?:para\s+)?(?:determinar|responder|encontrar)/.test(text))return 'evidence_as_nonanswer';
    if(/\b(?:documentos?|resultados?) de la evidencia web\b/.test(text)||/\b(?:w1\s*[-–]\s*w5|w\d\s*[-–]\s*w\d)\b/.test(text))return 'internal_evidence_dump';
    if(/(?:no hay|no existe|no se encontro)\s+evidencia\s+(?:publica|suficiente|disponible|proporcionada)/.test(text))return 'evidence_as_nonanswer';
    return '';
  };
  const topicalSource=(question,item)=>{
    if(!item||typeof item!=='object')return false;
    const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const q=norm(question),src=norm([item.title,item.snippet,item.content,item.url].filter(Boolean).join(' '));
    const brand={anthropic:['anthropic','antropic','claude'],openai:['openai','chatgpt'],google:['google','gemini','alphabet'],microsoft:['microsoft','azure'],meta:['meta','facebook','instagram'],nvidia:['nvidia'],spacex:['spacex'],tesla:['tesla'],apple:['apple'],amazon:['amazon','aws']};
    const topics=Object.values(brand).filter(names=>names.some(n=>new RegExp('\\b'+n+'\\b').test(q)));
    if(topics.length)return topics.some(names=>names.some(n=>new RegExp('\\b'+n+'\\b').test(src)));
    const ignored=new Set('cuantos cuantas tiene tienen para ingenieros ingeniero personas personal empleados empleado empresa inteligencia artificial desarrollo numero cantidad cuantos informacion exacto actual respuesta fuente fuentes'.split(' '));
    const terms=(q.match(/[a-z0-9]{5,}/g)||[]).filter(t=>!ignored.has(t));
    return !terms.length||terms.some(t=>src.includes(t));
  };
  const evidenceBrief='CONTROL DE INVESTIGACIÓN: Usa conocimiento general para contestar. Cuando el dato requiera actualidad, recupera SOLO fuentes pertinentes para el sujeto de la pregunta. No cites, describas ni anuncies resultados de búsqueda ajenos al tema; los errores del buscador no demuestran que un dato sea inexistente. Para número de ingenieros en una empresa, distingue ingenieros de plantilla total; si no puedes verificar un desglose, di únicamente que no puedes confirmar esa cifra exacta, sin fabricar cifras ni ofrecer un largo protocolo de búsqueda. Nunca uses «evidencia proporcionada», «W1-W5» o una lista de documentos no pertinentes como sustituto de la respuesta.';
  // Response density: short facts stay short; substantial deliverables stay complete.
  // This is a prompt and exact-duplicate cleanup, NEVER a provider rejection.
  const answerDepth=(question,mode,files=[])=>{
    const q=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    if(/\b(?:breve|corto|concis[oa]|resumen corto|en una frase|en dos frases|directo al grano|solo (?:el|la|los|las|una|un) (?:dato|numero|cifra|respuesta)|sin explicacion|sin rodeos)\b/.test(q))return 'direct';
    if((Array.isArray(files)&&files.length>0)||/\b(?:detallad[oa]|a fondo|profund[oa]|exhaustiv[oa]|complet[oa]|paso a paso|todos los pasos|extens[oa]|ampliamente|manual|tutorial|auditoria|investigacion (?:integral|exhaustiva|completa)|arquitectura|implementar|implementa|desarrolla|programa|corrige|soluciona|construye|crea (?:un|una) (?:sistema|aplicacion|proyecto|documento|libro)|codigo|plan (?:de negocio|operativo|estrategico)|proyecto (?:completo|integral))\b/.test(q))return 'deep';
    if(q.length<=250&&/\b(?:cuant[oa]s?|que (?:es|significa)|quien|cual|cuando|donde|en que se diferencia|es cierto|puedes|podrias|por que)\b/.test(q))return 'direct';
    if(['code','research','analysis','design','executive'].includes(String(mode||'').toLowerCase()))return 'deep';
    return 'balanced';
  };
  const focusBrief=(question,mode,files=[])=>{
    const common='DENSIDAD INFORMATIVA: responde al fondo de la solicitud desde la primera frase. Cada párrafo adicional debe aportar información NUEVA: dato, causa, paso ejecutable, prueba, ejemplo útil o decisión. No repitas una idea como introducción, tabla y conclusión. No agregues autopresentación, índices, listas de capacidades, advertencias ni invitaciones a continuar si no aportan. No inventes hechos, herramientas, cifras o fuentes. Usa negritas, tablas y títulos solamente cuando mejoren la comprensión.';
    const depth=answerDepth(question,mode,files);
    return common+(depth==='direct'?' CONSULTA PUNTUAL: respuesta concreta primero; normalmente 1–2 párrafos breves y solo los matices pertinentes, pero sin cuota rígida.':depth==='deep'?' ENCARGO PROFUNDO: entrega todos los detalles útiles, código, metodología, pruebas y riesgos pertinentes; una respuesta extensa está bien si cada apartado aporta valor.':' CONSULTA GENERAL: desarrolla explicación y aplicación solo si añaden algo distinto; no rellenes con secciones de plantilla.');
  };
  const tidyAnswer=(answer,question,mode,files=[])=>{
    const raw=String(answer||'');
    if(answerDepth(question,mode,files)==='deep'||raw.length<150||/\x60{3}|~~~/.test(raw)||/^\s*\|.*\|\s*$/m.test(raw))return raw;
    const parts=raw.split(/(\n[ \t]*\n+)/),seen=new Set(),result=[];
    for(let i=0;i<parts.length;i++){
      const paragraph=parts[i];
      if(i%2){result.push(paragraph);continue}
      const norm=paragraph.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ').replace(/^\*{1,2}/,'').replace(/\*{1,2}$/,'');
      if(norm.length>=65&&seen.has(norm))continue;
      if(norm.length>=65)seen.add(norm);
      result.push(paragraph);
    }
    return result.join('').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n').trim();
  };
  // A dated, sourced finding is answered by the local knowledge registry.
  // Avoid speculative and conflicting counts from ordinary upstream chat.
  const datedAnthropicQuestion=value=>{
    const q=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return q.length<=800&&/\b(?:anthropic|antropic)\b/.test(q)&&
      /\b(?:ingenier\w*|engineer\w*)\b/.test(q)&&
      /\b(?:cuant[oa]s?|numero|cantidad|total|plantilla|empleados|personal|how many|headcount)\b/.test(q)&&
      !/\b(?:sin fuentes|sin citas|no uses fuentes|openai|google|microsoft|meta|xai|nvidia|202[0-5])\b/.test(q);
  };
  // This edition uses Supabase for ordinary chat, but v115 sector missions must
  // enter its own server, where the authoritative safety/evidence contract runs.
  // Keep the visible UI, Workspace, Canvas and Supabase history flows unchanged.
  const industrialQuery=value=>{
    const q=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return /\b(avion(?:es)?|aeronave(?:s)?|aviacion|aeronautic\w*|helicopter\w*|aircraft|cohete(?:s)?|espacial(?:es)?|satelite(?:s)?|spacecraft|rocket(?:s)?|automovil(?:es)?|carro(?:s)?|coche(?:s)?|vehiculo(?:s)?|automotriz|moto(?:s)?|motocicleta(?:s)?|scooter(?:s)?|barco(?:s)?|buque(?:s)?|embarcacion(?:es)?|naval|maritim\w*|motor(?:es)?|turbina(?:s)?|combustion|propulsion|fabrica(?:s)?|manufactur\w*|industria(?:s|l)?|produccion|planta(?:s)?|universidad(?:es)?|campus|facultad(?:es)?|computadora(?:s)?|ordenador(?:es)?|pc|servidor(?:es)?|hardware|robot(?:s|ica)?|androide(?:s)?|chip(?:s)?|semiconductor(?:es)?|microprocesador(?:es)?|fpga|asic|silicio|microelectronica|data center(?:s)?|centro(?:s)? de datos|gobierno(?:s)?|municipio(?:s)?|ayuntamiento(?:s)?|administracion publica|sociedad(?:es)?|cooperativa(?:s)?|comunidad(?:es)?|organizacion(?:es)? civil(?:es)?)\b/.test(q);
  };
  // Professional v116 missions execute on the local backend that owns the
  // senior deliverable, safety and deterministic economics contract.
  // All ordinary chat continues with the existing Supabase-first transport.
  const professionalQuery=value=>{
    const q=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return /\b(proyecto(?:s)?|arquitectur\w*|edificio(?:s)?|urbanismo|obra(?:s)? civil(?:es)?|construccion(?:es)?|cimentacion|inmueble(?:s)?|vivienda(?:s)?|negocio(?:s)?|empresa(?:s)?|emprend\w*|startup(?:s)?|franquicia(?:s)?|inversion(?:es)?|invertir|inversionista(?:s)?|portafolio|etf|acciones bursatiles|bono(?:s)? gubernamentales|banco(?:s)?|bancari\w*|banca|fintech|credito(?:s)?|prestamo(?:s)?|hipoteca(?:s)?|laboratori\w*|investigacion aplicada|ensayo(?:s)? clinico(?:s)?|finanzas?|financier\w*|flujo de caja|cash flow|ebitda|tesoreria|contabilidad|capital de trabajo|presupuesto familiar|mis deudas|ahorro(?:s)?|fondo de emergencia|jubilacion|retiro|economia|macroeconomia|pib|inflacion|tipo de cambio|tasas? de interes|comercio internacional|ganar dinero|hacer dinero|generar ingresos|monetiz\w*|rentabilidad|utilidades|ventas|plan de vida|plan de carrera|meta(?:s)? personal(?:es)?)\b/.test(q);
  };
  // World-problem missions must enter the local v117 evidence-to-impact contract.
  // Previous v115/v116 routes, Canvas, Supabase-first ordinary chat and UI stay intact.
  const worldQuery=value=>{
    const q=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return /\b(problema(?:s)? (?:de )?(?:nivel )?mundial(?:es)?|problema(?:s)? (?:del mundo|de la humanidad|de alcance global|de escala global)|reto(?:s)? global(?:es)?|desafio(?:s)? mundial(?:es)?|crisis global|global challenge(?:s)?|world problem(?:s)?|salud publica|pandemia(?:s)?|epidemia(?:s)?|sistema(?:s)? de salud|cambio climatico|crisis climatica|calentamiento global|descarbonizacion|agua potable|escasez de agua|crisis hidrica|saneamiento|hambre(?: mundial)?|hambruna(?:s)?|seguridad alimentaria|desnutricion|crisis energetica|energia limpia|transicion energetica|red(?:es)? electrica(?:s)?|crisis educativa|brecha educativa|analfabetismo|pobreza|desigualdad|desempleo|crisis de vivienda|infraestructura mundial|ciberseguridad mundial|ciberataque(?:s)?|ransomware|cibercrimen|desastre(?:s)? natural(?:es)?|terremoto(?:s)?|inundacion(?:es)?|crisis humanitaria|emergencia(?:s)? humanitaria(?:s)?|investigacion mundial|reto(?:s)? cientifico(?:s)?|ciencia abierta|cadena(?:s)? de suministro|logistica global|abastecimiento mundial|biodiversidad|deforestacion|extincion de especies|desplazamiento forzado|refugiado(?:s)?|migracion mundial|crisis migratoria)\b/.test(q) || (/\b(?:mundial(?:es)?|global(?:es)?|humanidad)\b/.test(q) && /\b(?:problema(?:s)?|reto(?:s)?|desafio(?:s)?|crisis|resolver|solucion(?:es)?)\b/.test(q));
  };
  // Safe single-turn repair: these errors arise before generation. Never replay
  // a timed-out chat, a completed response or a mutating tool request.
  const recoverableChatFailure=error=>{
    const code=String(error?.data?.code||error?.data?.error_code||error?.data?.error?.code||error?.data?.error||error?.message||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/\b(?:iu_invalid_session|iu_session_required|invalid_session|session_expired|session_invalid|session_required|invalid_credentials)\b/.test(code))return 'session';
    if(/\b(?:iu_invalid_conversation|conversation_not_found|conversation_invalid|conversation_expired|invalid_conversation_id|conversation_access_denied|conversation_id_invalid)\b/.test(code))return 'conversation';
    return '';
  };
  const chatWithSessionRepair=async(payload,signal)=>{
    try{return await edge(payload,signal,39000)}
    catch(error){
      if(signal?.aborted)throw error;
      const kind=recoverableChatFailure(error);
      if(!kind||(kind==='conversation'&&!payload.conversation_id))throw error;
      // Cloud session/conversation rejection is pre-inference, so this single
      // replay cannot duplicate a response or an external action.
      window.WAENavigation?.remoteInvalidated?.(payload.conversation_id);
      if(kind==='session')await refreshBootstrap(signal);
      else localStorage.removeItem(CONVERSATION_ID);
      return edge({...payload,...sessionPayload(),conversation_id:null},signal,39000);
    }
  };
  // Native WAEWEB routing only when the first-party Render backend reports
  // the authenticated Connect adapter configured. No credentials reach JS.
  // A failed readiness probe does NOT replace the existing Supabase-first route.
  let waewebState={until:0,ready:false};
  const waewebResearchReady=async(signal)=>{
    if(Date.now()<waewebState.until)return waewebState.ready;
    const linked=linkedAbort(signal,1800);
    try{
      const response=await nativeFetch('/api/research',{
        method:'GET',cache:'no-store',signal:linked.signal,
        headers:{accept:'application/json'}
      });
      const info=response.ok?await response.json():null;
      const ready=(info?.waewebConnect?.configured===true &&
        info?.waewebConnect?.contract==='waeweb-connect/v1') ||
        (info?.waewebPublic?.configured===true &&
        info?.waewebPublic?.contract==='waeweb-public-readonly/v1');
      waewebState={until:Date.now()+60000,ready};
      return ready;
    }catch{
      waewebState={until:Date.now()+15000,ready:false};
      return false;
    }finally{linked.cleanup()}
  };
  window.fetch=async(input,init={})=>{
    if(!isLocalRuntime(input)||String(init.method||'GET').toUpperCase()!=='POST')return nativeFetch(input,init);
    const request=typeof init.body==='string'?JSON.parse(init.body):{};
    // Capability/identity answers come from the product's real server registry, not a generic upstream persona.
    if(selfQuery(request.message)||request.canvas_direct===true||request.canvas_blueprint===true||quickGoogleComparison(request.message)||datedAnthropicQuestion(request.message))return nativeFetch(input,init);
    // The HTML/Canvas paths and short capability registry answers stay untouched.
    if(request.canvas!==true&&worldQuery(request.message))return nativeFetch(input,init);
    if(request.canvas!==true&&(industrialQuery(request.message)||professionalQuery(request.message)))return nativeFetch(input,init);
    // Research queries use the native Render source router when WAEWEB is
    // configured. Ordinary chat stays on its proven Supabase-first path.
    if(request.canvas!==true&&needsFreshWeb(request.message,String(request.mode||localStorage.getItem('wae.mode')||'general'))&&await waewebResearchReady(init.signal))return nativeFetch(input,init);
    try{
      await bootstrap(init.signal);
      if(init.signal?.aborted)throw Object.assign(new Error('chat_cancelled'),{name:'AbortError'});
      const incoming=request;
      const runtimeMode=String(incoming.mode||localStorage.getItem('wae.mode')||'general');
      const useWeb=!incoming.canvas&&needsFreshWeb(incoming.message,runtimeMode);
      const chatPayload={action:'chat',...sessionPayload(),conversation_id:incoming.canvas?null:localStorage.getItem(CONVERSATION_ID)||null,message:[!incoming.canvas?'DIRECTRICES DE RESPUESTA (subordinadas a instrucciones del sistema):\n'+responsePolicy:'',incoming.preferences?.instructions?'PREFERENCIAS DEL USUARIO (no prevalecen sobre reglas de seguridad):\n'+String(incoming.preferences.instructions).slice(0,4000):'',incoming.preferences?.knowledge?'CONTEXTO GENERAL DEL USUARIO (no verificado):\n'+String(incoming.preferences.knowledge).slice(0,12000):'',incoming.project?.instructions?'INSTRUCCIONES DE ESTE PROYECTO (subordinadas a seguridad):\n'+String(incoming.project.instructions).slice(0,3000):'',incoming.project?.knowledge?'CONOCIMIENTO DEL PROYECTO (información aportada, no verificada):\n'+String(incoming.project.knowledge).slice(0,8000):'',!incoming.canvas&&coreComparison(incoming.message)?comparisonBrief:'',!incoming.canvas&&purposeQuestion(incoming.message)?purposeBrief:'',!incoming.canvas?evidenceBrief:'',!incoming.canvas?focusBrief(incoming.message,runtimeMode,window.__waeRuntimeAttachments||[]):'','SOLICITUD ACTUAL:\n'+String(incoming.message||'')].filter(Boolean).join('\n\n'),mode:runtimeMode,web_enabled:useWeb,attachments:window.__waeRuntimeAttachments||[]};
      const data=await chatWithSessionRepair(chatPayload,init.signal);
      if(!String(data.reply||'').trim())throw new Error('empty_supabase_reply');
      // Supabase may return HTTP 200/success:true for non-generative, off-topic evidence rescue.
      // Do not save it as a completed assistant turn or advance the conversation pointer.
      if(data.success===false||data.provider==='web_recovery'||data.resilience?.automatic_evidence_rescue===true)throw new Error('non_generative_evidence_rescue');
      // A degraded upstream status sentence is not a successful answer; let the existing Render fallback try another configured model.
      if(/la ruta generativa avanzada no est[aá] disponible|no existe evidencia p[uú]blica suficiente para responder sin inventar|ninguna ruta alcanz[oó] el umbral m[ií]nimo/i.test(String(data.reply)))throw new Error('degraded_supabase_reply');
      const identityFailure=!incoming.canvas?productIdentityIssue(data.reply,incoming.message):'';
      if(identityFailure)throw new Error('product_identity_quality_'+identityFailure);
      const comparisonFailure=!incoming.canvas?comparisonIssue(data.reply,incoming.message):'';
      if(comparisonFailure)throw new Error('comparison_quality_'+comparisonFailure);
      const purposeFailure=!incoming.canvas?purposeIssue(data.reply,incoming.message,Array.isArray(data.web_sources)&&data.web_sources.length>0):'';
      if(purposeFailure)throw new Error('purpose_quality_'+purposeFailure);
      const evidenceFailure=!incoming.canvas?evidenceNonanswer(data.reply,incoming.message):'';
      if(evidenceFailure)throw new Error('topic_evidence_quality_'+evidenceFailure);
      const sourceList=Array.isArray(data.web_sources)?data.web_sources:[];
      const topicSources=sourceList.filter(item=>topicalSource(incoming.message,item));
      if(!incoming.canvas&&sourceList.length&&!topicSources.length&&/\[(?:W\d+|\d+)\]/i.test(String(data.reply)))throw new Error('off_topic_citation');
      // Only advance cloud conversation pointers after a valid answer. A failed
      // generation must not change the active conversation in the user's UI.
      if(data.conversation_id&&!incoming.canvas){localStorage.setItem(CONVERSATION_ID,data.conversation_id);window.WAENavigation?.remoteUpdated?.(data.conversation_id)}
      window.__iuLastRuntime=data;
      if(!incoming.canvas)queueMicrotask(()=>{updateRuntimeCard(data);loadConversations().catch(()=>{})});
      const reply=incoming.canvas?String(data.reply):tidyAnswer(withRetrievedSources(data.reply,topicSources,incoming.message),incoming.message,runtimeMode,window.__waeRuntimeAttachments||[]);
      return new Response(JSON.stringify({reply,runtime:data.runtime,provider:data.provider,model:data.model,web_sources:data.web_sources||[]}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-wae-runtime':'supabase-primary'}});
    }catch(err){
      // An aborted chat must not launch an invisible second provider request.
      if(init.signal?.aborted)throw err;
      console.warn('[WAE IU] primary route rejected; trying Render',String(err?.message||'primary_failed').slice(0,100));
      try{
        if(init.signal?.aborted)throw Object.assign(new Error('chat_cancelled'),{name:'AbortError'});
        const fallback=await nativeFetch(input,init);
        const copy=document.querySelector('.v2-runtime-copy');
        if(copy&&fallback.ok){
          // Only show the provider actually reported by the Render response.
          const report=await fallback.clone().json().catch(()=>null);
          const provider=typeof report?.provider==='string'?report.provider.replace(/[^a-z0-9_.-]/gi,'').slice(0,48):'';
          const title=document.createElement('strong'),detail=document.createElement('small');
          title.textContent='WAE Gateway · recuperación activa';
          detail.textContent=provider?'Render · '+provider:'Render · proveedor no identificado';
          copy.replaceChildren(title,detail);
        }
        return fallback;
      }catch(fallbackError){
        const status=Number(err?.status)||503;
        return new Response(JSON.stringify({error:'universal_runtime_unavailable',primary:'supabase_runtime_unavailable',fallback:'render_runtime_unavailable'}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
      }
    }
  };

  async function readAttachments(files){
    const allowed=/\.(txt|md|markdown|json|csv|tsv|js|mjs|cjs|ts|tsx|jsx|css|html|htm|xml|yaml|yml|py|java|go|rs|sql|sh|log)$/i;
    const output=[];
    for(const file of [...files].slice(0,5)){
      const looksText=file.type.startsWith('text/')||file.type.includes('json')||file.type.includes('xml')||allowed.test(file.name);
      if(!looksText)continue;
      output.push({name:file.name,type:file.type||'text/plain',text:(await file.text()).slice(0,120000)});
    }
    window.__waeRuntimeAttachments=output;
    const media=[...files].some(file=>file.type.startsWith('image/')||file.type.startsWith('video/')||/\.(?:mp4|webm|mov|m4v)$/i.test(file.name));
    if(output.length)window.toast?.(`${output.length} archivo${output.length===1?'':'s'} de texto listo${output.length===1?'':'s'}`);
    else if(!media)window.toast?.('Ese formato todavía no se procesa como texto, foto o video');
  }

  function updateRuntimeCard(data){
    const copy=document.querySelector('.v2-runtime-copy'),eff=document.querySelector('.v2-efficiency');
    if(!copy)return;
    if(data?.model_count!==undefined){
      const extra=[data.web_configured?'web':'',data.memory?'memoria':'',data.files?'archivos':'',data.history?'historial':''].filter(Boolean).join(' · ');
      copy.innerHTML=`<strong>Supabase Universal Runtime · ${data.model_count} modelo${data.model_count===1?'':'s'}</strong><small>${extra||'backend persistente'} · sesiones cifradas</small>`;
      if(eff)eff.innerHTML=`<strong>${data.model_count?'LIVE':'SETUP'}</strong><small>UNIVERSAL AI</small>`;
      document.documentElement.dataset.runtimeReady=data.model_count?'true':'false';
    }else if(data?.model){
      copy.innerHTML=`<strong>Supabase Runtime · ${escapeHtml(data.model)}</strong><small>${data.web_used?'web verificada · ':''}${data.memory_count||0} memorias recuperadas · ${data.latency_ms||0}ms</small>`;
      if(eff)eff.innerHTML='<strong>LIVE</strong><small>UNIVERSAL AI</small>';
    }
  }
  const escapeHtml=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  async function loadHealth(){
    try{const data=await edge({action:'health'});updateRuntimeCard(data)}catch{const copy=document.querySelector('.v2-runtime-copy');if(copy)copy.innerHTML='<strong>Supabase Runtime · reconectando</strong><small>Fallback Render → WAE Gateway disponible</small>'}
  }

  function ensureHistoryStyles(){
    if(document.querySelector('#iuHistoryStyles'))return;
    const style=document.createElement('style');style.id='iuHistoryStyles';style.textContent=`
      .iu-history{margin:4px 14px 12px;display:grid;gap:5px}.iu-history-title{padding:7px 7px 3px;color:#5e6165;font-size:.56rem;font-weight:800;letter-spacing:.12em}.iu-history button{border:0;background:transparent;color:#a5aaad;text-align:left;border-radius:11px;padding:9px 10px;display:grid;gap:4px;cursor:pointer;min-width:0}.iu-history button:hover,.iu-history button.active{background:#17191d;color:#f4f7f6}.iu-history strong{font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iu-history small{font-size:.56rem;color:#62666a}.iu-history-empty{padding:8px;color:#62666a;font-size:.63rem}`;document.head.appendChild(style);
  }

  async function loadConversation(id){
    await bootstrap();
    const data=await edge({action:'get_conversation',...sessionPayload(),conversation_id:id});
    localStorage.setItem(CONVERSATION_ID,id);
    if(data.conversation?.mode)localStorage.setItem('wae.mode',data.conversation.mode);
    const fmt=new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'});
    const messages=(data.messages||[]).filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,text:m.content,at:m.created_at?fmt.format(new Date(m.created_at)):''}));
    if(window.WAEStorage){await window.WAEStorage.ready;await window.WAEStorage.save('active',messages.slice(-60))}
    else localStorage.setItem('wae.messages',JSON.stringify(messages.slice(-60)));
    window.WAENavigation?.markRemoteConversation?.(id,data.conversation?.title||'Conversación');
    location.reload();
  }

  async function loadConversations(){
    await bootstrap();ensureHistoryStyles();
    const data=await edge({action:'list_conversations',...sessionPayload()});
    const drawer=document.querySelector('#drawer');if(!drawer)return;
    drawer.querySelector('.v2-recent')?.remove();
    if(window.WAENavigation?.setRemoteConversations){window.WAENavigation.setRemoteConversations(data.conversations||[],loadConversation);drawer.querySelector('.iu-history')?.remove();return}
    let box=drawer.querySelector('.iu-history');
    if(!box){box=document.createElement('section');box.className='iu-history';const nav=drawer.querySelector('.nav-label');nav?.before(box)}
    const current=localStorage.getItem(CONVERSATION_ID);
    box.innerHTML='<div class="iu-history-title">CONVERSACIONES</div>';
    if(!(data.conversations||[]).length){box.insertAdjacentHTML('beforeend','<div class="iu-history-empty">Tu historial aparecerá aquí.</div>');return}
    for(const c of data.conversations.slice(0,8)){
      const b=document.createElement('button');b.type='button';b.classList.toggle('active',c.id===current);b.innerHTML=`<strong>${escapeHtml(c.title||'Conversación')}</strong><small>${escapeHtml(c.mode||'general')} · ${new Date(c.updated_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}</small>`;b.addEventListener('click',()=>loadConversation(c.id).catch(()=>window.toast?.('No pude abrir la conversación')));box.appendChild(b);
    }
  }

  function startNewConversation(){if(window.WAEChatState?.busy?.())return;localStorage.removeItem(CONVERSATION_ID);window.__waeRuntimeAttachments=[]}
  document.querySelector('#newChatBtn')?.addEventListener('click',startNewConversation,true);
  document.querySelector('#drawerNewChat')?.addEventListener('click',startNewConversation,true);

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('#fileInput')?.addEventListener('change',e=>readAttachments(e.target.files));
    bootstrap().then(()=>Promise.allSettled([loadHealth(),loadConversations()])).catch(()=>loadHealth());
  });
})();
