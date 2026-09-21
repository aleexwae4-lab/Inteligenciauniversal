(()=>{
'use strict';
const $=selector=>document.querySelector(selector);
const STORAGE='iu.canvas.revisions.v2';
const MAX_REVISIONS=5;
let history=[],generating=false,pendingAction=null;
let lastPreviewSource='',lastPreviewDevice='';
const notice=text=>{const el=$('#iuCanvasStatus');if(el)el.textContent=text;};
const toast=text=>window.toast?.(text);
const editor=()=>$('#htmlEditor');
const current=()=>editor()?.value||'';
function saveHistory(){
  try{localStorage.setItem(STORAGE,JSON.stringify(history.slice(-MAX_REVISIONS)))}catch(error){console.warn('[Canvas] no revision persistence',error)}
}
function remember(){
  const previous=current();
  if(!previous.trim()||previous===history[history.length-1])return;
  history.push(previous);
  if(history.length>MAX_REVISIONS)history.shift();
  saveHistory();updateUndo();
}
function updateUndo(){const b=$('#iuCanvasUndo');if(b)b.disabled=!history.length||generating}
function show(view){
  const panel=$('#panel-html');if(!panel)return;
  panel.dataset.iuView=view==='code'?'code':'preview';
  panel.querySelectorAll('[data-iu-canvas-view]').forEach(b=>{
    const selected=b.dataset.iuCanvasView===panel.dataset.iuView;
    b.setAttribute('aria-pressed',String(selected));b.classList.toggle('active',selected);
  });
  if(view!=='code')updatePreview();
}
function updatePreview(force=false){
  const panel=$('#panel-html'),frame=$('#htmlPreview'),selector=$('#iuCanvasDevice');
  if(!panel||!frame)return;
  const device=selector?.value||'responsive';
  frame.style.width=device==='desktop'?'980px':device==='mobile'?'min(390px, 100%)':'100%';
  frame.style.maxWidth=device==='desktop'?'none':'100%';
  frame.style.setProperty('--iu-preview-width',frame.style.width);
  // Preserve interactive slide/prototype state while switching modes without code changes.
  const source=current();
  if(!force&&source===lastPreviewSource&&device===lastPreviewDevice)return;
  lastPreviewSource=source;lastPreviewDevice=device;
  frame.srcdoc=window.WAECanvasPreparePreview?.(source)||source;
}
function apply(html,label){
  const old=current();
  if(old===html)return;
  remember();
  editor().value=html;
  editor().dispatchEvent(new Event('input',{bubbles:true}));
  $('#saveBtn')?.click();
  notice(label);
  show('preview');
  toast(label);
}
function undo(){
  if(generating)return;
  if(!history.length)return toast('No hay una versión anterior');
  const html=history.pop();
  saveHistory();updateUndo();
  editor().value=html;
  editor().dispatchEvent(new Event('input',{bubbles:true}));
  $('#saveBtn')?.click();notice('Versión anterior recuperada');show('code');
}
function closeConfirm(){
  const dialog=$('#iuCanvasConfirm');
  if(dialog?.open)dialog.close();
  pendingAction=null;
}
function ask(message,action){
  const dialog=$('#iuCanvasConfirm');
  if(!dialog)return;
  $('#iuCanvasConfirmText').textContent=message;
  pendingAction=action;dialog.showModal();
}
function validate(raw){
  const value=String(raw||'');
  const fence=value.match(/`{3}(?:html)?\s*([\s\S]*?)`{3}/i);
  let text=(fence?fence[1]:value).trim();
  const start=text.search(/<!doctype\s+html|<html\b|<(?:main|section|div)\b/i);
  if(start<0)return '';
  text=text.slice(start);
  const end=text.search(/<\/html\s*>/i);
  if(end>=0)return text.slice(0,end+text.slice(end).match(/^<\/html\s*>/i)[0].length);
  if(/<(?:!doctype\s+html|html\b)/i.test(text))return '';
  if(!/<\/(?:main|section|div)>/i.test(text))return '';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+text+'</body></html>';
}
function preparePreview(source){
  let value=String(source||'');
  if(!value.trim())return '';
  const viewport=/<meta\b[^>]*name\s*=\s*["']?viewport\b/i.test(value);
  if(!viewport){
    const meta='<meta name="viewport" content="width=device-width,initial-scale=1">';
    if(/<head\b[^>]*>/i.test(value))value=value.replace(/<head\b[^>]*>/i,match=>match+meta);
    else if(/<html\b[^>]*>/i.test(value))value=value.replace(/<html\b[^>]*>/i,match=>match+'<head>'+meta+'</head>');
  }
  const fallback='<style data-iu-preview="mobile-fallback">@media(max-width:700px){html,body{max-width:100%;overflow-x:auto}main,section,header,footer,nav,.container,.slide{max-width:100%}img,video,svg,canvas{max-width:100%;height:auto}pre{max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere}}</style>';
  if(/<\/head>/i.test(value))return value.replace(/<\/head>/i,fallback+'</head>');
  return value.replace(/<body\b[^>]*>/i,match=>fallback+match);
}
window.WAECanvasPreparePreview=preparePreview;
window.WAECanvasRefreshPreview=updatePreview;
window.WAECanvasValidateHTML=validate;
async function generate(){
  const brief=$('#iuCanvasBrief')?.value.trim(),kind=$('#iuCanvasType')?.value||'landing',operation=$('#iuCanvasOperation')?.value||'create';
  if(!brief)return toast('Describe la página, presentación o prototipo que quieres crear');
  if(generating)return;
  const existing=operation==='refine'?current():'';
  async function run(){
    generating=true;
    const button=$('#iuCanvasGenerate');button.disabled=true;button.textContent='Generando…';
    updateUndo();notice('Generando HTML con IA. Puedes seguir viendo el Canvas actual.');
    const mode={landing:'landing page completa',slides:'presentación con diapositivas navegables',prototype:'prototipo interactivo',dashboard:'dashboard editable',blank:'página HTML'}[kind]||kind;
    const instruction=[
      'Eres un desarrollador frontend senior. Responde ÚNICAMENTE un documento HTML autocontenido completo, comenzando por <!doctype html> y terminando en </html>.',
      'Construye '+mode+'; CSS y JavaScript integrados. No incluyas texto explicativo ni Markdown.',
      'Obligatorio: <meta name="viewport" content="width=device-width,initial-scale=1">. Mobile first, no desbordamiento horizontal; grids responsivos, ancho fluido y tamaños de texto legibles en teléfono.',
      'Los controles de un prototipo o presentación deben funcionar de verdad. Si hay formulario de ejemplo, etiquétalo como demostración; no simules envíos exitosos a un servidor.',
      'Sin CDNs, claves, librerías remotas ni fondos o imágenes que requieran red. No inventes métricas reales.',
      'Encargo concreto: '+brief
    ];
    if(existing)instruction.push('REFINA el siguiente HTML existente; conserva su propósito, diseño y comportamiento salvo que el usuario pida cambios. Devuelve TODO el documento HTML final actualizado, no un fragmento:\n'+existing.slice(0,9000));
    else instruction.push('Es una creación nueva. No reutilices otra página anterior.');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),95000);
    try{
      const response=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:instruction.join('\n\n'),mode:'code',canvas:true,preferences:window.WAESettings?.getPromptSettings?.()||{},project:window.WAENavigation?.getProjectContext?.()||{}}),signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.reply)throw Error(data.error||'El motor no entregó HTML');
      const html=validate(data.reply);
      if(!html)throw Error('El motor devolvió HTML incompleto. Conservé tu versión actual; puedes reintentar.');
      apply(html,operation==='refine'?'Canvas actualizado. Versión anterior disponible.':'Canvas generado. Revisa la vista previa.');
    }catch(error){
      console.warn('[Canvas generation]',error);
      const text=error.name==='AbortError'?'Tiempo de espera agotado. El HTML anterior está intacto.':String(error.message||'No se pudo generar HTML').slice(0,145);
      notice(text);toast(text);
    }finally{clearTimeout(timeout);generating=false;button.disabled=false;button.textContent='✦ Generar HTML';updateUndo();}
  }
  if(operation==='create'&&current().trim())ask('Se guardará una versión anterior y se generará una nueva página. ¿Continuar?',run);
  else run();
}
function loadTemplate(){
  if(generating)return;
  const use=()=>{
    const type=$('#iuCanvasType').value;
    // The template generator installed by Canvas v1 is reused; only confirmation is custom.
    const source=window.WAECanvasTemplates?.(type);
    if(!source)return toast('La plantilla no está disponible');
    apply(source,'Plantilla cargada. Puedes recuperar la versión anterior.');
  };
  if(current().trim())ask('La plantilla reemplazará el código visible. Puedes recuperar la versión anterior con Deshacer. ¿Continuar?',use);
  else use();
}
function init(){
 const panel=$('#panel-html'),pane=panel?.querySelector('.code-pane'),preview=panel?.querySelector('.preview-pane');
 if(!panel||!pane||!preview||$('#iuCanvasViewBar'))return;
 try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(saved))history=saved.filter(x=>typeof x==='string').slice(-MAX_REVISIONS)}catch(_){}
 const toolbar=document.createElement('div');toolbar.id='iuCanvasViewBar';toolbar.className='iu-canvas-viewbar';
 toolbar.innerHTML='<div class="iu-canvas-toggle" role="group" aria-label="Vista de Canvas"><button type="button" data-iu-canvas-view="code" aria-pressed="false">⌘ Editar</button><button type="button" data-iu-canvas-view="preview" aria-pressed="true">◉ Vista previa</button></div><select id="iuCanvasDevice" aria-label="Ancho de la vista previa"><option value="responsive">Ajustar</option><option value="mobile">Móvil</option><option value="desktop">Escritorio</option></select><button type="button" id="iuCanvasUndo" title="Recuperar versión anterior" aria-label="Deshacer último cambio de Canvas">↶</button>';
 panel.insertBefore(toolbar,pane);
 for(const b of toolbar.querySelectorAll('[data-iu-canvas-view]'))b.addEventListener('click',()=>show(b.dataset.iuCanvasView));
 $('#iuCanvasDevice').addEventListener('change',()=>updatePreview(true));
 $('#iuCanvasUndo').addEventListener('click',undo);
 const oldControls=$('#iuCanvasControls');
 const operation=document.createElement('select');operation.id='iuCanvasOperation';operation.setAttribute('aria-label','Tipo de generación');
 operation.innerHTML='<option value="create">Crear nuevo Canvas</option><option value="refine">Mejorar HTML actual</option>';
 oldControls.querySelector('#iuCanvasBrief').before(operation);
 const status=document.createElement('small');status.id='iuCanvasStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Edita o genera y alterna la vista sin perder el código.';
 oldControls.append(status);
 const dialog=document.createElement('dialog');dialog.id='iuCanvasConfirm';dialog.className='iu-canvas-confirm';
 dialog.innerHTML='<div class="iu-canvas-confirm-card"><h3>Confirmar cambio</h3><p id="iuCanvasConfirmText"></p><div class="iu-canvas-confirm-actions"><button type="button" id="iuCanvasCancel">Cancelar</button><button type="button" id="iuCanvasApply">Continuar</button></div></div>';
 $('#app').append(dialog);
 $('#iuCanvasCancel').addEventListener('click',closeConfirm);
 $('#iuCanvasApply').addEventListener('click',()=>{const action=pendingAction;closeConfirm();action?.()});
 dialog.addEventListener('cancel',()=>{pendingAction=null});
 $('#iuCanvasGenerate').onclick=generate;
 $('#iuCanvasTemplate').onclick=loadTemplate;
 $('#iuCanvasBrief').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();generate()}});
 panel.dataset.iuView='preview';
 updateUndo();show('preview');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();