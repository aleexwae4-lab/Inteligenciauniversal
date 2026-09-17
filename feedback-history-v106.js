(()=>{
  'use strict';
  const VERSION='feedback-history/v106';
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const SID='iu.sessionId',SECRET='iu.sessionSecret',CID='iu.conversationId';
  let inFlight=null,lastCid='';

  const clean=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[`*_#>|~\[\](){}:;,.!?¿¡"']/g,' ').replace(/\s+/g,' ').trim();
  const session=()=>({session_id:localStorage.getItem(SID)||'',session_secret:localStorage.getItem(SECRET)||''});
  const assistantTurns=()=>[...document.querySelectorAll('.turn.assistant,.message.assistant')].filter(x=>x.id!=='typingMessage');
  const turnText=turn=>clean(turn.querySelector('.assistant-body,.rich-answer')?.textContent||'');
  const messageText=message=>clean(message?.content||'');
  const compatible=(a,b)=>{
    if(!a||!b)return false;
    if(a===b)return true;
    const n=Math.min(220,a.length,b.length);
    return n>=40&&(a.slice(0,n)===b.slice(0,n)||a.includes(b.slice(0,Math.min(120,b.length)))||b.includes(a.slice(0,Math.min(120,a.length))));
  };

  async function edge(payload){
    const r=await fetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-feedback-history/106'},body:JSON.stringify(payload),cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`history_feedback_${r.status}`);
    return data;
  }

  function markExact(turn,message,cid){
    if(!turn||!message?.id)return false;
    turn.dataset.iuMessageId=String(message.id);
    turn.dataset.iuConversationId=String(message.conversation_id||cid||'');
    turn.dataset.iuFeedbackBinding='exact-v106';
    return true;
  }

  function bindFromEnd(turns,messages,cid){
    const remaining=[...messages];
    let bound=0;
    for(let ti=turns.length-1;ti>=0;ti--){
      const turn=turns[ti];
      if(turn.dataset.iuMessageId)continue;
      const text=turnText(turn);
      let match=-1;
      for(let mi=remaining.length-1;mi>=0;mi--){
        if(compatible(text,messageText(remaining[mi]))){match=mi;break}
      }
      if(match<0)continue;
      const [message]=remaining.splice(match,1);
      if(markExact(turn,message,cid))bound++;
    }
    return bound;
  }

  async function hydrateHistory(force=false){
    const cid=localStorage.getItem(CID)||'';
    if(!cid)return{bound:0,total:0,reason:'no_conversation'};
    const turns=assistantTurns();
    if(!turns.length)return{bound:0,total:0,reason:'no_turns'};
    if(!force&&cid===lastCid&&turns.every(t=>t.dataset.iuMessageId))return{bound:turns.length,total:turns.length,cached:true};
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      const s=session();
      if(!s.session_id||!s.session_secret)return{bound:0,total:turns.length,reason:'no_session'};
      const data=await edge({action:'get_conversation',...s,conversation_id:cid});
      const messages=(Array.isArray(data.messages)?data.messages:[]).filter(m=>m?.role==='assistant'&&m?.id);
      const bound=bindFromEnd(turns,messages,cid);
      lastCid=cid;
      document.documentElement.dataset.feedbackHistoryBinding=bound?VERSION:'partial';
      window.dispatchEvent(new CustomEvent('wae:feedback-history-bound',{detail:{version:VERSION,bound,total:turns.length,conversation_id:cid}}));
      return{bound,total:turns.length};
    })().catch(error=>{console.warn('[WAE Feedback History v106]',error?.message||error);return{bound:0,total:turns.length,error:String(error?.message||error)}}).finally(()=>{inFlight=null});
    return inFlight;
  }

  async function interceptHistoricalRating(event){
    const btn=event.target?.closest?.('.iu-learn-actions button[data-rating]');
    if(!btn)return;
    const turn=btn.closest('.turn.assistant,.message.assistant');
    if(!turn||turn.dataset.iuMessageId)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    btn.disabled=true;
    try{
      await hydrateHistory(true);
      if(!turn.dataset.iuMessageId){window.toast?.('No marqué esta respuesta: no pude vincularla de forma exacta con el historial.');return}
      const rating=Number(btn.dataset.rating||0);
      if(![-1,1].includes(rating))return;
      if(!window.__waeLearning?.rate){window.toast?.('El aprendizaje todavía no está listo.');return}
      await window.__waeLearning.rate(turn,rating);
    }finally{btn.disabled=false}
  }

  function install(){
    document.addEventListener('click',interceptHistoricalRating,true);
    void hydrateHistory();
    const root=document.querySelector('#messages');
    if(root)new MutationObserver(()=>void hydrateHistory()).observe(root,{childList:true,subtree:true});
    window.addEventListener('wae:stream-event',e=>{if(e.detail?.event==='response.complete')setTimeout(()=>void hydrateHistory(true),0)});
    window.addEventListener('wae:enhancement-ready',()=>void hydrateHistory(true));
    document.documentElement.dataset.feedbackHistory=VERSION;
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
  window.__waeFeedbackHistory={version:VERSION,hydrate:hydrateHistory};
})();