(()=>{
  'use strict';
  const SELECTOR='.rich-content,.assistant-body';
  const GPT_EXPERIENCE_RELEASE='gpt-visible-response/v83';
  const text=v=>String(v??'').trim();
  const copy=async value=>{try{await navigator.clipboard.writeText(String(value||''));window.toast?.('Copiado')}catch{}}
  const labelForCode=code=>text(code?.dataset?.language||code?.getAttribute('data-language')||code?.className?.match(/language-([\w-]+)/)?.[1]||'Código');
  function rowsToText(table){return[...table.rows].map(r=>[...r.cells].map(c=>text(c.innerText)).join('\t')).join('\n')}
  function loadGptExperience(){
    if(window.__iuPremiumExperience||document.querySelector('script[data-wae-gpt-experience="v83"]'))return;
    const script=document.createElement('script');
    script.src='./gpt-experience-v1.js?v=83';
    script.async=false;
    script.dataset.waeGptExperience='v83';
    script.addEventListener('load',()=>{document.documentElement.dataset.waeVisibleResponse='v83';window.dispatchEvent(new CustomEvent('wae:visible-response-ready',{detail:{version:GPT_EXPERIENCE_RELEASE}}))},{once:true});
    document.head.appendChild(script);
  }
  function wrapCode(pre){if(!pre||pre.closest('.wae-code-shell'))return;const code=pre.querySelector('code');if(!code)return;const shell=document.createElement('section');shell.className='wae-code-shell';const bar=document.createElement('div');bar.className='wae-code-toolbar';const name=document.createElement('span');name.textContent=labelForCode(code);const btn=document.createElement('button');btn.type='button';btn.textContent='Copiar código';btn.addEventListener('click',()=>copy(code.innerText));bar.append(name,btn);pre.parentNode?.insertBefore(shell,pre);shell.append(bar,pre)}
  function wrapTable(table){if(!table||table.closest('.wae-table-shell'))return;let visual=table.closest('.iu-table-wrap');const shell=document.createElement('section');shell.className='wae-table-shell';const bar=document.createElement('div');bar.className='wae-table-toolbar';const name=document.createElement('span');name.textContent='Tabla';const btn=document.createElement('button');btn.type='button';btn.textContent='Copiar tabla';btn.addEventListener('click',()=>copy(rowsToText(table)));bar.append(name,btn);if(visual){visual.parentNode?.insertBefore(shell,visual);shell.append(bar,visual)}else{const scroll=document.createElement('div');scroll.className='wae-table-scroll';table.parentNode?.insertBefore(shell,table);shell.append(bar,scroll);scroll.append(table)}}
  function stagger(root){const items=[...root.children].filter(el=>!el.classList.contains('wae-table-toolbar')&&!el.classList.contains('wae-code-toolbar'));items.slice(0,28).forEach((el,i)=>{el.classList.add('wae-reveal');el.style.setProperty('--wae-delay',`${Math.min(220,i*22)}ms`)})}
  function decorate(root){if(!root||root.dataset.waePremium==='true')return;root.dataset.waePremium='true';root.classList.add('wae-premium-answer');const p=root.querySelector(':scope > p');if(p&&text(p.textContent).length>80)p.classList.add('wae-lead');root.querySelectorAll('pre').forEach(wrapCode);root.querySelectorAll('table').forEach(wrapTable);stagger(root);const host=root.closest('.message.assistant,.turn,.assistant-wrap');host?.querySelector('.iu-answer-actions,.actions')?.classList.add('wae-actions')}
  function upgrade(){document.querySelectorAll(SELECTOR).forEach(decorate);document.querySelectorAll('.iu-answer-actions,.actions').forEach(el=>el.classList.add('wae-actions'))}
  function observe(){const messages=document.querySelector('#messages');if(!messages)return;upgrade();let timer=null;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(upgrade,36)}).observe(messages,{childList:true,subtree:true,characterData:true})}
  function init(){document.documentElement.dataset.waePremiumRich='v43';loadGptExperience();observe();setTimeout(upgrade,250);setTimeout(upgrade,900)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
  window.__waePremiumRich={version:'v43',visibleResponse:GPT_EXPERIENCE_RELEASE,refresh:upgrade};
})();
