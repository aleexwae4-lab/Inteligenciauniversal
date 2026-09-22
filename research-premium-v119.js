(()=>{
  const mount=()=>{
    if(document.querySelector('#waeResearchLauncher'))return;
    const button=document.createElement('button');button.type='button';button.id='waeResearchLauncher';button.className='wae-collab-launch';button.textContent='Investigar fuentes';
    const host=document.querySelector('#drawer')||document.querySelector('main')||document.body;host.append(button);
    button.onclick=()=>{
      const shade=document.createElement('section');shade.className='wae-collab-panel';shade.setAttribute('role','dialog');shade.setAttribute('aria-modal','true');
      shade.innerHTML='<div class="wae-collab-box"><button type="button" data-close style="float:right">Cerrar ×</button><h2>WAE · Investigación con fuentes</h2><small>Web actual solo cuando el proveedor esté configurado. OpenAlex muestra metadatos académicos; Wikimedia es una referencia enciclopédica, no noticias en vivo.</small><label>Buscar fuentes<input data-query placeholder="Pregunta o tema de investigación" maxlength="280"></label><label>Origen<select data-mode style="width:100%;padding:10px;border-radius:9px;background:#07111b;color:#fff;border:1px solid #3c5267"><option value="auto">Automático</option><option value="web">Web actual (requiere proveedor)</option><option value="academic">Estudios académicos</option><option value="encyclopedia">Enciclopedia pública</option></select></label><button type="button" data-search>Buscar</button><p class="wae-collab-status" data-status aria-live="polite">Sin consulta.</p><div data-results style="display:grid;gap:10px"></div></div>';
      document.body.append(shade);
      const status=shade.querySelector('[data-status]'),results=shade.querySelector('[data-results]'),input=shade.querySelector('[data-query]'),mode=shade.querySelector('[data-mode]'),go=shade.querySelector('[data-search]');
      const close=()=>shade.remove();shade.querySelector('[data-close]').onclick=close;shade.addEventListener('click',e=>{if(e.target===shade)close()});
      go.onclick=async()=>{
        const query=input.value.trim();if(query.length<3){status.textContent='Escribe una consulta de al menos 3 caracteres.';return}
        go.disabled=true;status.textContent='Consultando el índice seleccionado…';results.replaceChildren();
        try{
          const r=await fetch('/api/research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query,mode:mode.value}),cache:'no-store',signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(15000):undefined});
          const data=await r.json();if(!r.ok||!data.ok){status.textContent=data.code==='general_web_not_configured'?'Búsqueda web general sin proveedor configurado; elige Estudios académicos o Enciclopedia.':data.error||'Índice no disponible.';return}
          status.textContent=(data.results||[]).length+' fuentes · '+data.provider+' · consulta '+new Date(data.checkedAt).toLocaleString('es-MX')+'. '+(data.limitation||'Una búsqueda no verifica automáticamente las afirmaciones.');
          for(const item of data.results||[]){
            let href;try{href=new URL(item.url);if(href.protocol!=='https:')continue}catch{continue}
            const box=document.createElement('article');box.style='border:1px solid #304253;border-radius:10px;padding:10px';
            const a=document.createElement('a');a.href=href.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title;a.style='color:#8acbff;overflow-wrap:anywhere;font-weight:700';
            const meta=document.createElement('small');meta.style.display='block';meta.textContent=(item.publishedAt?'Publicado: '+item.publishedAt+' · ':'')+'Consultado: '+new Date(item.retrievedAt).toLocaleString('es-MX')+' · '+item.scope;
            const snippet=document.createElement('p');snippet.textContent=item.snippet||'Abre la fuente original para verificar la afirmación.';snippet.style='font-size:12px;line-height:1.5';
            box.append(a,meta,snippet);results.append(box);
          }
        }catch(e){status.textContent='No se pudo consultar el índice. '+(e.name==='TimeoutError'?'Tiempo agotado.':'Revisa la conexión.')}
        finally{go.disabled=false}
      };
      input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go.click()}};
    };
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
