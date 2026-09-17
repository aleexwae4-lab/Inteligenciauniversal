(()=>{
  'use strict';
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const SID='iu.sessionId',SECRET='iu.sessionSecret',CID='iu.conversationId';
  const RATED='iu.learning.rated.v29';
  const FEEDBACK_CONTRACT='useful-feedback/v106';
  let bootPromise=null,lastStatus=null,historyPromise=null,lastHistoryCid='';

  const toast=m=>window.toast?.(m);
  const readRated=()=>{try{return JSON.parse(localStorage.getItem(RATED)||'{}')}catch{return{}}};
  const writeRated=x=>localStorage.setItem(RATED,JSON.stringify(x));
  const session=()=>({session_id:localStorage.getItem(SID)||'',session_secret:localStorage.getItem(SECRET)||''});
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[`*_#>|~\[\](){}:;,.!?¿¡"']/g,' ').replace(/\s+/g,' ').trim();
  async function edge(payload){
    const r=await fetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-learning-client/106'},body:JSON.stringify(payload),cache:'no-store'});
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
      .iu-learn-actions{display:inline-flex;align-items:center;gap:4px;margin-left:4px}.iu-learn-actions button{width:auto!important;min-width:34px;height:30px!important;padding:0 8px!important;border:0!important;border-radius:9px!important;background:transparent!important;color:#8f98a4!important;font-size:11px!important}.iu-learn-actions button:hover,.iu-learn-actions button:active{background:#1c2027!important;color:#eef2f5!important}.iu-learn-actions button.active{background:#1b2924!important;color:#79e8a4!important}.iu-learn-actions button.negative.active{background:#2d1d20!important;color:#ffb4b4!important}.iu-learning-row{display:grid;gap:6px;padding:11px 12px;color:#d9dee4;font-size:12px}.iu-learning-top{display:flex;justify-content:space-between;gap:14px}.iu-learning-row small{color:#7f8996}.iu-learning-track{height:4px;border-radius:99px;background:#232832;overflow:hidden}.iu-learning-track i{display:block;height:100%;background:#79e8a4;border-radius:99px;transition:width .25s ease}.iu-learning-meta{font-size:10px;color:#737d89;line-height:1.35}`;document.head.appendChild(s);
  }
  function latestRuntime(){return window.__iuLastRuntime||{};}
  function assistantTurns(){return [...document.querySelectorAll('.turn.assistant,.message.assistant')].filter(x=>x.id!=='typingMessage');}
  function actionsFor(turn){return turn.querySelector('.actions,.answer-actions');}
  function bodyFor(turn){return turn.querySelector('.assistant-body,.rich-answer');}
  function compatible(a,b){a=normalize(a);b=normalize(b);if(!a||!b)return false;if(a===b)return true;const n=Math.min(220,a.length,b.length);return n>=40&&(a.slice(0,n)===b.slice(0,n)||a.includes(b.slice(0,Math.min(120,b.length)))||b.includes(a.slice(0,Math.min(120,a.length))))}
  function hydrateLatest(data=latestRuntime()){
    const turns=assistantTurns();if(!turns.length)return;
    const turn=turns[turns.length-1];
    if(data?.message_id)turn.dataset.iuMessageId=String(data.message_id);
    if(data?.conversation_id)turn.dataset.iuConversationId=String(data.conversation_id);
    else if(localStorage.getItem(CID))turn.dataset.iuConversationId=localStorage.getItem(CID);
    addActions(turn);
  }
  async function hydrateHistoricalIds(force=false){
    const cid=localStorage.getItem(CID)||'';if(!cid)return 0;
    const turns=assistantTurns();if(!turns.length)return 0;
    if(!force&&cid===lastHistoryCid&&turns.every(t=>t.dataset.iuMessageId))return turns.length;
    if(historyPromise)return historyPromise;
    historyPromise=(async()=>{
      const s=await bootstrap();
      const data=await edge({action:'get_conversation',...s,conversation_id:cid});
      const messages=(Array.isArray(data.messages)?data.messages:[]).filter(m=>m?.role==='assistant'&&m?.id);
      const remaining=[...messages];let bound=0;
      for(let ti=turns.length-1;ti>=0;ti--){
        const turn=turns[ti];if(turn.dataset.iuMessageId)continue;
        const visible=bodyFor(turn)?.textContent||'';let match=-1;
        for(let mi=remaining.length-1;mi>=0;mi--){if(compatible(visible,remaining[mi]?.content||'')){match=mi;break}}
        if(match<0)continue;
        const [m]=remaining.splice(match,1);
        turn.dataset.iuMessageId=String(m.id);turn.dataset.iuConversationId=String(m.conversation_id||cid);turn.dataset.iuFeedbackBinding='exact-v106';syncButtons(turn);bound++;
      }
      lastHistoryCid=cid;document.documentElement.dataset.feedbackHistoryBinding=bound?'exact-v106':'partial';
      window.dispatchEvent(new CustomEvent('wae:feedback-history-bound',{detail:{version:FEEDBACK_CONTRACT,bound,total:turns.length,conversation_id:cid}}));
      return bound;
    })().catch(e=>{console.warn('[Universal Core Feedback History]',e?.message||e);return 0}).finally(()=>{historyPromise=null});
    return historyPromise;
  }
  function readinessOf(data){return data?.preferences?.learned_profile?.training_readiness||{};}
  function readinessCopy(r){
    const n=Number(r?.candidate_count||0),state=String(r?.state||'COLLECTING');
    if(state==='FINETUNE_DATASET_READY')return{label:`Dataset listo · ${n} ejemplos`,pct:100,meta:'Listo para evaluar fine-tuning externo; no implica que el modelo base ya haya sido reentrenado.'};
    if(state==='PREFERENCE_READY')return{label:`Optimización de preferencias · ${n} ejemplos`,pct:Math.min(99,Math.round(n/50*100)),meta:`Faltan ${Number(r?.next_finetune_at||0)} ejemplos positivos para el gate de dataset.`};
    if(state==='EXEMPLAR_READY')return{label:`Exemplar RAG activo · ${n} ejemplos`,pct:Math.min(80,Math.round(n/12*100)),meta:`Faltan ${Number(r?.next_preference_at||0)} ejemplos para optimización de preferencias.`};
    if(state==='ADAPTIVE_MEMORY')return{label:`Memoria adaptativa · ${n} ejemplo${n===1?'':'s'}`,pct:Math.min(66,Math.round(n/3*100)),meta:`Faltan ${Number(r?.next_exemplar_at||0)} aprobaciones para activar Exemplar RAG.`};
    return{label:'Recolectando señales reales',pct:0,meta:'Aprende sólo de respuestas aprobadas; no usa el feedback como fuente factual.'};
  }
  async function rate(turn,rating){
    let messageId=turn.dataset.iuMessageId||'';
    let conversationId=turn.dataset.iuConversationId||localStorage.getItem(CID)||'';
    if(!messageId){await hydrateHistoricalIds(true);messageId=turn.dataset.iuMessageId||'';conversationId=turn.dataset.iuConversationId||conversationId}
    if(!messageId){toast('No marqué esta respuesta: no pude vincularla de forma exacta con el historial.');return}
    const key=messageId;
    const rated=readRated();
    try{
      const s=await bootstrap();
      const result=await edge({action:'feedback',...s,message_id:messageId,conversation_id:conversationId||undefined,rating,reason:rating>0?'explicit_approval':'needs_improvement',feedback_contract:FEEDBACK_CONTRACT,client_event_id:globalThis.crypto?.randomUUID?.()||undefined});
      rated[key]=rating;writeRated(rated);turn.dataset.iuRated=String(rating);syncButtons(turn);
      document.documentElement.dataset.learning='active';
      const status=await refreshStatus().catch(()=>null),r=status?readinessOf(status):{};
      const copy=readinessCopy(r);
      toast(rating>0?`Aprendizaje registrado · ${copy.label}`:'Señal de mejora registrada');
      return result;
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
    const rated=readRated(),key=turn.dataset.iuMessageId||'';if(key&&rated[key])turn.dataset.iuRated=String(rated[key]);syncButtons(turn);
  }
  function scan(){for(const turn of assistantTurns())addActions(turn);hydrateLatest();void hydrateHistoricalIds()}
  function installStatusRow(){
    if(document.getElementById('iuLearningRow'))return;
    const sheet=document.querySelector('.sheet'),drawer=document.querySelector('#drawer');
    const row=document.createElement('div');row.id='iuLearningRow';row.className='iu-learning-row';row.innerHTML='<div class="iu-learning-top"><span>Entrenamiento adaptativo</span><small id="iuLearningState">Activo</small></div><div class="iu-learning-track"><i id="iuLearningProgress" style="width:0%"></i></div><div class="iu-learning-meta" id="iuLearningMeta">Recolectando señales verificables.</div>';
    if(sheet)sheet.appendChild(row);else if(drawer){row.style.margin='8px 14px';drawer.appendChild(row)}
  }
  async function refreshStatus(){
    const s=await bootstrap();const data=await edge({action:'learning_status',...s});lastStatus=data;document.documentElement.dataset.learning='active';
    const r=readinessOf(data),copy=readinessCopy(r),el=document.getElementById('iuLearningState'),bar=document.getElementById('iuLearningProgress'),meta=document.getElementById('iuLearningMeta');
    if(el)el.textContent=copy.label;if(bar)bar.style.width=`${copy.pct}%`;if(meta)meta.textContent=copy.meta;
    window.dispatchEvent(new CustomEvent('wae:learning-status',{detail:{...data,readiness:r}}));return data;
  }
  window.addEventListener('wae:stream-event',e=>{if(e.detail?.event==='response.complete'){hydrateLatest(e.detail.data||{});void hydrateHistoricalIds(true)}});
  window.addEventListener('wae:enhancement-ready',()=>scan());
  window.addEventListener('wae:feedback-history-ready',()=>void hydrateHistoricalIds(true));
  function install(){injectStyle();installStatusRow();scan();const root=document.querySelector('#messages');if(root)new MutationObserver(scan).observe(root,{childList:true,subtree:true});setTimeout(()=>refreshStatus().catch(()=>{}),700)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
  window.__waeLearning={rate,refresh:refreshStatus,hydrateHistory:hydrateHistoricalIds,get status(){return lastStatus},get readiness(){return readinessOf(lastStatus)},version:'adaptive-training-v106-exact-message'};
})();
