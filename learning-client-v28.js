(()=>{
  'use strict';
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const SID='iu.sessionId',SECRET='iu.sessionSecret',CID='iu.conversationId';
  const RATED='iu.learning.rated.v28';
  let bootPromise=null,lastStatus=null;

  const toast=m=>window.toast?.(m);
  const readRated=()=>{try{return JSON.parse(localStorage.getItem(RATED)||'{}')}catch{return{}}};
  const writeRated=x=>localStorage.setItem(RATED,JSON.stringify(x));
  const session=()=>({session_id:localStorage.getItem(SID)||'',session_secret:localStorage.getItem(SECRET)||''});
  async function edge(payload){
    const r=await fetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-learning-client/2.8'},body:JSON.stringify(payload),cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`learning_${r.status}`);
    return data;
  }
  async function bootstrap(){
    const s=session();if(s.session_id&&s.session_secret)return s;
    if(bootPromise)return bootPromise;
    bootPromise=edge({action:'bootstrap',...s}).then(data=>{
      if(!data.session_id||!data.session_secret)throw new Error('learning_bootstrap_failed');
      localStorage.setItem(SID,data.session_id);localStorage.setItem(SECRET,data.session_secret);return session();
    }).finally(()=>{bootPromise=null});
    return bootPromise;
  }
  function injectStyle(){
    if(document.getElementById('iuLearningStyle'))return;
    const s=document.createElement('style');s.id='iuLearningStyle';s.textContent=`
      .iu-learn-actions{display:inline-flex;align-items:center;gap:4px;margin-left:4px}.iu-learn-actions button{width:auto!important;min-width:34px;height:30px!important;padding:0 8px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#8f98a4!important;font-size:11px!important}.iu-learn-actions button:hover,.iu-learn-actions button:active{background:#1c2027!important;color:#eef2f5!important}.iu-learn-actions button.active{background:#1b2924!important;color:#79e8a4!important}.iu-learn-actions button.negative.active{background:#2d1d20!important;color:#ffb4b4!important}.iu-learning-row{display:flex;justify-content:space-between;gap:14px;padding:11px 12px;color:#d9dee4;font-size:12px}.iu-learning-row small{color:#7f8996}.iu-learning-badge{font-size:10px;color:#79e8a4;white-space:nowrap}`;document.head.appendChild(s);
  }
  function latestRuntime(){return window.__iuLastRuntime||{};}
  function assistantTurns(){return [...document.querySelectorAll('.turn.assistant,.message.assistant')].filter(x=>x.id!=='typingMessage');}
  function actionsFor(turn){return turn.querySelector('.actions,.answer-actions');}
  function bodyFor(turn){return turn.querySelector('.assistant-body,.rich-answer');}
  function hydrateLatest(data=latestRuntime()){
    const turns=assistantTurns();if(!turns.length)return;
    const turn=turns[turns.length-1];
    if(data?.message_id)turn.dataset.iuMessageId=String(data.message_id);
    if(data?.conversation_id)turn.dataset.iuConversationId=String(data.conversation_id);
    else if(localStorage.getItem(CID))turn.dataset.iuConversationId=localStorage.getItem(CID);
    addActions(turn);
  }
  async function rate(turn,rating){
    const messageId=turn.dataset.iuMessageId||'';
    const conversationId=turn.dataset.iuConversationId||localStorage.getItem(CID)||'';
    if(!messageId&&!conversationId){toast('Esta respuesta todavía no tiene señal de aprendizaje');return}
    const key=messageId||`conversation:${conversationId}`;
    const rated=readRated();
    try{
      const s=await bootstrap();
      const result=await edge({action:'feedback',...s,message_id:messageId||undefined,conversation_id:conversationId||undefined,rating});
      rated[key]=rating;writeRated(rated);turn.dataset.iuRated=String(rating);
      syncButtons(turn);
      document.documentElement.dataset.learning='active';
      toast(rating>0?`Aprendizaje registrado · ${result.training_examples||0} ejemplos`:'Señal de mejora registrada');
      refreshStatus().catch(()=>{});
    }catch(e){console.warn('[Universal Core Learning]',e?.message||e);toast('No pude registrar el aprendizaje en este intento')}
  }
  function syncButtons(turn){
    const box=turn.querySelector('.iu-learn-actions');if(!box)return;
    const value=Number(turn.dataset.iuRated||0);
    box.querySelector('[data-rating="1"]')?.classList.toggle('active',value===1);
    box.querySelector('[data-rating="-1"]')?.classList.toggle('active',value===-1);
  }
  function addActions(turn){
    const actions=actionsFor(turn),body=bodyFor(turn);if(!actions||!body||turn.querySelector('.iu-learn-actions'))return;
    if(body.classList.contains('error-text')||/No pude completar|vuelve a intentarlo/i.test(body.textContent||''))return;
    const box=document.createElement('span');box.className='iu-learn-actions';
    const good=document.createElement('button');good.type='button';good.dataset.rating='1';good.textContent='Útil';good.setAttribute('aria-label','Marcar respuesta como útil');good.addEventListener('click',()=>rate(turn,1));
    const bad=document.createElement('button');bad.type='button';bad.dataset.rating='-1';bad.className='negative';bad.textContent='Mejorar';bad.setAttribute('aria-label','Marcar respuesta para mejorar');bad.addEventListener('click',()=>rate(turn,-1));
    box.append(good,bad);actions.appendChild(box);
    const rated=readRated(),key=turn.dataset.iuMessageId||`conversation:${turn.dataset.iuConversationId||''}`;if(rated[key])turn.dataset.iuRated=String(rated[key]);syncButtons(turn);
  }
  function scan(){for(const turn of assistantTurns())addActions(turn);hydrateLatest()}
  function installStatusRow(){
    if(document.getElementById('iuLearningRow'))return;
    const sheet=document.querySelector('.sheet'),drawer=document.querySelector('#drawer');
    const row=document.createElement('div');row.id='iuLearningRow';row.className='iu-learning-row';row.innerHTML='<span>Aprendizaje adaptativo</span><small id="iuLearningState">Activo</small>';
    if(sheet)sheet.appendChild(row);else if(drawer){row.style.margin='8px 14px';drawer.appendChild(row)}
  }
  async function refreshStatus(){
    const s=await bootstrap();const data=await edge({action:'learning_status',...s});lastStatus=data;document.documentElement.dataset.learning='active';
    const el=document.getElementById('iuLearningState');if(el)el.textContent=`${Number(data.training_examples||0)} ejemplos · ${Number(data.feedback||0)} señales`;
    window.dispatchEvent(new CustomEvent('wae:learning-status',{detail:data}));return data;
  }
  window.addEventListener('wae:stream-event',e=>{if(e.detail?.event==='response.complete')hydrateLatest(e.detail.data||{})});
  window.addEventListener('wae:enhancement-ready',()=>scan());
  function install(){injectStyle();installStatusRow();scan();const root=document.querySelector('#messages');if(root)new MutationObserver(scan).observe(root,{childList:true,subtree:true});setTimeout(()=>refreshStatus().catch(()=>{}),700)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
  window.__waeLearning={rate,refresh:refreshStatus,get status(){return lastStatus},version:'adaptive-training-v28'};
})();
