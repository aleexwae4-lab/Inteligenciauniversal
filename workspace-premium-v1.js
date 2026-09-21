(()=>{
'use strict';
const $=s=>document.querySelector(s),toast=s=>window.toast?.(s);
function dl(name,content,mime){const b=content instanceof Blob?content:new Blob([content],{type:mime||'text/plain;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
function name(){return ($('#iuDocName')?.value||'universal-core-documento').trim().replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,60)||'documento'}
function blocks(){
 const editor=$('#documentEditor');if(!editor)return [];
 const items=[];for(const e of editor.querySelectorAll('h1,h2,h3,p,li,blockquote,pre,table')){
  if(e.closest('table')&&e.tagName!=='TABLE'||e.closest('li')&&e.tagName!=='LI')continue;
  let s=e.tagName==='TABLE'?[...e.querySelectorAll('tr')].map(r=>[...r.querySelectorAll('th,td')].map(c=>c.textContent.trim()).join(' | ')).join('\n'):e.textContent.trim();
  if(!s||e.classList.contains('placeholder-line'))continue;
  const tag=e.tagName.toLowerCase();items.push({type:tag==='blockquote'?'quote':tag==='table'?'p':tag,text:s});
 }
 if(!items.length&&editor.textContent.trim())items.push({type:'p',text:editor.textContent.trim()});
 return items;
}
function md(items){return items.map(x=>x.type==='h1'?'# '+x.text:x.type==='h2'?'## '+x.text:x.type==='h3'?'### '+x.text:x.type==='li'?'- '+x.text:x.type==='quote'?'> '+x.text:x.text).join('\n\n')+'\n'}
function rtf(value){let s='{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\fs22 ';for(const ch of value){let n=ch.codePointAt(0);if(ch==='\\'||ch==='{'||ch==='}')s+='\\'+ch;else if(ch==='\n')s+='\\par ';else if(n>127)s+='\\u'+(n>32767?n-65536:n)+'?';else s+=ch}return s+'}'}
function docHtml(){return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Universal Core</title><style>body{max-width:850px;margin:40px auto;padding:0 22px;color:#18242a;font:16px/1.6 Arial,sans-serif}h1,h2,h3{line-height:1.2}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:8px}pre{white-space:pre-wrap}</style></head><body>'+($('#documentEditor')?.innerHTML||'')+'</body></html>'}
async function exportDocument(fmt){
 const data=blocks(),filename=name();if(!data.length)return toast('Escribe un documento para exportar.');
 if(fmt==='html')return dl(filename+'.html',docHtml(),'text/html;charset=utf-8');
 if(fmt==='txt')return dl(filename+'.txt',data.map(x=>x.text).join('\n\n'));
 if(fmt==='md')return dl(filename+'.md',md(data),'text/markdown;charset=utf-8');
 if(fmt==='rtf')return dl(filename+'.rtf',rtf(data.map(x=>x.text).join('\n\n')),'application/rtf');
 const btn=$('#iuExportGo');btn.disabled=true;btn.textContent='Generando…';
 try{
  const r=await fetch('/api/export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({format:fmt,filename,blocks:data})});
  if(!r.ok)throw Error('HTTP '+r.status);
  dl(filename+'.'+fmt,await r.blob(),fmt==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document');toast('Archivo '+fmt.toUpperCase()+' descargado.');
 }catch(e){console.warn('Export error',e);toast('No se pudo descargar. Inténtalo de nuevo.')}
 finally{btn.disabled=false;btn.textContent='Descargar'}
}
const baseStyle='*{box-sizing:border-box}body{margin:0;background:#0c1514;color:#edf7f1;font:16px/1.5 system-ui,sans-serif}.wrap{max-width:1100px;margin:0 auto;padding:40px 22px}h1{font-size:clamp(2.4rem,6vw,5rem);line-height:1.05}p{color:#b1c5bb}.accent{color:#65edb8}.btn{background:#63ecbb;color:#092118;padding:13px 19px;border:0;border-radius:12px;display:inline-block;text-decoration:none;font-weight:700;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:15px}.card{padding:24px;border-radius:19px;background:#193026;border:1px solid #2b5a44}.hero{padding:65px 0}@media(max-width:600px){.hero{padding:45px 0}}';
function wrap(body){return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WAE Canvas</title><style>'+baseStyle+'</style></head><body>'+body+'</body></html>'}
function template(kind){
 if(kind==='slides')return wrap('<div class="wrap"><div class="accent">PRESENTACIÓN HTML · WAE OS</div><section class="hero"><h1 id="heading">Una idea que transforma</h1><p id="body">Primera diapositiva.</p></section><button class="btn" id="back">←</button> <button class="btn" id="next">Siguiente →</button> <span id="count">1 / 3</span></div><script>const data=[["Una idea que transforma","Primera diapositiva."],["El problema","Explica el contexto y la oportunidad."],["La solución","Presenta tu propuesta y el siguiente paso."]];let n=0;function paint(){document.querySelector("#heading").textContent=data[n][0];document.querySelector("#body").textContent=data[n][1];document.querySelector("#count").textContent=(n+1)+" / 3"}document.querySelector("#next").onclick=()=>{n=Math.min(2,n+1);paint()};document.querySelector("#back").onclick=()=>{n=Math.max(0,n-1);paint()};</script>');
 if(kind==='prototype')return wrap('<div class="wrap"><div class="accent">PROTOTIPO INTERACTIVO</div><section class="hero"><h1 id="title">Bienvenido</h1><p id="body">Pulsa el botón para probar el flujo.</p><button class="btn" id="next">Continuar →</button></section></div><script>let n=0;const steps=[["Bienvenido","Pulsa el botón para probar el flujo."],["Personalizar","Esta es la segunda pantalla."],["Confirmación","El flujo ha terminado."]];document.querySelector("#next").onclick=()=>{n=(n+1)%3;document.querySelector("#title").textContent=steps[n][0];document.querySelector("#body").textContent=steps[n][1]}</script>');
 if(kind==='dashboard')return wrap('<div class="wrap"><div class="accent">DASHBOARD · DATOS ILUSTRATIVOS</div><h1>Panel ejecutivo</h1><div class="grid"><article class="card"><h2>Ingresos</h2><p>$120,000 · Ejemplo</p></article><article class="card"><h2>Clientes</h2><p>240 · Ejemplo</p></article><article class="card"><h2>Proyectos</h2><p>12 · Ejemplo</p></article></div></div>');
 if(kind==='blank')return wrap('<div class="wrap"><h1>Tu Canvas HTML</h1><p>Comienza a construir aquí.</p></div>');
 return wrap('<div class="wrap"><header class="accent">WAE OS · LANDING PAGE</header><section class="hero"><h1>Tu próximo gran producto.</h1><p>Explica tu propuesta de valor con claridad, diseño y propósito.</p><a class="btn" href="#contacto">Comenzar →</a></section><div class="grid"><article class="card"><h2>Innovación</h2><p>Describe el primer beneficio.</p></article><article class="card"><h2>Confianza</h2><p>Describe el segundo beneficio.</p></article><article class="card"><h2>Resultados</h2><p>Describe el tercero.</p></article></div><section class="hero" id="contacto"><h2>Contáctanos</h2><p>Añade aquí tu formulario o contacto.</p></section></div>');
}
function getHTML(raw){
 const fence=String(raw).match(/\x60{3}(?:html)?\s*([\s\S]*?)\x60{3}/i);
 const text=(fence?fence[1]:raw).trim(),start=text.search(/<!doctype\s+html|<html\b|<(?:main|section|div)\b/i);
 const html=start<0?'':text.slice(start);
 if(!/<\/(?:html|main|section|div)>/i.test(html))return '';
 return /<!doctype\s+html|<html\b/i.test(html)?html:wrap(html);
}
async function generate(){
 const prompt=$('#iuCanvasBrief').value.trim(),kind=$('#iuCanvasType').value,button=$('#iuCanvasGenerate');
 if(!prompt)return toast('Describe el artefacto que quieres construir.');if(button.disabled)return;
 button.disabled=true;button.textContent='Generando…';
 const request=['Devuelve exclusivamente HTML completo <!doctype html> ... </html>, sin explicaciones ni Markdown.','Crea una experiencia totalmente funcional, responsiva y accesible con CSS y JavaScript integrados.','Sin CDN, librerías externas, servicios pagados ni claves. No inventes datos reales.','Tipo: '+kind+'.','Encargo: '+prompt].join('\n');
 try{
  const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:request,mode:'code',canvas:true,preferences:window.WAESettings?.getPromptSettings?.()||{},project:window.WAENavigation?.getProjectContext?.()||{}})});
  const d=await r.json();if(!r.ok||!d.reply)throw Error(d.error||'No hubo respuesta');
  const html=getHTML(d.reply);if(!html)throw Error('La respuesta no contenía HTML válido; reintenta.');
  const editor=$('#htmlEditor');editor.value=html;editor.dispatchEvent(new Event('input',{bubbles:true}));toast('HTML creado: edita y revisa la vista previa.');
 }catch(e){console.warn('Canvas generation',e);toast(String(e.message||'No se pudo generar HTML').slice(0,110))}
 finally{button.disabled=false;button.textContent='✦ Generar HTML'}
}
function initialize(){
 const doc=$('#panel-document .toolbar'),pane=$('#panel-html .code-pane'),exportBtn=$('#exportBtn');if(!doc||!pane)return;
 if(!$('#iuExportGo')){
  const bar=document.createElement('div');bar.className='iu-doc-export';bar.innerHTML='<input id="iuDocName" value="universal-core-documento" maxlength="60" aria-label="Nombre de archivo"><select id="iuExportFormat" aria-label="Formato"><option value="pdf">PDF</option><option value="docx">Word .docx</option><option value="txt">TXT</option><option value="md">Markdown</option><option value="html">HTML</option><option value="rtf">RTF</option></select><button type="button" id="iuExportGo">Descargar</button>';doc.after(bar);$('#iuExportGo').onclick=()=>exportDocument($('#iuExportFormat').value);
 }
 exportBtn?.addEventListener('click',e=>{e.stopImmediatePropagation();if($('.workspace-tabs button.active')?.dataset.tab==='html'){dl('wae-canvas.html',$('#htmlEditor').value,'text/html;charset=utf-8');toast('HTML descargado')}else{$('#iuDocExportBar');$('#iuExportFormat')?.focus()}},true);
 if(!$('#iuCanvasControls')){
  const ui=document.createElement('div');ui.id='iuCanvasControls';ui.innerHTML='<select id="iuCanvasType" aria-label="Tipo de Canvas"><option value="landing">Landing page</option><option value="slides">Presentación HTML</option><option value="prototype">Prototipo</option><option value="dashboard">Dashboard</option><option value="blank">Página en blanco</option></select><textarea id="iuCanvasBrief" rows="3" maxlength="1500" placeholder="Describe la landing page, presentación o prototipo que deseas crear…"></textarea><div class="iu-canvas-actions"><button id="iuCanvasTemplate" type="button">＋ Plantilla</button><button id="iuCanvasGenerate" type="button">✦ Generar HTML</button><button id="iuCanvasDownload" type="button">↓ Descargar HTML</button></div>';pane.querySelector('.pane-label')?.after(ui);
  $('#iuCanvasTemplate').onclick=()=>{const editor=$('#htmlEditor');if(editor.value.trim()&&!confirm('¿Reemplazar el HTML actual?'))return;editor.value=template($('#iuCanvasType').value);editor.dispatchEvent(new Event('input',{bubbles:true}));toast('Plantilla lista')};
  $('#iuCanvasGenerate').onclick=generate;$('#iuCanvasDownload').onclick=()=>dl('wae-canvas.html',$('#htmlEditor').value,'text/html;charset=utf-8');
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();