(()=>{
  // Additive workspace, no changes to chat/Canvas/Factory routing.
  const css=document.createElement('style');
  css.textContent='.wae-collab-launch{border:1px solid #344f75;border-radius:12px;background:#102139;color:#def5ff;padding:9px 13px;font:600 12px system-ui;cursor:pointer}.wae-collab-panel{position:fixed;inset:0;z-index:999999;background:#05090ddb;display:grid;place-items:center;padding:16px}.wae-collab-box{width:min(100%,720px);max-height:90dvh;overflow:auto;background:#101820;color:#f1f6ff;border:1px solid #40617c;border-radius:18px;padding:18px;font:14px system-ui;box-shadow:0 24px 70px #0009}.wae-collab-box h2{margin:0 0 8px;font-size:19px}.wae-collab-box label{display:grid;gap:5px;margin:9px 0}.wae-collab-box input,.wae-collab-box textarea{box-sizing:border-box;width:100%;border:1px solid #3c5267;background:#07111b;color:#f1f6ff;border-radius:10px;padding:11px;font:14px system-ui}.wae-collab-box textarea{min-height:36vh;resize:vertical}.wae-collab-box button{padding:9px 13px;margin:4px 4px 4px 0;border:1px solid #4677a9;background:#183552;color:#fff;border-radius:10px;cursor:pointer}.wae-collab-box small{color:#a8c6da;line-height:1.5}.wae-collab-box .wae-collab-status{font-size:12px;color:#b7dfff;min-height:20px}.wae-collab-key{overflow-wrap:anywhere;font:12px ui-monospace,monospace;padding:7px;background:#07111b;border-radius:9px}';
  document.head.append(css);
  const mount=()=>{
    if(document.getElementById('waeCollabLauncher'))return;
    const trigger=document.createElement('button');trigger.id='waeCollabLauncher';trigger.type='button';trigger.className='wae-collab-launch';trigger.textContent='Colaborar en vivo';
    const host=document.querySelector('#drawer')||document.querySelector('main')||document.body;
    host.append(trigger);
    trigger.onclick=()=>{
      const overlay=document.createElement('section');overlay.className='wae-collab-panel';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Colaboración WAE');
      overlay.innerHTML='<div class="wae-collab-box"><button type="button" data-action="close" style="float:right">Cerrar ×</button><h2>WAE · Sala colaborativa</h2><small>Documento temporal con actualización en vivo. No es Google Docs: se borra cuando Render reinicia o después de 2 horas sin actividad. No escribas secretos ni datos sensibles.</small><div><button type="button" data-action="create">Crear sala</button><button type="button" data-action="join">Unirme</button></div><label>ID de sala<input data-field="room" autocomplete="off" spellcheck="false" placeholder="ID recibido del creador"></label><label>Clave compartida<input data-field="key" autocomplete="off" spellcheck="false" type="password" placeholder="Clave recibida del creador"></label><button type="button" data-action="copy" hidden>Copiar invitación</button><p class="wae-collab-status" aria-live="polite">Conecta una sala para editar conjuntamente.</p><label>Documento compartido<textarea data-field="text" disabled placeholder="Contenido compartido"></textarea></label><small>Edición concurrente con control de versiones. Si otra persona edita tu misma versión, se conserva tu borrador y se muestra un conflicto.</small><div><button type="button" data-action="save" disabled>Guardar cambios</button><button type="button" data-action="reload" disabled>Recargar versión compartida</button></div></div>';
      document.body.append(overlay);
      const pick=name=>overlay.querySelector('[data-field="'+name+'"]'),button=name=>overlay.querySelector('[data-action="'+name+'"]'),msg=overlay.querySelector('.wae-collab-status'),editor=pick('text');
      let room='',key='',version=0,dirty=false,serverText='',abort,saveTimer,closed=false;
      const status=text=>{msg.textContent=text};
      const auth=()=>({'authorization':'Bearer '+key});
      const dispose=()=>{closed=true;clearTimeout(saveTimer);abort?.abort();overlay.remove()};
      button('close').onclick=dispose;
      overlay.addEventListener('click',e=>{if(e.target===overlay)dispose()});
      const api=async(action,payload={})=>{
        const url='/api/collab'+(room?'?room='+encodeURIComponent(room):'');
        const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(key?auth():{})},body:JSON.stringify({action,...payload}),cache:'no-store'});
        const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'collab_unavailable'),{status:response.status,data});return data;
      };
      const update=state=>{
        if(!state||state.room!==room)return;
        version=state.version;serverText=state.text;
        if(dirty&&editor.value!==serverText){status('Otra persona actualizó la sala; conserva tu borrador y resuelve el conflicto antes de guardar.');button('reload').disabled=false;return}
        editor.value=serverText;dirty=false;status('En vivo · versión '+version+' · '+state.viewers+' lectores conectados');button('reload').disabled=false;
      };
      const stream=async()=>{
        abort?.abort();abort=new AbortController();
        try{
          const response=await fetch('/api/collab?room='+encodeURIComponent(room)+'&events=1',{headers:auth(),signal:abort.signal,cache:'no-store'});
          if(!response.ok||!response.body)throw Error('stream_unavailable');
          const reader=response.body.getReader(),decoder=new TextDecoder();let raw='';
          while(!closed&&!abort.signal.aborted){
            const {done,value}=await reader.read();if(done)break;
            raw+=decoder.decode(value,{stream:true});if(raw.length>150000)raw='';
            let idx;while((idx=raw.indexOf('\n\n'))!==-1){
              const chunk=raw.slice(0,idx);raw=raw.slice(idx+2);
              const dataLine=chunk.split('\n').find(line=>line.startsWith('data: '));
              if(!dataLine)continue;
              try{update(JSON.parse(dataLine.slice(6)))}catch{}
            }
          }
        }catch(error){if(!abort.signal.aborted&&!closed)status('Sin transmisión; usa Recargar para sincronizar.')}
      };
      const join=async()=>{
        room=pick('room').value.trim();key=pick('key').value.trim();if(!/^[a-f0-9]{20}$/.test(room)||!/^[A-Za-z0-9_-]{32}$/.test(key)){status('ID o clave inválidos.');return}
        try{
          const response=await fetch('/api/collab?room='+encodeURIComponent(room),{headers:auth(),cache:'no-store'});
          const data=await response.json();if(!response.ok)throw Error(data.error||'room_unavailable');
          editor.disabled=false;button('save').disabled=false;button('reload').disabled=false;
          dirty=false;update(data);void stream();
        }catch(error){status('No se pudo unir: '+error.message)}
      };
      button('create').onclick=async()=>{
        try{
          room='';key='';const data=await api('create');room=data.room;key=data.accessKey;pick('room').value=room;pick('key').value=key;button('copy').hidden=false;status('Sala temporal creada · comparte ID y clave solo con tu equipo.');await join();
        }catch(e){status('No se pudo crear sala: '+e.message)}
      };
      button('join').onclick=join;
      button('copy').onclick=()=>{if(!room||!key)return;navigator.clipboard?.writeText('Sala WAE\nID: '+room+'\nClave: '+key+'\n'+location.origin).then(()=>status('Invitación copiada. Comparte solo con tu equipo.')).catch(()=>status('Copia el ID y la clave manualmente.'))};
      const save=async()=>{
        if(!dirty)return;
        const contents=editor.value;if(contents.length>40000){status('Máximo 40 000 caracteres.');return}
        try{const data=await api('save',{version,text:contents});dirty=false;update(data)}
        catch(e){status(e.status===409?'Conflicto de edición: tu borrador sigue intacto. Usa Recargar solo si deseas descartarlo.':'No se guardó: '+e.message)}
      };
      editor.addEventListener('input',()=>{dirty=true;status('Borrador local sin guardar');clearTimeout(saveTimer);saveTimer=setTimeout(save,850)});
      button('save').onclick=()=>{clearTimeout(saveTimer);void save()};
      button('reload').onclick=async()=>{
        if(dirty&&!confirm('¿Descartar tus cambios locales y leer la versión de la sala?'))return;
        try{const response=await fetch('/api/collab?room='+encodeURIComponent(room),{headers:auth(),cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'room_unavailable');dirty=false;update(data)}catch(e){status('No se pudo recargar: '+e.message)}
      };
    };
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
