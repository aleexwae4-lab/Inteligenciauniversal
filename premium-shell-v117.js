(()=>{
'use strict';
if(window.__waePremiumActions117)return;
window.__waePremiumActions117={version:'v117'};
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
function autoVoiceEnabled(){
  if(window.__waeVoice&&typeof window.__waeVoice.enabled==='boolean')return window.__waeVoice.enabled;
  return localStorage.getItem('iu.voiceEnabled')!=='false'&&localStorage.getItem('wae.autoVoice')!=='false';
}
function syncVoiceControls(){
  const enabled=autoVoiceEnabled();
  const playing=document.documentElement.dataset.voicePlaying==='true';
  $$('[data-wae117="auto-voice"]').forEach(btn=>{
    btn.textContent=enabled?'◉ Voz activada':'◯ Activar voz';
    btn.setAttribute('aria-pressed',String(enabled));
    btn.title=enabled?'Desactivar lectura automática de nuevas respuestas':'Activar lectura automática de nuevas respuestas';
  });
  $$('.iu-answer-actions [data-act="listen"],.answer-actions .speak-answer').forEach(btn=>{
    btn.textContent=playing?'■ Detener voz':'▶ Escuchar';
    btn.setAttribute('aria-label',playing?'Detener lectura de voz':'Escuchar esta respuesta');
  });
}
function appendButton(bar,name,label,action){
  let btn=$('[data-wae117="'+name+'"]',bar);
  if(btn)return btn;
  btn=document.createElement('button');
  btn.type='button';btn.dataset.wae117=name;btn.textContent=label;
  btn.addEventListener('click',action);
  bar.appendChild(btn);return btn;
}
async function toggleVoice(){
  try{
    if(window.__waeVoice?.toggle)await window.__waeVoice.toggle();
    else if(window.__waeMobileVoice?.toggle)await window.__waeMobileVoice.toggle();
    else $('#voiceBtn')?.click();
  }catch{window.toast?.('No se pudo cambiar la voz en este dispositivo')}
  syncVoiceControls();
}
function openWorkspaceFor(article){
  const editor=$('#documentEditor');
  if(!editor)return window.toast?.('Workspace no disponible');
  const body=$('.rich-content,.rich-answer,.assistant-body',article);
  if(!body)return;
  editor.querySelector('.placeholder-line')?.remove();
  const section=document.createElement('section');
  section.className='workspace-ai-block';
  // Clone rendered, escaped answer markup; remove interactive controls.
  const cloned=body.cloneNode(true);
  $$('button,script,iframe,form,object,embed',cloned).forEach(el=>el.remove());
  section.append(...Array.from(cloned.childNodes));
  editor.appendChild(section);
  $('#saveState')?.replaceChildren(document.createTextNode('Cambios sin guardar'));
  $('#workspaceBtn')?.click();
  window.toast?.('Respuesta añadida al Workspace');
}
function decorate(article){
  if(!article||article.id==='typingMessage'||article.id==='iuLiveStream'||
    !article.classList.contains('assistant'))return;
  const bar=$('.iu-answer-actions,.answer-actions',article);
  if(!bar||bar.dataset.wae117==='ready')return;
  bar.dataset.wae117='ready';
  bar.classList.add('wae117-actions');
  const listen=$('[data-act="listen"],.speak-answer',bar);
  const copy=$('[data-act="copy"],.copy-answer',bar);
  const workspace=$('[data-act="workspace"]',bar);
  if(copy)copy.textContent='⧉ Copiar';
  if(workspace)workspace.textContent='◇ Workspace';
  if(!workspace)appendButton(bar,'workspace','◇ Workspace',()=>openWorkspaceFor(article));
  appendButton(bar,'auto-voice','◉ Voz activada',toggleVoice);
  const sources=$('.iu-sources',article);
  if(sources){
    const count=$$('a[href^="http"]',sources).length;
    if(count)appendButton(bar,'sources','⌕ Fuentes ('+count+')',()=>{
      sources.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
      sources.classList.remove('wae117-source-focus');
      void sources.offsetWidth;
      sources.classList.add('wae117-source-focus');
    });
  }
  if(listen)listen.title='Reproducir o detener esta respuesta';
  syncVoiceControls();
}
let scheduled=false;
function upgrade(){
  scheduled=false;
  $$('#messages .message.assistant').forEach(decorate);
  const badge=$('#wae117CoreBadge');
  if(badge)badge.setAttribute('aria-label','Universal Core');
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  setTimeout(upgrade,60);
}
function init(){
  const shell=$('.app-shell')||document.body;
  if(!$('#wae117CoreBadge')){
    const badge=document.createElement('div');
    badge.id='wae117CoreBadge';
    badge.className='wae117-core-badge';
    badge.setAttribute('aria-label','Universal Core');
    badge.innerHTML='<span class="wae117-core-dot" aria-hidden="true"></span><strong>Universal Core</strong>';
    shell.appendChild(badge);
  }
  const messages=$('#messages');
  if(messages)new MutationObserver(schedule).observe(messages,{childList:true,subtree:true});
  window.addEventListener('wae:voice-state',syncVoiceControls);
  upgrade();
  setTimeout(upgrade,550);
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();