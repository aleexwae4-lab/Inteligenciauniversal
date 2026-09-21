/* Universal Core Render · semantic answer cards/charts. No external libraries or remote execution. */
(()=>{
'use strict';
if(window.WAEAnswerWidgets)return;
const $=(q,r=document)=>r.querySelector(q);
const el=(tag,cls,content)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(content!==undefined)node.textContent=String(content);
  return node;
};
const clean=(value,max=180)=>String(value??'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,max);
function actionButton(action,article,context){
  if(!action||typeof action!=='object')return null;
  const type=clean(action.type,20),label=clean(action.label,40);
  if(!['copy','workspace','ask'].includes(type)||!label)return null;
  const button=el('button','iu-widget-action',label);button.type='button';
  button.addEventListener('click',async()=>{
    if(type==='ask'){
      const input=$('#messageInput'),value=clean(action.prompt||context,600);
      if(!input||!value)return;
      input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();return;
    }
    if(type==='workspace'){
      const editor=$('#documentEditor');if(!editor)return;
      editor.textContent=clean(context,1200);
      editor.dispatchEvent(new Event('input',{bubbles:true}));
      $('#workspaceBtn')?.click();
      $('.workspace-tabs [data-tab="document"]')?.click();return;
    }
    const value=clean(action.value||context,2000);
    if(!value)return;
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);
      else{
        const field=el('textarea');field.value=value;field.style.cssText='position:fixed;left:-10000px';
        document.body.appendChild(field);field.select();
        const ok=document.execCommand('copy');field.remove();if(!ok)throw Error('copy_failed');
      }
      button.textContent='Copiado ✓';
    }catch{window.toast?.('No se pudo copiar');}
  });
  return button;
}
function card(data,article){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid_card');
  const title=clean(data.title,105),description=clean(data.description,650);
  if(!title)throw Error('missing_title');
  const box=el('section','iu-widget iu-widget-card');box.setAttribute('aria-label',title);
  const top=el('div','iu-widget-head');const heading=el('div','iu-widget-heading');
  const eyebrow=clean(data.eyebrow,50);if(eyebrow)heading.append(el('small','iu-widget-eyebrow',eyebrow));
  heading.append(el('h3','iu-widget-title',title));top.append(heading);
  const badge=clean(data.badge,32);if(badge)top.append(el('span','iu-widget-badge',badge));
  box.append(top);if(description)box.append(el('p','iu-widget-description',description));
  const metrics=Array.isArray(data.metrics)?data.metrics.slice(0,3):[];
  if(metrics.length){
    const grid=el('div','iu-widget-metrics');
    for(const metric of metrics){
      if(!metric||typeof metric!=='object')continue;
      const label=clean(metric.label,42),value=clean(metric.value,52);
      if(!label||!value)continue;
      const item=el('div','iu-widget-metric');
      item.append(el('small','iu-widget-metric-label',label),el('strong','iu-widget-metric-value',value));
      grid.append(item);
    }
    if(grid.childElementCount)box.append(grid);
    if(data.basis!=='user')box.append(el('small','iu-widget-disclaimer','Valores ilustrativos; no son datos reales verificados.'));
  }
  const actions=Array.isArray(data.actions)?data.actions.slice(0,3):[];
  if(actions.length){
    const row=el('div','iu-widget-actions');
    const context=[title,description].filter(Boolean).join('\n');
    for(const a of actions){const b=actionButton(a,article,context);if(b)row.append(b);}
    if(row.childElementCount)box.append(row);
  }
  return box;
}
function chart(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid_chart');
  const title=clean(data.title,105),items=Array.isArray(data.data)?data.data.slice(0,8):[];
  if(!title||!items.length)throw Error('empty_chart');
  const rows=items.map(x=>({label:clean(x?.label,60),value:Number(x?.value)})).filter(x=>x.label&&Number.isFinite(x.value)&&x.value>=0&&x.value<=1_000_000_000);
  if(!rows.length)throw Error('empty_chart');
  const max=Math.max(...rows.map(x=>x.value),1);
  const box=el('figure','iu-widget iu-widget-chart');
  box.append(el('figcaption','iu-widget-title',title));
  const graph=el('div','iu-widget-bars');graph.setAttribute('role','img');
  graph.setAttribute('aria-label',title+'. '+rows.map(r=>r.label+': '+r.value).join('; '));
  for(const row of rows){
    const line=el('div','iu-widget-bar-row');
    line.append(el('span','iu-widget-bar-label',row.label));
    const track=el('div','iu-widget-bar-track'),bar=el('span','iu-widget-bar-fill');
    bar.style.width=(row.value/max*100).toFixed(2)+'%';track.append(bar);line.append(track);
    line.append(el('span','iu-widget-bar-value',row.value.toLocaleString('es-MX')));
    graph.append(line);
  }
  box.append(graph);
  if(data.basis!=='user')box.append(el('small','iu-widget-disclaimer','Gráfico de demostración; cifras no verificadas.'));
  const note=clean(data.note,160);if(note)box.append(el('small','iu-widget-note',note));
  return box;
}
function enhance(){
  const root=$('#messages');if(!root)return;
  for(const block of root.querySelectorAll('pre[data-wae-block]:not([data-wae-done])')){
    block.dataset.waeDone='1';
    const raw=block.querySelector('code')?.textContent||'';
    if(raw.length>12_000)continue;
    try{
      const value=JSON.parse(raw),article=block.closest('.message.assistant');
      const node=block.dataset.waeBlock==='card'?card(value,article):block.dataset.waeBlock==='chart'?chart(value):null;
      if(node)block.replaceWith(node);
    }catch{ /* Keep original escaped code visible if the model supplied invalid JSON. */ }
  }
}
function start(){
  const root=$('#messages');if(!root)return;
  enhance();
  new MutationObserver(enhance).observe(root,{childList:true,subtree:true});
}
window.WAEAnswerWidgets=Object.freeze({card,chart,enhance});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();