(()=>{
  'use strict';
  if(window.__WAE_REFERENCE_INTERFACE_V108__)return;
  window.__WAE_REFERENCE_INTERFACE_V108__={version:'reference-interface/v108'};

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const DEFAULT_RX=/Sistema listo\.\s*Investiga, programa, analiza, diseña o escribe directamente lo que necesitas\.?/i;

  function normalizeHeader(){
    const brand=$('.topbar .brand');
    if(brand){brand.innerHTML='<div><strong>Universal Core</strong><span>operativo</span></div>'}
    if(!$('#waeRefNew')){
      const plus=document.createElement('button');plus.id='waeRefNew';plus.type='button';plus.className='wae-ref-topbtn wae-ref-new';plus.textContent='＋';plus.setAttribute('aria-label','Nueva conversación');
      plus.addEventListener('click',()=>$('#newChatBtn')?.click());$('.topbar')?.appendChild(plus);
    }
    if(!$('#waeRefMenu')){
      const menu=document.createElement('button');menu.id='waeRefMenu';menu.type='button';menu.className='wae-ref-topbtn wae-ref-menu';menu.textContent='•••';menu.setAttribute('aria-label','Abrir menú');
      menu.addEventListener('click',()=>$('#menuBtn')?.click());$('.topbar')?.appendChild(menu);
    }
  }

  function normalizeLanding(){
    const heading=$('.chat-heading');
    if(heading){
      const title=$('h1',heading),copy=$(':scope > p:last-child',heading);
      if(title)title.textContent='¿En qué trabajamos?';
      if(copy)copy.textContent='Analiza, crea, investiga, programa y organiza desde una sola conversación.';
    }
    const cards=$$('.capability-card');
    const spec=[['analysis','Analizar'],['code','Construir'],['research','Investigar']];
    spec.forEach(([mode,label],i)=>{
      const card=cards[i];if(!card)return;card.dataset.mode=mode;
      const strong=card.querySelector('strong');if(strong)strong.textContent=label;
    });
    cards.slice(3).forEach(card=>card.setAttribute('aria-hidden','true'));
  }

  function normalizeComposer(){
    const input=$('#messageInput');if(input)input.placeholder='Pregunta lo que quieras';
    const pill=$('#modePill');if(pill&&pill.textContent!=='Auto')pill.textContent='Auto';
    const attach=$('#attachBtn');if(attach){attach.textContent='＋';attach.title='Adjuntar'}
    const voice=$('#voiceBtn');if(voice){voice.textContent='⌁';voice.title='Voz'}
    const send=$('.send-btn');if(send){send.textContent=send.hasAttribute('aria-busy')?'■':'↑'}
  }

  function stripDefaultGreeting(){
    $$('.message.assistant').forEach(node=>{if(DEFAULT_RX.test(node.textContent||''))node.remove()});
    try{
      const rows=JSON.parse(localStorage.getItem('wae.messages')||'[]');
      if(Array.isArray(rows)){
        const filtered=rows.filter(x=>!(x?.role==='assistant'&&DEFAULT_RX.test(String(x?.text||''))));
        if(filtered.length!==rows.length)localStorage.setItem('wae.messages',JSON.stringify(filtered));
      }
    }catch{}
  }

  function syncConversationState(){
    stripDefaultGreeting();
    const meaningful=$$('.message').some(node=>{
      const t=(node.textContent||'').trim();
      return t&&!DEFAULT_RX.test(t)&&node.id!=='typingMessage';
    });
    document.documentElement.classList.toggle('wae-ref-conversation',meaningful);
    normalizeComposer();
  }

  function ensureDisclaimer(){
    if($('#waeRefDisclaimer'))return;
    const el=document.createElement('div');el.id='waeRefDisclaimer';el.className='wae-ref-disclaimer';
    el.textContent='Universal Core puede cometer errores. Verifica la información importante.';
    document.body.appendChild(el);
  }

  function init(){
    document.title='Universal Core';
    normalizeHeader();normalizeLanding();normalizeComposer();stripDefaultGreeting();ensureDisclaimer();syncConversationState();

    const pill=$('#modePill');
    if(pill)new MutationObserver(()=>{if(pill.textContent!=='Auto')pill.textContent='Auto'}).observe(pill,{childList:true,subtree:true,characterData:true});

    const send=$('.send-btn');
    if(send)new MutationObserver(()=>{send.textContent=send.hasAttribute('aria-busy')?'■':'↑'}).observe(send,{attributes:true,attributeFilter:['aria-busy','disabled']});

    const messages=$('#messages');
    if(messages){
      let timer=null;
      new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(syncConversationState,24)}).observe(messages,{childList:true,subtree:true,characterData:true});
    }

    window.addEventListener('wae:visible-response-ready',syncConversationState);
    setTimeout(syncConversationState,250);setTimeout(syncConversationState,900);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
