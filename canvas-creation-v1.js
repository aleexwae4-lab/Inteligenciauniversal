/* Universal Canvas Creation Engine v1: additive UI, preserves the existing chat/Workspace. */
(() => {
  'use strict';
  if (window.__waeCanvasCreationV1) return;
  const $ = (selector, root=document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const KIND = {
    landing:'Landing page', presentation:'Presentación', dashboard:'Dashboard', app:'Aplicación'
  };
  let busy = false, lastAutomatic = '', lastAutomaticAt = 0;
  const css = document.createElement('style');
  css.textContent = [
    '#panel-html .code-pane{grid-template-rows:auto auto minmax(0,1fr)}',
    '.wae-canvas-ai{border-bottom:1px solid rgba(127,191,153,.23);padding:9px;background:#0d1b17;color:#d4f5e1}',
    '.wae-canvas-ai summary{cursor:pointer;font-weight:750;font-size:12px;list-style:none;display:flex;gap:7px;justify-content:space-between}',
    '.wae-canvas-ai summary::after{content:"⌄";color:#8dfcc7}',
    '.wae-canvas-ai[open] summary{margin-bottom:8px}',
    '.wae-canvas-ai textarea,.wae-canvas-ai select,.wae-canvas-ai input{box-sizing:border-box;width:100%;background:#07120e;border:1px solid #426854;border-radius:9px;color:#f1fff6;padding:8px;font:12px/1.45 system-ui,sans-serif}',
    '.wae-canvas-ai textarea{min-height:56px;max-height:100px;resize:vertical}',
    '.wae-canvas-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0}',
    '.wae-canvas-ai button{width:100%;border:0;border-radius:9px;background:#8dfcc7;color:#092016;padding:9px;font-weight:800;font-size:12px;cursor:pointer}',
    '.wae-canvas-ai button:disabled{opacity:.58;cursor:wait}',
    '.wae-canvas-status{font:11px/1.35 system-ui,sans-serif;min-height:14px;margin-top:6px;color:#aecbbb}',
    '.wae-canvas-preview-button{float:right;color:#8dfcc7;border:1px solid #426854;border-radius:7px;background:#10241a;font-size:10px;padding:3px 7px;cursor:pointer}',
    '#panel-html.wae-canvas-full .code-pane{display:none!important}',
    '#panel-html.wae-canvas-full.split-panel.active{display:block!important}',
    '#panel-html.wae-canvas-full .preview-pane{width:100%;height:100%;display:grid;grid-template-rows:auto minmax(0,1fr)}',
    '@media(max-width:899px){.wae-canvas-ai{padding:7px}.wae-canvas-ai textarea{min-height:46px}.wae-canvas-ai[open] summary{margin-bottom:5px}}'
  ].join('\n');
  document.head.appendChild(css);

  function workspaceHtml() {
    $('#workspaceBtn')?.click();
    const tab = $('.workspace-tabs button[data-tab="html"]');
    if (tab && !tab.classList.contains('active')) tab.click();
  }

  function setStatus(message, error=false) {
    const el = $('#waeCanvasStatus');
    if (el) {
      el.textContent = message;
      el.style.color = error ? '#ffb4a9' : '#aecbbb';
    }
  }

  function detectKind(message) {
    const q=String(message).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if (/\b(presentacion|diapositivas|pitch deck|slides)\b/.test(q)) return 'presentation';
    if (/\b(dashboard|tablero|panel de control|cuadro de mando)\b/.test(q)) return 'dashboard';
    if (/\b(app|aplicacion|prototipo|interfaz)\b/.test(q)) return 'app';
    return 'landing';
  }

  function productRequest(text) {
    const q=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    return /^(crea|haz|construye|disena|genera|necesito|quiero|prepara|desarrolla|construyeme|generame)\b/.test(q)
      && /\b(landing|pagina web|pagina de venta|presentacion|diapositivas|pitch deck|dashboard|tablero|panel de control|aplicacion|prototipo)\b/.test(q);
  }

  async function create(request, kind, brand='', automatic=false) {
    if (busy) return;
    const prompt=String(request||'').trim();
    if (prompt.length<8) {setStatus('Describe el producto que deseas construir.',true);return;}
    busy=true;
    const action=$('#waeCanvasCreate');
    if(action){action.disabled=true;action.textContent='Construyendo producto…';}
    setStatus('Consejo de especialistas → diseño → construcción → validación. Conservamos tu versión anterior.');
    if (automatic) workspaceHtml();
    try {
      const response=await fetch('/api/canvas',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        body:JSON.stringify({request:prompt,kind,brand,sessionId:localStorage.getItem('iu.conversationId')||''}),
        signal:AbortSignal.timeout(145000)
      });
      const data=await response.json().catch(()=>({}));
      if (!response.ok || !data.html || data.quality?.structural!=='passed') {
        throw new Error(data.message||'La creación no superó la validación. Tu Canvas anterior permanece intacto.');
      }
      const editor=$('#htmlEditor');
      const preview=$('#htmlPreview');
      if (!editor || !preview) throw new Error('El editor Canvas no está disponible.');
      editor.value=data.html;
      editor.dispatchEvent(new Event('input',{bubbles:true}));
      // Reuse the existing Save action, rather than fork the persistence model.
      $('#saveBtn')?.click();
      const repaired=data.quality.repaired ? ' · QA corrigió estructura' : '';
      setStatus(KIND[data.kind]+' generado y guardado · estructura validada'+repaired+'. Revisa el diseño en móvil y escritorio.');
      if (automatic) workspaceHtml();
    } catch(error) {
      setStatus('No se reemplazó tu trabajo: '+String(error.message||'Error de conexión.'),true);
    } finally {
      busy=false;
      if(action){action.disabled=false;action.textContent='✦ Crear producto premium';}
    }
  }

  function injectUi() {
    const pane=$('#panel-html .code-pane');
    if(!pane || $('#waeCanvasAi')) return;
    const details=document.createElement('details');
    details.id='waeCanvasAi';
    details.className='wae-canvas-ai';
    details.open=true;
    details.innerHTML='<summary>✦ Motor creativo multiagente <span>Canvas Pro</span></summary>'
      +'<textarea id="waeCanvasBrief" aria-label="Describe el producto" placeholder="Ej. Landing premium para una cafetería artesanal: marca, público, oferta, tono y contacto." maxlength="3500"></textarea>'
      +'<div class="wae-canvas-grid"><select id="waeCanvasKind" aria-label="Tipo de producto"><option value="landing">Landing page</option><option value="presentation">Presentación</option><option value="dashboard">Dashboard</option><option value="app">Aplicación</option></select>'
      +'<input id="waeCanvasBrand" aria-label="Nombre de marca" placeholder="Marca (opcional)" maxlength="100"></div>'
      +'<button id="waeCanvasCreate" type="button">✦ Crear producto premium</button>'
      +'<div id="waeCanvasStatus" class="wae-canvas-status" role="status" aria-live="polite">Diseño, negocio, color, UX, ingeniería y QA.</div>';
    const label=$('.pane-label',pane);
    if (label) label.insertAdjacentElement('afterend',details); else pane.prepend(details);
    $('#waeCanvasCreate').addEventListener('click',()=>create(
      $('#waeCanvasBrief').value, $('#waeCanvasKind').value, $('#waeCanvasBrand').value
    ));
    const previewLabel=$('#panel-html .preview-pane .pane-label');
    if (previewLabel && !$('#waeCanvasPreviewToggle')) {
      const toggle=document.createElement('button');
      toggle.id='waeCanvasPreviewToggle';
      toggle.className='wae-canvas-preview-button';
      toggle.type='button';
      toggle.textContent='Ampliar vista';
      toggle.addEventListener('click',()=>{
        const full=$('#panel-html').classList.toggle('wae-canvas-full');
        toggle.textContent=full?'Volver al editor':'Ampliar vista';
      });
      previewLabel.appendChild(toggle);
    }
  }

  function autoFromChat(text) {
    if (!productRequest(text)) return;
    const value=String(text).trim(),now=Date.now();
    if (value===lastAutomatic && now-lastAutomaticAt<2500) return;
    lastAutomatic=value;lastAutomaticAt=now;
    injectUi();
    $('#waeCanvasBrief').value=value;
    $('#waeCanvasKind').value=detectKind(value);
    create(value,detectKind(value),'',true);
  }

  document.addEventListener('submit',event=>{
    if(event.target?.id!=='composer') return;
    const text=$('#messageInput')?.value || $('#mobileSafeInput')?.value || '';
    autoFromChat(text);
  },true);
  document.addEventListener('click',event=>{
    if(!event.target?.closest?.('#mobileSafeSend'))return;
    const text=$('#mobileSafeInput')?.value || $('#messageInput')?.value || '';
    autoFromChat(text);
  },true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',injectUi,{once:true});
  else injectUi();
  window.__waeCanvasCreationV1={create,detectKind,version:'1'};
})();
