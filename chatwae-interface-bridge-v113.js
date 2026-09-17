(()=>{
  'use strict';
  const VERSION='universal-core-chatwae-interface/v113';
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const SESSION_KEY='wae.chatwae.supabase.session.v1';
  const CONVERSATION_KEY='wae.chatwae.conversation.v1';
  const MAX_HISTORY=18;
  const MAX_HISTORY_CHARS=40000;
  let authPromise=null;

  function uid(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3)|8;return v.toString(16)});
  }
  function parseJson(value,fallback=null){try{return JSON.parse(value)}catch{return fallback}}
  function readSession(){return parseJson(localStorage.getItem(SESSION_KEY)||'null',null)}
  function saveSession(session){if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY)}
  function expiredSoon(session){const exp=Number(session?.expires_at||0)*1000;return !session?.access_token||!exp||exp<=Date.now()+120000}
  function xhrJson(method,url,body,headers={}){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();xhr.open(method,url,true);xhr.timeout=20000;xhr.setRequestHeader('Content-Type','application/json');
      for(const [key,value] of Object.entries(headers))if(value)xhr.setRequestHeader(key,String(value));
      xhr.onload=()=>{const data=parseJson(xhr.responseText,{error:xhr.responseText||`http_${xhr.status}`});if(xhr.status>=200&&xhr.status<300)resolve({status:xhr.status,data,headers:xhr.getAllResponseHeaders()});else reject(Object.assign(new Error(data?.msg||data?.error_description||data?.error||`http_${xhr.status}`),{status:xhr.status,data}))};
      xhr.onerror=()=>reject(new Error('network_error'));xhr.ontimeout=()=>reject(new Error('timeout'));xhr.send(body===undefined?null:JSON.stringify(body));
    });
  }
  async function refreshSession(session){
    if(!session?.refresh_token)return null;
    try{
      const result=await xhrJson('POST',`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{refresh_token:session.refresh_token},{apikey:SUPABASE_KEY});
      const next=result.data;if(next?.access_token){saveSession(next);return next}
    }catch{}
    saveSession(null);return null;
  }
  async function currentSession(){const session=readSession();if(!session)return null;return expiredSoon(session)?refreshSession(session):session}

  function ensureAuthUi(){
    let root=document.getElementById('waeChatwaeAuth');if(root)return root;
    root=document.createElement('div');root.id='waeChatwaeAuth';root.hidden=true;
    root.innerHTML=`<div class="wae-auth-backdrop"></div><section class="wae-auth-card" role="dialog" aria-modal="true" aria-labelledby="waeAuthTitle"><button class="wae-auth-close" type="button" aria-label="Cerrar">×</button><p class="wae-auth-kicker">UNIVERSAL CORE · MEMORIA SEGURA</p><h2 id="waeAuthTitle">Conectar tu núcleo</h2><p class="wae-auth-copy">Inicia sesión con tu cuenta WAE para usar el motor conversacional avanzado, historial y memoria aislada por usuario.</p><form><label>Correo<input name="email" type="email" autocomplete="email" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><div class="wae-auth-error" aria-live="polite"></div><button class="wae-auth-submit" type="submit">Entrar a Universal Core</button></form></section>`;
    const style=document.createElement('style');style.textContent=`#waeChatwaeAuth{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;font-family:Inter,system-ui,sans-serif}#waeChatwaeAuth[hidden]{display:none}.wae-auth-backdrop{position:absolute;inset:0;background:rgba(2,7,5,.82);backdrop-filter:blur(10px)}.wae-auth-card{position:relative;width:min(430px,100%);box-sizing:border-box;padding:26px;border:1px solid rgba(40,247,164,.28);border-radius:22px;background:#08100d;color:#f1fff9;box-shadow:0 28px 80px rgba(0,0,0,.55)}.wae-auth-close{position:absolute;right:14px;top:12px;border:0;background:transparent;color:#b9c9c1;font-size:25px;cursor:pointer}.wae-auth-kicker{margin:0 0 8px;color:#28f7a4;font-size:.72rem;font-weight:800;letter-spacing:.12em}.wae-auth-card h2{margin:0 0 8px;font-size:1.55rem}.wae-auth-copy{margin:0 0 20px;color:#a9b8b1;line-height:1.45}.wae-auth-card label{display:grid;gap:7px;margin:13px 0;color:#dce8e2;font-size:.86rem;font-weight:700}.wae-auth-card input{box-sizing:border-box;width:100%;padding:13px 14px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:#0d1713;color:#fff;outline:none;font-size:16px}.wae-auth-card input:focus{border-color:#28f7a4}.wae-auth-error{min-height:20px;margin:5px 0 8px;color:#ff9c9c;font-size:.82rem}.wae-auth-submit{width:100%;padding:13px 16px;border:0;border-radius:12px;background:#28f7a4;color:#032016;font-weight:900;cursor:pointer}.wae-auth-submit:disabled{opacity:.6;cursor:progress}`;
    document.head.appendChild(style);document.body.appendChild(root);return root;
  }
  function requestLogin(){
    if(authPromise)return authPromise;
    authPromise=new Promise((resolve,reject)=>{
      const root=ensureAuthUi(),form=root.querySelector('form'),close=root.querySelector('.wae-auth-close'),error=root.querySelector('.wae-auth-error'),button=root.querySelector('.wae-auth-submit');root.hidden=false;
      let settled=false;const finish=(value,err)=>{if(settled)return;settled=true;root.hidden=true;form.removeEventListener('submit',submit);close.removeEventListener('click',cancel);authPromise=null;err?reject(err):resolve(value)};
      const cancel=()=>finish(null,new Error('auth_cancelled'));
      const submit=async(ev)=>{ev.preventDefault();error.textContent='';button.disabled=true;button.textContent='Conectando…';const fd=new FormData(form);try{const result=await xhrJson('POST',`${SUPABASE_URL}/auth/v1/token?grant_type=password`,{email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||'')},{apikey:SUPABASE_KEY});if(!result.data?.access_token)throw new Error('session_missing');saveSession(result.data);finish(result.data)}catch(cause){error.textContent=cause?.status===400?'Correo o contraseña incorrectos.':`No fue posible iniciar sesión: ${cause?.message||'error'}`;button.disabled=false;button.textContent='Entrar a Universal Core'}};
      form.addEventListener('submit',submit);close.addEventListener('click',cancel);setTimeout(()=>form.querySelector('input')?.focus(),30);
    });
    return authPromise;
  }
  async function ensureSession(){return await currentSession()||await requestLogin()}

  function conversationId(){let id=localStorage.getItem(CONVERSATION_KEY);if(!/^[0-9a-f-]{36}$/i.test(id||'')){id=uid();localStorage.setItem(CONVERSATION_KEY,id)}return id}
  function resetConversation(){localStorage.setItem(CONVERSATION_KEY,uid())}
  function history(){
    const list=parseJson(localStorage.getItem('wae.messages')||'[]',[]);if(!Array.isArray(list))return[];let chars=0;const out=[];
    for(const item of list.slice(-MAX_HISTORY)){const role=item?.role==='assistant'?'assistant':item?.role==='user'?'user':'';const content=String(item?.text??item?.content??'').trim().slice(0,5000);if(!role||!content)continue;if(chars+content.length>MAX_HISTORY_CHARS)break;out.push({role,content});chars+=content.length}return out;
  }
  function mapMode(value){const mode=String(value||'').toLowerCase();if(mode==='research')return'research';if(mode==='design')return'creative';if(mode==='executive')return'execution';return'reasoning'}
  function extractUrl(input){try{return new URL(typeof input==='string'?input:input?.url||'',location.href)}catch{return null}}
  function isLegacyChat(input,init){const url=extractUrl(input);if(!url||url.origin!==location.origin||url.pathname!=='/api/chat')return false;return String(init?.method||input?.method||'GET').toUpperCase()==='POST'}
  async function bodyObject(input,init){if(typeof init?.body==='string')return parseJson(init.body,{});if(typeof input!=='string'&&input?.clone){try{return await input.clone().json()}catch{}}return{}}
  function responseFrom(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}})}
  async function bridgeRequest(input,init){
    const body=await bodyObject(input,init),message=String(body?.message||body?.userMessage?.content||'').trim();if(!message)throw new Error('message_required');const session=await ensureSession();
    const payload={conversationId:conversationId(),userMessage:{id:uid(),content:message},assistantMessageId:uid(),mode:mapMode(body?.mode),webSearch:String(body?.mode||'').toLowerCase()==='research'||body?.webSearch===true,clientHistory:history()};
    try{
      const result=await xhrJson('POST','/api/chatwae-bridge',payload,{Authorization:`Bearer ${session.access_token}`});return responseFrom(result.data,result.status,{'X-WAE-Interface-Bridge':VERSION});
    }catch(cause){
      if(cause?.status===401){saveSession(null);const renewed=await requestLogin();const retry=await xhrJson('POST','/api/chatwae-bridge',payload,{Authorization:`Bearer ${renewed.access_token}`});return responseFrom(retry.data,retry.status,{'X-WAE-Interface-Bridge':VERSION})}
      throw cause;
    }
  }

  function install(){
    if(window.fetch?.__waeChatwaeBridge)return;
    const predecessor=window.fetch.bind(window);
    const wrapped=async function(input,init){if(!isLegacyChat(input,init))return predecessor(input,init);try{return await bridgeRequest(input,init)}catch(cause){console.warn('[Universal Core Chatwae bridge] fallback',cause?.message||cause);return predecessor(input,init)}};
    Object.defineProperty(wrapped,'__waeChatwaeBridge',{value:true});window.fetch=wrapped;
  }
  function wireReset(){for(const id of['newChatBtn','drawerNewChat'])document.getElementById(id)?.addEventListener('click',resetConversation,true)}
  function reassert(){install();wireReset()}
  document.addEventListener('DOMContentLoaded',reassert,{once:true});
  document.addEventListener('load',event=>{const target=event.target;if(target?.tagName==='SCRIPT'&&/mobile-brain|canonical-brain|premium-v5/i.test(target.src||''))setTimeout(reassert,0)},true);
  for(const delay of[0,300,900,1800,3500])setTimeout(reassert,delay);
  window.__WAE_CHATWAE_INTERFACE_V113__={version:VERSION,primary:'/api/chatwae-bridge',upstream:'waeosgreen',auth:'supabase-jwt',memory:'chatwaeosgreen',resetConversation,signOut(){saveSession(null);resetConversation()},install:reassert};
})();
