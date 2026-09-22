/* Universal Canvas v1 adapter for the distinct Render native mobile shell. */
(() => {
  'use strict';
  if(window.__waeNativeCanvasV1) return;
  const $ = id => document.getElementById(id);
  const storageKey=()=> 'wae.nativeCanvas.'+(localStorage.getItem('iu.conversationId')||'default');
  const previousKey=()=>storageKey()+'.previous';
  const historyKey=()=>storageKey()+'.history';
  let busy=false;
  const css=document.createElement('style');
  css.textContent=[
    '.wae-native-canvas{position:fixed;inset:0;z-index:10000;display:none;background:#0b0c0f;color:#f6f7f8;font-family:system-ui,sans-serif;grid-template-rows:auto auto auto minmax(0,1fr);height:100dvh;overflow:hidden}',
    '.wae-native-canvas.open{display:grid}',
    '.wae-native-canvas header{height:auto;min-height:50px;padding:9px;display:flex;align-items:center;gap:8px;background:#12171b;position:relative}',
    '.wae-native-canvas header strong{flex:1;font-size:13px}',
    '.wae-native-canvas button{background:#202c26;color:#e6fff1;border:1px solid #456957;border-radius:9px;padding:8px 11px;font:600 12px system-ui,sans-serif;min-height:37px}',
    '.wae-native-canvas button:disabled{opacity:.55}',
    '.wae-native-canvas textarea,.wae-native-canvas input,.wae-native-canvas select{width:100%;box-sizing:border-box;background:#101a16;color:white;border:1px solid #456957;border-radius:8px;padding:8px;font:12px/1.5 system-ui,sans-serif}',
    '.wae-native-canvas .wae-build{display:grid;gap:6px;padding:8px;border-bottom:1px solid #2a4437}',
    '.wae-native-canvas .wae-build textarea{height:54px;resize:vertical}',
    '.wae-native-canvas .wae-build-row{display:flex;gap:6px;align-items:center}',
    '.wae-native-canvas .wae-build-row>*{min-width:0}',
    '.wae-native-canvas #wncCreate{background:#90f5bd;color:#0a2516;font-weight:800}',
    '.wae-native-canvas #wncStatus{font-size:11px;min-height:12px;color:#c7d9ce}',
    '.wae-native-canvas .wae-view-tabs{display:flex;gap:7px;padding:7px}',
    '.wae-native-canvas .wae-view-tabs button[aria-selected="true"]{background:#9af1c3;color:#082218}',
    '.wae-native-canvas .wae-surface{min-height:0;overflow:hidden}',
    '.wae-native-canvas #wncPreview{background:white;width:100%;height:100%;border:0}',
    '.wae-native-canvas #wncCode{display:none;height:100%;resize:none;font:12px/1.6 ui-monospace,monospace}',
    '.wae-native-canvas[data-tab="code"] #wncPreview{display:none}',
    '.wae-native-canvas[data-tab="code"] #wncCode{display:block}',
    '@media(prefers-reduced-motion:reduce){.wae-native-canvas *{scroll-behavior:auto!important;animation:none!important}}'
  ].join('\n');
  document.head.appendChild(css);

  const button=document.createElement('button');
  button.type='button';button.id='wncOpen';button.innerHTML='<span>Canvas Premium</span><small>Landing · Presentación · Dashboard</small>';
  const sheet=document.querySelector('.sheet');
  if(sheet)sheet.appendChild(button);

  const root=document.createElement('section');
  root.id='waeNativeCanvas';
  root.className='wae-native-canvas';
  root.dataset.tab='preview';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-label','Canvas Premium');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-hidden','true');
  root.innerHTML='<header><button id="wncClose" type="button" aria-label="Cerrar Canvas">←</button><strong>✦ Canvas Premium</strong><button id="wncRestore" type="button">↶ Anterior</button><button id="wncExport" type="button">Exportar</button></header>'
    +'<div class="wae-build"><textarea id="wncBrief" placeholder="Describe el producto: marca, público, objetivo y estilo." maxlength="3500" aria-label="Encargo"></textarea>'
    +'<div class="wae-build-row"><select id="wncKind" aria-label="Tipo"><option value="landing">Landing</option><option value="presentation">Presentación</option><option value="dashboard">Dashboard</option><option value="app">Aplicación</option><option value="website">Sitio web</option><option value="ecommerce">E-commerce</option><option value="report">Informe</option></select>'
    +'<input id="wncBrand" placeholder="Marca (opcional)" maxlength="100" aria-label="Marca"><button id="wncCreate" type="button">Crear</button></div>'
    +'<button id="wncRefine" type="button">↻ Perfeccionar el producto actual</button>'
    +'<div id="wncStatus" role="status" aria-live="polite">Editor, vista previa y exportación HTML.</div></div>'
    +'<div class="wae-view-tabs"><button type="button" data-wnc-tab="preview" aria-selected="true">Vista previa</button><button type="button" data-wnc-tab="code" aria-selected="false">Código editable</button></div>'
    +'<div class="wae-surface"><iframe id="wncPreview" title="Vista previa del producto" sandbox="allow-scripts"></iframe><textarea id="wncCode" spellcheck="false" aria-label="HTML editable"></textarea></div>';
  document.body.appendChild(root);
  const status=(text,error=false)=>{const el=$('wncStatus');el.textContent=text;el.style.color=error?'#ffaaa6':'#c7d9ce';};
  const show=()=>{
    root.classList.add('open');
    root.setAttribute('aria-hidden','false');
    $('wncCode').value=localStorage.getItem(storageKey())||$('wncCode').value||'';
    $('wncPreview').srcdoc=$('wncCode').value;
    document.body.style.overflow='hidden';
    document.getElementById('sheetBackdrop')?.classList.remove('open');
  };
  const hide=()=>{root.classList.remove('open');root.setAttribute('aria-hidden','true');document.body.style.overflow='';};
  const kindFrom=text=>{
    const q=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/\b(presentacion|diapositivas|pitch deck)\b/.test(q))return 'presentation';
    if(/\b(dashboard|tablero|panel de control)\b/.test(q))return 'dashboard';
    if(/\b(tienda|ecommerce|e-commerce|catalogo|shop)\b/.test(q))return 'ecommerce';
    if(/\b(informe|reporte|report)\b/.test(q))return 'report';
    if(/\b(sitio web|website|portal|micrositio)\b/.test(q))return 'website';
    if(/\b(aplicacion|prototipo)\b/.test(q))return 'app';
    return 'landing';
  };
  const productRequest=text=>{
    const q=String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    return /^(crea|haz|construye|disena|genera|necesito|quiero|prepara|desarrolla)\b/.test(q)
      && /\b(landing|pagina web|sitio web|website|portal|presentacion|diapositivas|pitch deck|dashboard|tablero|panel de control|aplicacion|prototipo|tienda|ecommerce|e-commerce|catalogo|informe|reporte)\b/.test(q);
  };
  async function create(refine=false) {
    if(busy)return;
    const request=$('wncBrief').value.trim();
    if(request.length<8)return status('Describe el producto antes de generar.',true);
    if(refine && (!/^\s*<!doctype\s+html/i.test($('wncCode').value)||$('wncCode').value.length>100000)) return status('Abre un HTML5 válido de hasta 100 KB antes de revisarlo.',true);
    busy=true;$('wncCreate').disabled=true;$('wncRefine').disabled=true;
    const before=$('wncCode').value;
    status('Especialistas → diseño → construcción → QA. Tu archivo actual se conserva.');
    try{
      const res=await fetch('/api/canvas',{
        method:'POST',headers:{'content-type':'application/json'},
        credentials:'same-origin',
        body:JSON.stringify({request,kind:$('wncKind').value,brand:$('wncBrand').value,baseHtml:refine?before:'',sessionId:localStorage.getItem('iu.conversationId')||''}),
        signal:AbortSignal.timeout(145000)
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok||data.quality?.structural!=='passed'||!data.html)throw new Error(data.message||'El producto no pasó la validación.');
      if($('wncCode').value!==before)throw new Error('Cambiaste el editor durante la generación. No reemplacé tu trabajo.');
      try{
        if(before&&before!==data.html){
          const previous=JSON.parse(localStorage.getItem(historyKey())||'[]');
          if(!Array.isArray(previous))throw Error('invalid_history');
          localStorage.setItem(historyKey(),JSON.stringify([...previous,{html:before,at:Date.now()}].slice(-6)));
          localStorage.setItem(previousKey(),before);
        }
        localStorage.setItem(storageKey(),data.html);
        if(localStorage.getItem(storageKey())!==data.html)throw Error('not_persisted');
      }catch{throw new Error('No hay espacio para guardar: exporta el proyecto anterior antes de reemplazarlo.');}
      $('wncCode').value=data.html;$('wncPreview').srcdoc=data.html;
      root.dataset.tab='preview';
      root.querySelectorAll('[data-wnc-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.wncTab==='preview')));
      status('Producto '+(data.revision?'perfeccionado':'generado')+' y guardado · estructura validada. Comprueba controles y diseño antes de publicar.');
    }catch(e){status('Se conservó tu versión anterior. '+String(e.message||'Error de conexión.'),true)}
    finally{busy=false;$('wncCreate').disabled=false;$('wncRefine').disabled=false;}
  }
  $('wncOpen')?.addEventListener('click',show);
  $('wncClose').addEventListener('click',hide);
  $('wncCreate').addEventListener('click',()=>create(false));
  $('wncRefine').addEventListener('click',()=>create(true));
  root.querySelectorAll('[data-wnc-tab]').forEach(b=>b.addEventListener('click',()=>{
    root.dataset.tab=b.dataset.wncTab;
    root.querySelectorAll('[data-wnc-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
  }));
  $('wncCode').addEventListener('input',()=>{
    $('wncPreview').srcdoc=$('wncCode').value;
    try{localStorage.setItem(storageKey(),$('wncCode').value);status('Edición guardada localmente.')}catch{status('No se pudo guardar; exporta el archivo.',true)}
  });
  $('wncRestore').addEventListener('click',()=>{
    if(busy)return status('Hay una generación en curso.',true);
    let history=[];
    try{history=JSON.parse(localStorage.getItem(historyKey())||'[]')}catch{}
    const previous=Array.isArray(history)&&history.length?history[history.length-1]?.html:localStorage.getItem(previousKey());
    if(!previous)return status('No hay versión anterior.',true);
    if(!confirm('¿Restaurar la versión anterior?'))return;
    const current=$('wncCode').value;
    try{
      if(Array.isArray(history)&&history.length)localStorage.setItem(historyKey(),JSON.stringify(history.slice(0,-1)));
      localStorage.setItem(storageKey(),previous);localStorage.setItem(previousKey(),current)
    }
    catch{return status('No se pudo respaldar la versión actual.',true)}
    $('wncCode').value=previous;$('wncPreview').srcdoc=previous;
    status('Versión anterior restaurada.');
  });
  $('wncExport').addEventListener('click',()=>{
    const html=$('wncCode').value;if(!html)return status('No hay HTML para exportar.',true);
    const u=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    const a=document.createElement('a');a.href=u;a.download='wae-canvas.html';a.click();
    setTimeout(()=>URL.revokeObjectURL(u),3000);
    status('Exportación HTML iniciada.');
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.classList.contains('open'))hide()});
  document.addEventListener('submit',event=>{
    if(event.target?.id!=='composer')return;
    const text=$('input')?.value||'';
    if(!productRequest(text))return;
    $('wncBrief').value=text;$('wncKind').value=kindFrom(text);
    show();create(false);
  },true);
  window.__waeNativeCanvasV1={open:show,create,version:'1'};
})();