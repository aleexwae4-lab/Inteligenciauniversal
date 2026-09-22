(()=>{
'use strict';
const $=(selector,root=document)=>root.querySelector(selector);
const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e};
const safeLink=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:null}catch{return null}};
const backend=async(path,body)=>{
  const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(13000)});
  const data=await r.json().catch(()=>({error:'invalid_response'}));
  if(!r.ok)throw Object.assign(Error(data.error||data.code||'HTTP '+r.status),{data,status:r.status});
  return data;
};
const style=document.createElement('style');
style.textContent='.wae-v119-tool{border:1px solid #384451;background:#17202a;color:#e7f1fa;border-radius:10px;padding:7px 10px;font:600 12px system-ui;cursor:pointer;white-space:nowrap}.wae-v119-wrap{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;background:#05080de8;padding:16px}.wae-v119-panel{box-sizing:border-box;max-width:660px;width:100%;max-height:90dvh;overflow:auto;background:#101923;color:#e9f1f9;border:1px solid #334254;border-radius:20px;padding:18px;display:grid;gap:12px;font:14px/1.5 system-ui}.wae-v119-panel button,.wae-v119-panel select{border:1px solid #456179;background:#1c3346;color:#edf6fb;border-radius:10px;padding:9px;cursor:pointer}.wae-v119-panel input,.wae-v119-panel textarea{box-sizing:border-box;width:100%;border:1px solid #456179;border-radius:11px;padding:10px;background:#0b111a;color:#fff;font:14px system-ui}.wae-v119-panel textarea{min-height:180px;resize:vertical}.wae-v119-line{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.wae-v119-line>*{flex:1 1 auto}.wae-v119-results{display:grid;gap:9px}.wae-v119-hit{border:1px solid #334254;border-radius:10px;padding:9px;overflow-wrap:anywhere}.wae-v119-hit a{color:#94d7ff;font-weight:700}.wae-v119-muted{color:#a0b4c4;font-size:12px}.wae-v119-alert{color:#ffcb84;font-size:12px}';
function start(){
  const actions=$('.workspace-actions')||$('.workspace-topbar');if(!actions)return;
  document.head.append(style);
  let overlay=null,room=null,rev=0,serverText='',localDirty=false,remoteNew=false,poll=null;
  const note=(message,error=false)=>{const e=$('#waeV119Notice');if(e){e.textContent=message;e.className=error?'wae-v119-alert':'wae-v119-muted'}};
  const clearPoll=()=>{if(poll)clearInterval(poll);poll=null};
  const exit=()=>{clearPoll();overlay?.remove();overlay=null;room=null};
  function panel(title){
    exit();overlay=node('div','','wae-v119-wrap');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    const body=node('section','','wae-v119-panel'),head=node('div','','wae-v119-line');
    head.append(node('strong',title));const close=node('button','Cerrar');close.type='button';close.addEventListener('click',exit);head.append(close);body.append(head);
    const status=node('div','','wae-v119-muted');status.id='waeV119Notice';body.append(status);overlay.append(body);document.body.append(overlay);
    return body;
  }
  const attach=(body,element)=>{body.append(element);return element};
  function research(){
    const body=panel('Investigación con fuentes verificables');
    attach(body,node('div','Web general: requiere Tavily configurado. Literatura científica: Crossref público; referencia enciclopédica: Wikimedia. Cada resultado muestra procedencia y fecha de consulta.','wae-v119-muted'));
    const input=attach(body,node('input'));input.placeholder='¿Qué deseas investigar?';input.maxLength=280;
    const line=attach(body,node('div','','wae-v119-line')),mode=node('select');
    [['auto','Automático'],['web','Web reciente (si está configurada)'],['academic','Estudios y publicaciones'],['encyclopedia','Enciclopedia']].forEach(([id,name])=>{const option=node('option',name);option.value=id;mode.append(option)});
    const go=node('button','Buscar fuentes');line.append(mode,go);
    const results=attach(body,node('div','','wae-v119-results'));
    go.addEventListener('click',async()=>{
      const query=input.value.trim();if(query.length<3)return note('Introduce al menos tres caracteres.',true);
      go.disabled=true;results.replaceChildren();note('Consultando fuentes públicas…');
      try{
        const data=await backend('/api/research',{query,mode:mode.value});
        note((data.results?.length||0)+' resultados · '+data.provider+' · consulta '+new Date(data.checkedAt).toLocaleString('es-MX')+(data.limitation?' · '+data.limitation:''));
        for(const r of data.results||[]){
          const hit=node('div','','wae-v119-hit'),link=node('a',r.title);link.href=safeLink(r.url)||'#';link.target='_blank';link.rel='noopener noreferrer';
          hit.append(link,node('div',r.snippet||'','wae-v119-muted'),node('small','Fuente: '+r.provider+' · '+(r.publishedAt?'Publicado: '+r.publishedAt+' · ':'')+'Consultado: '+new Date(r.retrievedAt).toLocaleString('es-MX'),'wae-v119-muted'));results.append(hit);
        }
      }catch(e){note(e.data?.code==='general_web_not_configured'?'Búsqueda web general sin proveedor configurado. Elige Estudios o Enciclopedia; esos índices NO son noticias en vivo.':'Búsqueda no disponible: '+e.message,true)}
      finally{go.disabled=false}
    });
    input.addEventListener('keydown',e=>{if(e.key==='Enter')go.click()});input.focus();
  }
  function docText(){return $('#documentEditor')?.innerText||''}
  function collab(){
    const body=panel('Sala colaborativa temporal');
    attach(body,node('div','Documento compartido por enlace secreto, actualización cada 4 segundos y control de revisiones. Caduca en 6 horas o si reinicia el servicio; no es Google Docs ni almacenamiento permanente. No compartas información sensible.','wae-v119-alert'));
    const editor=attach(body,node('textarea'));editor.placeholder='Texto de trabajo compartido';editor.value=docText().slice(0,90000);
    const line=attach(body,node('div','','wae-v119-line'));
    const create=node('button','Crear sala'),save=node('button','Publicar cambios'),copy=node('button','Copiar invitación'),apply=node('button','Llevar a Workspace'),reload=node('button','Cargar versión remota');
    line.append(create,save,copy,apply,reload);save.disabled=true;copy.disabled=true;reload.disabled=true;
    const secretUrl=()=>location.origin+location.pathname+location.search+'#wae-room='+encodeURIComponent(room.id)+'.'+encodeURIComponent(room.secret);
    const present=data=>{serverText=data.text;rev=data.revision;remoteNew=false;reload.disabled=false;note('Sala conectada · revisión '+rev+' · caduca '+new Date(data.expiresAt).toLocaleString('es-MX'))};
    const load=async()=>{
      if(!room||document.hidden)return;
      try{const data=await backend('/api/collaboration',{action:'read',...room});
        if(data.revision!==rev){
          remoteNew=true;rev=data.revision;serverText=data.text;
          if(!localDirty){editor.value=data.text;remoteNew=false}
          note(remoteNew?'Hay cambios remotos: copia tu borrador o carga la nueva versión. No sobrescribimos tu texto.':'Nueva revisión '+rev+' recibida.');
        }
      }catch(e){note('No se puede sincronizar: '+e.message,true);clearPoll()}
    };
    const activate=data=>{room={id:data.id,secret:data.secret};editor.value=data.text;localDirty=false;present(data);save.disabled=false;copy.disabled=false;clearPoll();poll=setInterval(load,4000)};
    editor.addEventListener('input',()=>{localDirty=editor.value!==serverText});
    create.addEventListener('click',async()=>{
      try{const data=await backend('/api/collaboration',{action:'create',title:$('#iuDocName')?.value||'Documento WAE',text:editor.value});activate(data);note('Sala creada. Comparte la invitación con quien deba poder editar.');}catch(e){note('No se creó la sala: '+e.message,true)}
    });
    save.addEventListener('click',async()=>{
      if(!room)return;try{
        const data=await backend('/api/collaboration',{action:'update',...room,text:editor.value,revision:rev});
        localDirty=false;present(data);
      }catch(e){if(e.status===409){remoteNew=true;note('Conflicto: alguien publicó una revisión nueva. Copia tu borrador antes de cargar la versión remota.',true)}
        else note('No se guardó: '+e.message,true)}
    });
    reload.addEventListener('click',()=>{
      if(localDirty&&!window.confirm('¿Reemplazar tu borrador local por la última revisión compartida?'))return;
      editor.value=serverText;localDirty=false;remoteNew=false;note('Versión remota cargada · revisión '+rev)
    });
    copy.addEventListener('click',async()=>{
      if(!room)return;try{await navigator.clipboard.writeText(secretUrl());note('Invitación copiada. Cualquiera con ese enlace puede editar durante la vida de la sala.')}catch{note('No pude copiar automáticamente. Usa el enlace compartido desde un navegador seguro.',true)}
    });
    apply.addEventListener('click',()=>{
      const target=$('#documentEditor');if(!target)return note('Abre un documento de Workspace.',true);
      if(target.textContent?.trim()&&!window.confirm('¿Reemplazar el contenido actual de Workspace con el texto de esta sala?'))return;
      target.textContent=editor.value;target.dispatchEvent(new Event('input',{bubbles:true}));note('Texto colocado en Workspace. Guarda o exporta el documento para conservarlo.');
    });
    return async function join(id,secret){
      try{const data=await backend('/api/collaboration',{action:'read',id,secret});activate({...data,secret});note('Sala compartida conectada · revisión '+rev)}
      catch(e){note('No pude abrir la sala. El enlace pudo caducar o el servicio se reinició.',true)}
    };
  }
  const r=node('button','Investigar','wae-v119-tool'),c=node('button','Colaborar','wae-v119-tool');r.type=c.type='button';
  r.addEventListener('click',research);c.addEventListener('click',collab);actions.append(r,c);
  if(location.hash.startsWith('#wae-room=')){
    const encoded=location.hash.slice(10),dot=encoded.indexOf('.');
    if(dot>0){const join=collab();join(decodeURIComponent(encoded.slice(0,dot)),decodeURIComponent(encoded.slice(dot+1)))}
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
