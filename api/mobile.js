const PAGE = String.raw`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">
<meta name="theme-color" content="#090a0d">
<title>WAE OS Enterprise · Universal Core Mobile</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#090a0d;color:#f5f7f7;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{min-height:100dvh;overflow:hidden}.shell{height:100dvh;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:linear-gradient(180deg,#090a0d 0%,#0c0e12 100%)}header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px calc(10px + env(safe-area-inset-top));border-bottom:1px solid #1d2127;background:rgba(9,10,13,.96)}.brand{display:grid;gap:2px}.brand strong{font-size:.92rem;letter-spacing:.01em}.brand span{font-size:.68rem;color:#89919b}.live{font-size:.65rem;font-weight:800;color:#b9f7d2;border:1px solid #214b34;background:#10271b;border-radius:999px;padding:6px 9px}.status{padding:8px 16px;font-size:.68rem;color:#98a0aa;border-bottom:1px solid #171a20}.status b{color:#dfe5e8}.messages{overflow:auto;padding:18px 14px 26px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.welcome{margin:10vh auto 26px;max-width:560px;text-align:center}.welcome h1{font-size:1.65rem;margin:0 0 8px}.welcome p{margin:0;color:#9098a2;font-size:.88rem;line-height:1.45}.msg{max-width:780px;margin:0 auto 14px;padding:13px 14px;border-radius:16px;line-height:1.48;font-size:.9rem;white-space:pre-wrap;overflow-wrap:anywhere}.msg.user{background:#1b2027;border:1px solid #282e37}.msg.assistant{background:transparent;border:1px solid #1c2128}.meta{font-size:.62rem;color:#737c86;margin-bottom:7px;font-weight:700}.composer-wrap{padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid #1c2026;background:#0b0d11}.composer{display:grid;grid-template-columns:minmax(0,1fr) 48px;gap:9px;max-width:820px;margin:0 auto;align-items:end}.composer textarea{display:block;width:100%;min-height:48px;max-height:144px;resize:none;border:1px solid #303641;border-radius:16px;background:#11151a;color:#fff;padding:13px 14px;font:inherit;font-size:16px;line-height:1.35;outline:none;pointer-events:auto!important;user-select:text!important;-webkit-user-select:text!important;touch-action:manipulation}.composer textarea:focus{border-color:#66717f;box-shadow:0 0 0 2px rgba(115,128,145,.16)}.composer button{width:48px;height:48px;border:0;border-radius:15px;background:#f4f7f7;color:#090a0d;font-size:1.15rem;font-weight:900;cursor:pointer;touch-action:manipulation}.composer button:disabled{opacity:.45}.note{max-width:820px;margin:7px auto 0;color:#656e79;font-size:.61rem;text-align:center}.error{color:#ffb6b6}.typing{opacity:.72}.hidden{display:none!important}
</style>
</head>
<body>
<div class="shell">
<header><div class="brand"><strong>WAE OS Enterprise</strong><span>Universal Core · Mobile Recovery v24</span></div><div class="live" id="live">UI READY</div></header>
<div class="status" id="status"><b>Interfaz interactiva.</b> El núcleo se conectará al enviar.</div>
<main class="messages" id="messages"><section class="welcome" id="welcome"><h1>Universal Core</h1><p>Modo móvil aislado. Sin PWA, overlays ni capas premium heredadas.</p></section></main>
<div class="composer-wrap">
<form class="composer" id="composer"><textarea id="input" rows="1" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" spellcheck="true" placeholder="Escribe un mensaje…"></textarea><button id="send" type="submit" aria-label="Enviar">➜</button></form>
<div class="note" id="note">Tus mensajes no se incluyen en la telemetría de interacción.</div>
</div>
</div>
<script>
(function(){
'use strict';
var RELEASE='mobile-recovery-v24';
var EDGE='https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61';
var KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
var SID='iu.sessionId', SECRET='iu.sessionSecret', CID='iu.conversationId';
var form=document.getElementById('composer'), input=document.getElementById('input'), send=document.getElementById('send'), messages=document.getElementById('messages'), status=document.getElementById('status'), welcome=document.getElementById('welcome');
var busy=false, bootPromise=null;
function qs(el){if(!el)return'';var id=el.id?'#'+el.id:'';var cls=el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).slice(0,2).join('.'):'';return (el.tagName||'').toLowerCase()+id+cls}
function viewport(){var v=window.visualViewport;return{width:innerWidth,height:innerHeight,vvWidth:v&&v.width||null,vvHeight:v&&v.height||null,vvOffsetTop:v&&v.offsetTop||null}}
function diag(event,extra){try{var rect=input.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+Math.min(rect.height/2,24),top=document.elementFromPoint(x,y);var body=Object.assign({event:event,at:new Date().toISOString(),release:RELEASE,page:location.pathname,displayMode:matchMedia('(display-mode: standalone)').matches?'standalone':'browser',viewport:viewport(),activeElement:qs(document.activeElement),target:qs(extra&&extra.target),topAtPoint:qs(top),valueLength:input.value.length,writable:!input.disabled&&!input.readOnly},extra||{});delete body.targetObject;fetch('/api/ui-diagnostics',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(function(){})}catch(_){}}
function add(role,text,cls){if(welcome)welcome.classList.add('hidden');var el=document.createElement('article');el.className='msg '+role+(cls?' '+cls:'');var meta=document.createElement('div');meta.className='meta';meta.textContent=role==='user'?'Tú':'Universal Core';var body=document.createElement('div');body.textContent=String(text||'');el.appendChild(meta);el.appendChild(body);messages.appendChild(el);messages.scrollTop=messages.scrollHeight;return el}
function autosize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,144)+'px'}
function edge(payload,timeout){var controller=new AbortController(),timer=setTimeout(function(){controller.abort('timeout')},timeout||45000);return fetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':KEY,'x-client-info':'wae-mobile-recovery/24'},body:JSON.stringify(payload),cache:'no-store',signal:controller.signal}).then(function(r){return r.json().catch(function(){return{}}).then(function(d){if(!r.ok)throw new Error(d.error||('HTTP '+r.status));return d})}).finally(function(){clearTimeout(timer)})}
function boot(){if(bootPromise)return bootPromise;bootPromise=edge({action:'bootstrap',session_id:localStorage.getItem(SID)||'',session_secret:localStorage.getItem(SECRET)||''},12000).then(function(d){if(!d.session_id||!d.session_secret)throw new Error('invalid_bootstrap');localStorage.setItem(SID,d.session_id);localStorage.setItem(SECRET,d.session_secret);return d}).catch(function(e){bootPromise=null;throw e});return bootPromise}
function fallbackChat(text){return fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,mode:'general',preferences:{responseStyle:'premium-rich',voiceNatural:true}}),cache:'no-store'}).then(function(r){return r.json().then(function(d){if(!r.ok||!d.reply)throw new Error(d.error||('HTTP '+r.status));return d})})}
async function sendMessage(text){await boot();var payload={action:'chat',session_id:localStorage.getItem(SID)||'',session_secret:localStorage.getItem(SECRET)||'',conversation_id:localStorage.getItem(CID)||null,message:text,mode:'general',web_enabled:false,stream:false,routing_variant:'control'};try{return await edge(payload,65000)}catch(e){return await fallbackChat(text)}}
function recoverPwa(){if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}).then(function(){diag('sw_state',{error:'registrations_cleared'})}).catch(function(){})}if('caches'in window){caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k.indexOf('wae-universal-')===0}).map(function(k){return caches.delete(k)}))}).catch(function(){})}}
form.addEventListener('submit',async function(e){e.preventDefault();var text=input.value.trim();if(!text||busy)return;diag('submit',{target:qs(e.target)});busy=true;send.disabled=true;input.value='';autosize();add('user',text);var typing=add('assistant','Procesando…','typing');status.innerHTML='<b>Universal Core conectado.</b> Procesando solicitud…';diag('request_start');try{var data=await sendMessage(text);typing.remove();var reply=String(data.reply||data.response&&data.response.content||'').trim();if(!reply)throw new Error('empty_reply');if(data.conversation_id)localStorage.setItem(CID,data.conversation_id);add('assistant',reply);status.innerHTML='<b>Universal Core operativo.</b> Respuesta recibida.';diag('request_end');diag('response_rendered')}catch(err){typing.remove();add('assistant','No pude completar la solicitud en este intento. El campo de escritura sí está operativo.','error');status.innerHTML='<b class="error">Conexión degradada.</b> La interfaz móvil sigue interactiva.';diag('error',{error:String(err&&err.message||err)})}finally{busy=false;send.disabled=false;input.focus()}});
input.addEventListener('pointerdown',function(e){diag('pointerdown',{target:qs(e.target)})},{passive:true});
input.addEventListener('touchstart',function(e){diag('touchstart',{target:qs(e.target)})},{passive:true});
input.addEventListener('focus',function(e){diag('focus',{target:qs(e.target)})});
input.addEventListener('input',function(e){autosize();diag('input',{target:qs(e.target)})});
input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit()}});
window.addEventListener('error',function(e){diag('error',{error:String(e.message||'window_error')})});
window.addEventListener('unhandledrejection',function(e){diag('unhandledrejection',{error:String(e.reason&&e.reason.message||e.reason||'rejection')})});
window.addEventListener('pageshow',function(){input.disabled=false;input.readOnly=false;diag('page_loaded')},{once:true});
recoverPwa();input.disabled=false;input.readOnly=false;input.tabIndex=0;autosize();diag('page_loaded');
})();
</script>
</body>
</html>`;

export default async function mobileHandler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end();
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (req.method === 'HEAD') return res.end();
  return res.end(PAGE);
}
