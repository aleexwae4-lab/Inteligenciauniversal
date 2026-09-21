/* Universal Core premium action layer v117; augments the existing chat. */
(()=>{
  'use strict';
  if(window.__ucPremium117)return;
  const VERSION='117';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const notify=text=>window.toast?.(text);
  const legacyGreeting='**Sistema listo.** Investiga, programa, analiza, diseña o escribe directamente lo que necesitas.';
  let activeVoiceNode=null;
  let scheduled=false;
  const assistantSelector='.message.assistant:not(#typingMessage):not(#iuLiveStream),.turn.assistant';

  function messagesFromStorage(){
    try{
      const values=JSON.parse(localStorage.getItem('wae.messages')||'[]');
      return Array.isArray(values)?values.filter(m=>m&&m.role==='assistant'&&m.text!==legacyGreeting):[];
    }catch{return[]}
  }
  function responseText(node){
    const nodes=$$(assistantSelector,$('#messages')||document);
    const index=nodes.indexOf(node);
    const saved=messagesFromStorage();
    const offset=Math.max(0,saved.length-nodes.length);
    const record=saved[index+offset];
    if(record&&typeof record.text==='string'&&record.text.trim())return record.text.trim();
    const body=$('.rich-content,.rich-answer,.assistant-body',node);
    return (body?.innerText||body?.textContent||'').trim();
  }
  function compactFooter(){
    const footer=$('.runtime-bar');
    if(!footer||footer.querySelector('[data-uc117-brand]'))return;
    footer.classList.add('uc117-compact');
    footer.setAttribute('role','status');
    footer.setAttribute('aria-label','Universal Core');
    footer.innerHTML='<span class="uc117-status" aria-hidden="true"></span><strong data-uc117-brand>Universal Core</strong>';
  }
  function removeLegacyGreeting(){
    const list=Array.from($('#messages')?.children||[]);
    const hasUser=list.some(node=>node.matches?.('.message.user,.turn.user'));
    if(hasUser)return;
    for(const node of list){
      if(node.matches?.('.message.assistant,.turn.assistant')&&
         (node.innerText||node.textContent||'').includes('Sistema listo.')&&
         !(node.innerText||node.textContent||'').includes('Tú')){
        node.remove();
      }
    }
  }
  async function copyText(value){
    const raw=String(value||'');
    if(!raw)return notify('No hay texto para copiar');
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(raw);
      else{
        const area=document.createElement('textarea');
        area.value=raw;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';
        document.body.appendChild(area);area.select();
        const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('copy_not_supported');
      }
      notify('Respuesta copiada');
    }catch{notify('No se pudo copiar la respuesta')}
  }
  function openWorkspaceFrom(node){
    const editor=$('#documentEditor');
    const workspace=$('#workspace');
    const content=$('.rich-content,.rich-answer,.assistant-body',node);
    if(!editor||!workspace||!content)return notify('Workspace no disponible');
    editor.querySelector('.placeholder-line')?.remove();
    const section=document.createElement('section');
    section.className='workspace-ai-block';
    const title=document.createElement('h2');title.textContent='Universal Core';
    section.append(title,content.cloneNode(true));
    const sources=$('.iu-sources',node);
    if(sources)section.appendChild(sources.cloneNode(true));
    editor.appendChild(section);
    editor.dispatchEvent(new Event('input',{bubbles:true}));
    $('#workspaceBtn')?.click();
    if(!workspace.classList.contains('open')){
      workspace.classList.add('open');workspace.setAttribute('aria-hidden','false');
    }
    notify('Respuesta abierta en Workspace');
  }
  function renderVoiceLabels(){
    const enabled=(window.__waeVoice||window.__waeMobileVoice)?.enabled??(localStorage.getItem('wae.autoVoice')!=='false');
    $$('.uc117-actions').forEach(actions=>{
      const auto=$('[data-uc117="auto"]',actions);
      const listen=$('[data-uc117="listen"]',actions);
      const node=actions.closest('.message.assistant,.turn.assistant');
      if(auto){
        auto.textContent=enabled?'◉ Voz activada':'○ Voz desactivada';
        auto.setAttribute('aria-pressed',String(enabled));
      }
      if(listen){
        const speaking=activeVoiceNode===node;
        listen.textContent=speaking?'■ Detener voz':'▶ Escuchar';
        listen.setAttribute('aria-pressed',String(speaking));
      }
    });
    const main=$('#voiceBtn');if(main)main.setAttribute('aria-pressed',String(enabled));
  }
  async function toggleAutoVoice(){
    const voice=window.__waeVoice||window.__waeMobileVoice;
    if(voice?.setEnabled){
      try{const enabled=await voice.setEnabled(!voice.enabled);if(!enabled)activeVoiceNode=null;renderVoiceLabels();notify(enabled?'Voz automática activada':'Voz automática desactivada');return}
      catch{notify('No se pudo cambiar la preferencia de voz');return}
    }
    const enabled=localStorage.getItem('wae.autoVoice')==='false';
    localStorage.setItem('wae.autoVoice',String(enabled));
    if(!enabled&&'speechSynthesis'in window)speechSynthesis.cancel();
    renderVoiceLabels();
    notify(enabled?'Voz automática activada':'Voz automática desactivada');
  }
  async function listen(node,raw){
    const voice=window.__waeVoice||window.__waeMobileVoice;
    if(activeVoiceNode===node){
      activeVoiceNode=null;
      voice?.stop?.();
      if(!voice&&'speechSynthesis'in window)speechSynthesis.cancel();
      renderVoiceLabels();return;
    }
    if(activeVoiceNode)voice?.stop?.();
    activeVoiceNode=node;renderVoiceLabels();
    let temporarilyEnabled=false;
    try{
      if(voice?.speak){
        if(!voice.enabled&&voice===window.__waeMobileVoice){
          await voice.setEnabled(true);temporarilyEnabled=true;
          activeVoiceNode=node;renderVoiceLabels();
        }
        const playback=voice.speak(raw,{force:true});
        // The underlying engine emits "ready" when cancelling previous playback.
        // Assign the active node after this synchronous reset so Stop stays usable.
        activeVoiceNode=node;renderVoiceLabels();
        await playback;
      }else if(typeof window.speakAnswer==='function')window.speakAnswer(raw);
      else throw new Error('voice_unavailable');
    }catch{notify('La voz no está disponible en este dispositivo')}
    finally{
      if(temporarilyEnabled)await voice.setEnabled(false);
      if(activeVoiceNode===node){activeVoiceNode=null;renderVoiceLabels()}
    }
  }
  function action(kind,label,handler){
    const button=document.createElement('button');
    button.type='button';button.dataset.uc117=kind;button.textContent=label;
    button.addEventListener('click',handler);
    return button;
  }
  function decorate(node){
    if(!node?.isConnected)return;
    const existing=$('.uc117-actions',node);
    const body=$('.rich-content,.rich-answer,.assistant-body',node);
    if(!body||!body.textContent?.trim()||body.classList.contains('error-text')||body.querySelector('.typing'))return;
    const sourceBox=$('.iu-sources',node);
    const sourceLinks=sourceBox?$('a[href^="http"]',sourceBox):[];
    const attachSourceAction=actions=>{
      if(!sourceLinks.length||$('[data-uc117="sources"]',actions))return;
      actions.appendChild(action('sources','⌕ Fuentes ('+sourceLinks.length+')',()=>{
        sourceBox.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
      }));
    };
    const legacyRows=$('.answer-actions,.iu-answer-actions,.actions',node)
      .filter(row=>row!==existing&&!row.closest('.rich-content,.rich-answer,.assistant-body')
        &&!(node.matches('.turn.assistant')&&row.classList.contains('actions')));
    // Move real feedback controls, including click handlers, into the premium toolbar.
    const feedbackButtons=legacyRows.flatMap(row=>$$('button[data-feedback]',row));
    if(existing){
      attachSourceAction(existing);
      feedbackButtons.forEach(button=>existing.appendChild(button));
      legacyRows.forEach(row=>row.remove());
      return;
    }
    const raw=responseText(node);
    if(!raw||raw===legacyGreeting)return;
    const actions=document.createElement('div');
    actions.className='iu-answer-actions uc117-actions wae-actions';
    actions.setAttribute('role','group');
    actions.setAttribute('aria-label','Herramientas de respuesta');
    actions.append(
      action('copy','⧉ Copiar',()=>copyText(responseText(node))),
      action('listen','▶ Escuchar',()=>listen(node,responseText(node))),
      action('auto','○ Voz desactivada',toggleAutoVoice),
      action('workspace','◇ Workspace',()=>openWorkspaceFrom(node))
    );
    attachSourceAction(actions);
    feedbackButtons.forEach(button=>actions.appendChild(button));
    legacyRows.forEach(row=>row.remove());
    node.appendChild(actions);
    node.dataset.uc117Actions='true';
    renderVoiceLabels();
  }
  function refresh(){
    scheduled=false;compactFooter();removeLegacyGreeting();
    const messages=$('#messages');
    if(!messages)return;
    document.body.classList.toggle('iu-has-turns',!!$('.message.user,.turn.user',messages));
    $$(assistantSelector,messages).forEach(decorate);
  }
  function schedule(){
    if(scheduled)return;scheduled=true;setTimeout(refresh,40);
  }
  function init(){
    refresh();
    const messages=$('#messages');
    if(messages)new MutationObserver(schedule).observe(messages,{childList:true,subtree:true});
    const footer=$('.runtime-bar');
    if(footer)new MutationObserver(schedule).observe(footer,{childList:true,subtree:true,characterData:true});
    window.addEventListener('wae:voice-state',event=>{
      const state=event.detail?.state;
      if(state==='ready'||state==='disabled'||state==='error')activeVoiceNode=null;
      renderVoiceLabels();
    });
    window.addEventListener('storage',event=>{if(['wae.autoVoice','iu.voiceEnabled'].includes(event.key))renderVoiceLabels()});
    window.addEventListener('wae:visible-response-ready',schedule);
    window.addEventListener('wae:product-modules-ready',schedule);
    renderVoiceLabels();
  }
  window.__ucPremium117={version:VERSION,refresh:schedule,copyText,openWorkspaceFrom};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
