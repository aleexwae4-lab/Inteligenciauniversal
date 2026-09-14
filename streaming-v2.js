(()=>{
  const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=u=>{try{const x=new URL(String(u));return /^https?:$/.test(x.protocol)?x.href:null}catch{return null}};
  const state={article:null,content:'',pending:'',sources:new Map(),raf:0,complete:false,requestId:null,startedAt:0,spoken:false};

  function styles(){if(document.querySelector('#iuStreamingV2Styles'))return;const s=document.createElement('style');s.id='iuStreamingV2Styles';s.textContent=`
    .iu-streaming-preview{position:relative}.iu-streaming-preview .iu-stream-shell{display:grid;gap:10px}.iu-streaming-preview .iu-stream-state{display:flex;align-items:center;gap:8px;color:#7f858a;font-size:.68rem}.iu-streaming-preview .iu-stream-dot{width:7px;height:7px;border-radius:50%;background:currentColor;animation:iuPulse 1.1s ease-in-out infinite}.iu-streaming-preview[data-complete="true"] .iu-stream-dot{animation:none}.iu-streaming-preview .iu-stream-cursor{display:inline-block;width:.48em;height:1.05em;margin-left:2px;vertical-align:-.12em;background:currentColor;opacity:.65;animation:iuBlink .8s steps(2,end) infinite}.iu-streaming-preview[data-complete="true"] .iu-stream-cursor{display:none}.iu-streaming-preview .iu-stream-stop{margin-left:auto;border:1px solid #2a2e34;background:#15181c;color:#d9dddf;border-radius:9px;padding:6px 9px;font:inherit;cursor:pointer}.iu-streaming-preview .iu-stream-stop[hidden]{display:none}.iu-streaming-preview .iu-stream-sources{display:flex;gap:6px;flex-wrap:wrap}.iu-streaming-preview .iu-stream-sources a{font-size:.62rem;color:#a9b0b4;text-decoration:none;border:1px solid #292d31;border-radius:999px;padding:5px 8px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iu-streaming-preview[data-error="true"] .iu-stream-dot{color:#b47777;animation:none}@keyframes iuPulse{50%{opacity:.25;transform:scale(.72)}}@keyframes iuBlink{50%{opacity:0}}
  `;document.head.appendChild(s)}

  function messages(){return document.querySelector('#messages')}
  function ensure(){
    if(state.article?.isConnected)return state.article;
    const root=messages();if(!root)return null;
    document.querySelector('#iuStreamPreview')?.remove();
    const a=document.createElement('article');a.id='iuStreamPreview';a.className='message assistant iu-streaming-preview';a.dataset.premium='true';a.dataset.complete='false';
    a.innerHTML=`<div class="message-meta"><strong>${esc(localStorage.getItem('wae.coreName')||'Universal Core')}</strong><span>en vivo</span></div><div class="iu-stream-shell"><div class="rich-content iu-stream-content"></div><div class="iu-stream-state"><i class="iu-stream-dot"></i><span class="iu-stream-label">Preparando respuesta</span><button class="iu-stream-stop" type="button" hidden>Detener</button></div><div class="iu-stream-sources"></div></div>`;
    root.appendChild(a);state.article=a;
    a.querySelector('.iu-stream-stop')?.addEventListener('click',()=>{if(window.__iuStream?.cancel?.()){label('Deteniendo…');a.querySelector('.iu-stream-stop').hidden=true}});
    scroll();return a;
  }
  function label(text){const el=ensure()?.querySelector('.iu-stream-label');if(el)el.textContent=String(text||'Procesando')}
  function scroll(){requestAnimationFrame(()=>{const pane=document.querySelector('.chat-layout');if(pane)pane.scrollTop=pane.scrollHeight})}
  function render(){state.raf=0;if(state.pending){state.content+=state.pending;state.pending=''}const a=ensure();if(!a)return;const box=a.querySelector('.iu-stream-content');if(box){const html=window.__waeRich?.render?.(state.content,[...state.sources.values()]);if(html)box.innerHTML=`${html}<span class="iu-stream-cursor" aria-hidden="true"></span>`;else box.textContent=state.content}scroll()}
  function schedule(){if(!state.raf)state.raf=requestAnimationFrame(render)}
  function source(src){if(!src?.key)return;state.sources.set(String(src.key),src);const wrap=ensure()?.querySelector('.iu-stream-sources');if(!wrap)return;wrap.innerHTML='';for(const item of state.sources.values()){const u=safeUrl(item.url);if(!u)continue;const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${item.key} · ${item.title||item.host||'Fuente'}`;wrap.appendChild(a)}}
  function reset(data={}){if(state.raf)cancelAnimationFrame(state.raf);state.article?.remove();Object.assign(state,{article:null,content:'',pending:'',sources:new Map(),raf:0,complete:false,requestId:data.request_id||null,startedAt:performance.now(),spoken:false});const a=ensure();if(a){const stop=a.querySelector('.iu-stream-stop');stop.hidden=window.__iuStream?.canCancel!==true}label('Analizando')}
  function complete(data){if(state.pending)render();state.complete=true;const a=ensure();if(!a)return;a.dataset.complete='true';const final=String(data?.reply||state.content||'');if(final&&final!==state.content){state.content=final;const box=a.querySelector('.iu-stream-content');if(box)box.innerHTML=window.__waeRich?.render?.(final,data?.web_sources||[...state.sources.values()])||esc(final)}label(data?.cancelled?'Generación detenida':data?.stream_verified===false?'Respuesta completa':'Respuesta lista');a.querySelector('.iu-stream-stop')?.setAttribute('hidden','');scroll()}
  function fail(data){const a=ensure();if(!a)return;a.dataset.error='true';a.dataset.complete='true';label(data?.error==='client_cancelled'?'Generación detenida':'Continuidad activada');a.querySelector('.iu-stream-stop')?.setAttribute('hidden','')}

  const safeStatus={analizando:'Analizando',buscando:'Buscando fuentes',consultando:'Consultando datos','consultando datos':'Consultando datos','ejecutando herramienta':'Ejecutando herramienta',verificando:'Verificando', 'preparando respuesta':'Preparando respuesta'};
  window.addEventListener('wae:stream-event',event=>{
    const {event:name,data={}}=event.detail||{};
    if(name==='response.start'){reset(data);return}
    if(name==='reasoning.status'){label(safeStatus[String(data.status||'').toLowerCase()]||'Procesando');return}
    if(name==='source.add'){source(data);return}
    if(name==='content.delta'){document.querySelector('#typingMessage')?.remove();state.pending+=String(data.text||'');schedule();return}
    if(name==='speech.delta'){if(window.__waeVoice?.enabled&&typeof window.__waeVoice.enqueue==='function'){state.spoken=true;window.__waeVoice.enqueue(String(data.text||'')).catch(()=>{})}return}
    if(name==='response.complete'){complete(data);return}
    if(name==='response.error'){fail(data)}
  });

  function reconcile(){const root=messages();if(!root)return;const observer=new MutationObserver(()=>{if(!state.article?.isConnected||!state.complete)return;const assistants=[...root.querySelectorAll('.message.assistant:not(#typingMessage):not(#iuStreamPreview)')];if(assistants.length){const latest=assistants.at(-1);if(latest&&latest.dataset.messageId===state.article.dataset.messageId||latest){setTimeout(()=>state.article?.remove(),40)}}});observer.observe(root,{childList:true,subtree:true})}
  styles();document.readyState==='loading'?document.addEventListener('DOMContentLoaded',reconcile):reconcile();
  window.__iuStreamingUI={get active(){return !!state.article?.isConnected&&!state.complete},get content(){return state.content+state.pending}};
})();
