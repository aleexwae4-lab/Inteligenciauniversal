(()=>{
'use strict';
if(window.WAELiveWorkspace)return;
const $=s=>document.querySelector(s),toast=s=>window.toast?.(s);
const state={id:'',secret:'',revision:0,last:'',controller:null};
const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value||'');return n};
const status=v=>{$('#waeLiveStatus').textContent=v};
async function api(route,body,signal){
 const r=await fetch(route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal,cache:'no-store'});
 const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||d.code||'HTTP '+r.status),{status:r.status});return d;
}
function stop(){state.controller?.abort();state.controller=null}
function accept(d){
 const e=$('#waeLiveText');
 if(e.value===state.last){e.value=d.text;state.last=d.text;state.revision=d.revision;status('Sincronizado · revisión '+d.revision)}
 else if(e.value===d.text){state.last=d.text;state.revision=d.revision;status('Cambios sincronizados')}
 else{status('Cambio remoto disponible: conserva tu borrador y resuelve el conflicto antes de publicar')}
}
async function stream(){
 stop();const controller=new AbortController();state.controller=controller;
 while(!controller.signal.aborted){
  try{
   const r=await fetch('/api/collaboration',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'subscribe',id:state.id,secret:state.secret}),signal:controller.signal,cache:'no-store'});
   if(!r.ok||!r.body)throw Error('stream_not_available');
   const reader=r.body.getReader(),decode=new TextDecoder();let buffer='';
   for(;;){
    const part=await reader.read();if(part.done)break;
    buffer+=decode.decode(part.value,{stream:true});
    if(buffer.length>200000)throw Error('stream_too_large');
    let n;while((n=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,n);buffer=buffer.slice(n+2);const data=block.split('\n').find(x=>x.startsWith('data: '));if(data)try{accept(JSON.parse(data.slice(6)))}catch{}}
   }
  }catch(e){if(!controller.signal.aborted)status('Reconectando sala…')}
  if(!controller.signal.aborted)await new Promise(resolve=>setTimeout(resolve,1800));
 }
}
async function join(id,secret){
 stop();const d=await api('/api/collaboration',{action:'read',id,secret});
 state.id=id;state.secret=secret;state.last=d.text;state.revision=d.revision;
 $('#waeLiveInvite').value=id+':'+secret;$('#waeLiveText').value=d.text;
 status('Sala temporal · revisión '+d.revision+' · guarda una copia permanente fuera de esta sala');
 stream();
}
async function search(){
 const button=$('#waeLiveFind');button.disabled=true;const root=$('#waeLiveResults');root.replaceChildren(text('p','Consultando fuentes públicas…'));
 try{
  const d=await api('/api/research',{query:$('#waeLiveQuery').value,mode:$('#waeLiveMode').value});
  root.replaceChildren(text('p','Origen: '+d.provider+' · consultado '+d.checkedAt));
  if(d.limitation)root.append(text('p',d.limitation));
  if(!d.results.length)root.append(text('p','No se encontraron resultados.'));
  for(const item of d.results){
   const article=document.createElement('article'),a=document.createElement('a');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title;
   article.append(a,text('small',item.publishedAt||'Sin fecha verificada'),text('p',item.snippet||'Resultado indexado: consulta el documento original.'));
   root.append(article);
  }
 }catch(e){root.replaceChildren(text('p',e.message==='general_web_not_configured'?'Web general no configurada en Render; prueba Noticias recientes, Bibliografía o Contexto.':'Búsqueda no disponible: '+e.message))}
 finally{button.disabled=false}
}
function init(){
 const actions=$('#workspace .workspace-actions');if(!actions)return;
 const open=document.createElement('button');open.type='button';open.className='chip';open.textContent='Investigar · Colaborar';actions.prepend(open);
 const dialog=document.createElement('dialog');dialog.id='waeLiveDialog';
 dialog.innerHTML=[
 '<header><strong>WAE · Investigación y colaboración</strong><button type="button" id="waeLiveClose">×</button></header>',
 '<p>Herramientas nativas. Google Workspace requiere autorización OAuth independiente en Wae.</p>',
 '<nav><button type="button" id="waeLiveResearchTab">Investigar</button><button type="button" id="waeLiveCollabTab">Colaborar</button></nav>',
 '<section id="waeLiveResearch"><input id="waeLiveQuery" maxlength="280" placeholder="Consulta o tema de investigación"><select id="waeLiveMode"><option value="auto">Automático</option><option value="web">Web general configurada</option><option value="news">Noticias recientes · GDELT</option><option value="academic">Bibliografía científica</option><option value="encyclopedia">Wikimedia contexto</option></select><button type="button" id="waeLiveFind">Buscar fuentes</button><div id="waeLiveResults" aria-live="polite"></div></section>',
 '<section id="waeLiveCollab" hidden><p>Sala temporal: se pierde tras 6 horas o reinicio del servidor. No pegues contraseñas ni información sensible. Comparte el código únicamente de forma privada.</p><button type="button" id="waeLiveCreate">Crear desde documento</button><input id="waeLiveInvite" placeholder="ID:clave privada" autocomplete="off"><button type="button" id="waeLiveJoin">Unirse</button><button type="button" id="waeLiveCopy">Copiar código</button><textarea id="waeLiveText" rows="9" maxlength="90000" aria-label="Documento compartido"></textarea><p id="waeLiveStatus" aria-live="polite">Sin sala activa</p><button type="button" id="waeLivePublish">Publicar</button><button type="button" id="waeLivePull">Traer remoto</button><button type="button" id="waeLiveToWorkspace">Copiar al Workspace</button></section>'
 ].join('');
 document.body.append(dialog);open.onclick=()=>{dialog.showModal();if(state.id)stream()};$('#waeLiveClose').onclick=()=>dialog.close();dialog.addEventListener('close',stop);
 $('#waeLiveResearchTab').onclick=()=>{$('#waeLiveResearch').hidden=false;$('#waeLiveCollab').hidden=true};
 $('#waeLiveCollabTab').onclick=()=>{$('#waeLiveResearch').hidden=true;$('#waeLiveCollab').hidden=false};
 $('#waeLiveFind').onclick=search;
 $('#waeLiveCreate').onclick=async()=>{try{const d=await api('/api/collaboration',{action:'create',title:$('#iuDocName')?.value||'Documento WAE',text:($('#documentEditor')?.innerText||'').slice(0,90000)});await join(d.id,d.secret);toast('Sala creada: comparte el código de forma privada.')}catch(e){status(e.message)}};
 $('#waeLiveJoin').onclick=async()=>{const code=$('#waeLiveInvite').value.trim(),i=code.indexOf(':');if(i<0)return status('Escribe ID:clave');try{await join(code.slice(0,i),code.slice(i+1))}catch(e){status(e.message)}};
 $('#waeLiveCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#waeLiveInvite').value);toast('Código copiado')}catch{toast('Selecciona y copia el código manualmente.')}};
 $('#waeLivePublish').onclick=async()=>{if(!state.id)return status('Crea o únete a una sala.');const value=$('#waeLiveText').value;try{const d=await api('/api/collaboration',{action:'update',id:state.id,secret:state.secret,text:value,revision:state.revision});state.last=value;accept(d);status('Publicado · revisión '+d.revision)}catch(e){status(e.status===409?'Conflicto: conserva tu borrador. Copia el texto antes de traer la versión remota.':e.message)}};
 $('#waeLivePull').onclick=async()=>{if(!state.id)return;const editor=$('#waeLiveText');if(editor.value!==state.last&&!confirm('¿Reemplazar los cambios locales?'))return;try{const d=await api('/api/collaboration',{action:'read',id:state.id,secret:state.secret});state.last=d.text;state.revision=d.revision;editor.value=d.text;status('Versión remota '+d.revision)}catch(e){status(e.message)}};
 $('#waeLiveToWorkspace').onclick=()=>{const editor=$('#documentEditor');if(!editor)return;if(editor.innerText.trim()&&!confirm('¿Reemplazar el documento actual?'))return;editor.textContent=$('#waeLiveText').value;editor.dispatchEvent(new Event('input',{bubbles:true}));toast('Copiado al Workspace; guarda y exporta.');};
 window.WAELiveWorkspace={open:()=>dialog.showModal(),status:()=>({active:!!state.id,revision:state.revision,ephemeral:true})};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();