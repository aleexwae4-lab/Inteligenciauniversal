// Universal Core: grounded conversation about its purpose (not a fixed sales response).
const plain=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function isPurposeQuestion(question=''){
 const q=plain(question);
 if(q.length<22||q.length>1100)return false;
 const subject=/\b(universal core|wae os|waeos|eres|tu|tuyo|tu sistema|este sistema)\b/.test(q);
 const why=/\b(proposito|para que existes|para que sirves|que aportas|que haces por mi|que podrias hacer por mi|que puedes hacer por mi|que problema resuelves|en que te diferencias)\b/.test(q);
 const context=/\b(google|buscador(?:es)?|busqueda|informacion|investigar|respuesta|sistema|inteligencia)\b/.test(q);
 return subject&&why&&context;
}
export const PURPOSE_GROUNDING=[
 'INTENCIÓN: la persona pregunta por el valor de Universal Core PARA ELLA, no solicita una presentación comercial.',
 'Contesta la pregunta de frente en lenguaje humano y con voz propia, sin apartados «Propósito», «Diferencias clave», listas de capacidades ni tabla salvo petición expresa.',
 'Usa un ejemplo breve concreto de su solicitud: de encontrar información a decidir, redactar, prototipar o investigar, y explica qué entregable se podría producir aquí. No prometas que se creó hasta verificarlo.',
 'No dibujes un contraste falso: los buscadores modernos también pueden generar resúmenes y conversar; no digas que Google solo da URLs o que no genera contenido. No asumas acceso a todo Google.',
 'No digas que envías correos, intervienes en cuentas, ejecutas acciones externas, fusionas fuentes web o conservas memoria en la nube si no hay herramientas reales usadas o conectadas en esta solicitud.',
 'Distingue «puedo ayudarte a preparar/crear aquí» de «ya ejecuté/envié/desplegué». Si se necesita web actual, exige resultados realmente recuperados.',
 'Para una pregunta conceptual breve: responde en 2 a 4 párrafos breves, normalmente menos de 180 palabras; no impongas números ni el formato de plantilla. Si piden profundidad, desarrolla cuanto necesiten.'
].join('\n');
export function purposeResponseIssue(answer='',question='',{verifiedEmail=false,verifiedWeb=false}={}){
 if(!isPurposeQuestion(question))return '';
 const raw=String(answer||''),text=plain(raw),q=plain(question);
 if(!raw.trim())return 'empty_purpose';
 if(!/\b(universal core|wae os|waeos)\b/.test(text))return 'missing_core_subject';
 const asksTable=/\b(tabla|cuadro comparativo|matriz|en columnas)\b/.test(q);
 if(!asksTable&&/\|\s*:?-{3,}:?\s*\|/.test(raw))return 'unrequested_table';
 if(!verifiedEmail&&/\b(enviar|envia|envio|mandar|manda|mandamos)\s+(?:tus\s+)?(?:correos|emails|e-mails)\b/.test(text))return 'unverified_email_action';
 if(!verifiedWeb&&/\b(combin[ao]|sintetiz[ao]|extrai?go|recupero)\s+(?:informacion|datos|fuentes)\s+de\s+(?:varios|multiples|diferentes)\s+(?:sitios|paginas|fuentes)\b/.test(text))return 'unverified_multisource_claim';
 if(/\b(?:google|buscador(?:es)?|bing)\b.{0,65}\b(?:solo|unicamente|no genera contenido|no crea contenido)\b/.test(text))return 'false_search_binary';
 if(!asksTable&&q.length<350&&raw.length>2600)return 'disproportionate_purpose';
 return '';
}
