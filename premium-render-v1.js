(()=>{
'use strict';
const Q=(s,r=document)=>r.querySelector(s);
const QA=(s,r=document)=>Array.from(r.querySelectorAll(s));
const text=(v)=>String(v==null?'':v);
const esc=(v)=>text(v).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=(s)=>window.toast&&window.toast(s);
const AUTO_KEY='iu.premium.voice.auto.v1';
let auto=localStorage.getItem(AUTO_KEY)!=='off';
let allowAuto=false;
const voice={token:0,active:null,paused:false};
const synth=window.speechSynthesis;
const supported=!!(synth&&window.SpeechSynthesisUtterance);

function inline(value){
  let s=esc(value);
  s=s.replace(/\[([^\]\n]{1,150})\]\((https?:\/\/[^)\s]{1,1200})\)/gi,(_m,label,url)=>'<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+label+'</a>');
  s=s.replace(/\x60([^\x60\n]+)\x60/g,(_m,code)=>'<code>'+code+'</code>');
  s=s.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>');
  s=s.replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
  return s;
}
function cells(line){const a=text(line).trim().replace(/^\|/,'').replace(/\|$/,'').split('|');return a.map(x=>x.trim())}
function tableRule(line){return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)}
function rich(raw){
  const lines=text(raw).replace(/\r\n?/g,'\n').split('\n');
  const out=[];let paragraph=[],list=null,fence=false,code=[];
  function closePara(){if(paragraph.length){out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');paragraph=[]}}
  function closeList(){if(list){out.push('</'+list+'>');list=null}}
  function block(s){closePara();closeList();out.push(s)}
  for(let i=0;i<lines.length;i++){
    let line=lines[i], t=line.trim(), marker=t.match(/^(?:\x60{3}|~{3})/);
    if(marker){if(fence){out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');fence=false;code=[]}else{closePara();closeList();fence=true}continue}
    if(fence){code.push(line);continue}
    if(!t){closePara();closeList();continue}
    if(i+1<lines.length&&line.includes('|')&&tableRule(lines[i+1])){
      closePara();closeList();
      const heads=cells(line); i+=1;
      let html='<div class="iu-table-scroll" role="region" tabindex="0" aria-label="Tabla de respuesta"><table><thead><tr>'+heads.map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';
      while(i+1<lines.length&&lines[i+1].includes('|')&&lines[i+1].trim()){
        const row=cells(lines[++i]);html+='<tr>'+heads.map((_h,j)=>'<td>'+inline(row[j]||'')+'</td>').join('')+'</tr>';
      }
      html+='</tbody></table></div>';out.push(html);continue;
    }
    const heading=t.match(/^(#{1,4})\s+(.+)$/);
    if(heading){block('<h'+Math.min(heading[1].length+1,5)+'>'+inline(heading[2])+'</h'+Math.min(heading[1].length+1,5)+'>');continue}
    if(/^[-*_]{3,}$/.test(t)){block('<hr>');continue}
    const quote=t.match(/^>\s?(.+)$/);if(quote){block('<blockquote>'+inline(quote[1])+'</blockquote>');continue}
    const bullet=t.match(/^[-*+]\s+(.+)$/),number=t.match(/^\d+[.)]\s+(.+)$/);
    if(bullet||number){closePara();const type=bullet?'ul':'ol';if(list!==type){closeList();out.push('<'+type+'>');list=type}out.push('<li>'+inline((bullet||number)[1])+'</li>');continue}
    closeList();paragraph.push(line.trim());
  }
  closePara();closeList();if(fence)out.push('<pre><code>'+esc(code.join('\n'))+'</code></pre>');
  return out.join('')||'<p>'+esc(raw)+'</p>';
}
function rawOf(article){return article.dataset.iuRaw||article.querySelector('p')?.textContent||''}
function speechText(raw){return text(raw).replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/[\x60*_#>|~]/g,'').replace(/\s+/g,' ').trim().slice(0,9000)}
function resetVoice(){
  voice.token++;voice.active=null;voice.paused=false;
  if(supported)try{synth.cancel()}catch(_){}
  QA('.iu-voice').forEach(b=>{b.textContent='▶';b.title='Escuchar respuesta';b.setAttribute('aria-label','Escuchar respuesta');b.setAttribute('aria-pressed','false')});
}
function speak(article,button){
  if(!supported){notify('La voz no está disponible en este navegador');return}
  if(voice.active===article&&synth.speaking&&!voice.paused){
    try{synth.pause();voice.paused=true;button.textContent='▶';button.title='Reanudar voz';button.setAttribute('aria-label','Reanudar voz');button.setAttribute('aria-pressed','false')}catch(_){}
    return;
  }
  if(voice.active===article&&voice.paused){
    try{synth.resume();voice.paused=false;button.textContent='⏸';button.title='Pausar voz';button.setAttribute('aria-label','Pausar voz');button.setAttribute('aria-pressed','true')}catch(_){}
    return;
  }
  resetVoice();const content=speechText(rawOf(article));if(!content)return;
  const token=voice.token;voice.active=article;voice.paused=false;
  button.textContent='⏸ Pausar';button.setAttribute('aria-pressed','true');
  const chunks=content.match(/[\s\S]{1,170}/g)||[];
  let at=0;
  function next(){
    if(token!==voice.token||voice.active!==article)return;
    if(at>=chunks.length){resetVoice();return}
    const utter=new SpeechSynthesisUtterance(chunks[at++]);utter.lang='es-MX';utter.rate=1;utter.pitch=1;
    const spanish=synth.getVoices().find(v=>/^es[-_]/i.test(v.lang)&&/mx/i.test(v.lang))||synth.getVoices().find(v=>/^es/i.test(v.lang));
    if(spanish)utter.voice=spanish;
    utter.onend=()=>{if(token===voice.token)next()};
    utter.onerror=()=>{if(token===voice.token){resetVoice();notify('No se pudo reproducir la voz')}};
    try{synth.speak(utter)}catch(_){resetVoice();notify('No se pudo iniciar la voz')}
  }
  next();
}
async function copyValue(s){
  if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(s);return}
  const field=document.createElement('textarea');field.value=s;field.style.cssText='position:fixed;left:-10000px';document.body.appendChild(field);field.select();
  try{if(!document.execCommand('copy'))throw Error('copy_failed')}finally{field.remove()}
}
function toolbar(article,raw){
  const bar=document.createElement('div');bar.className='iu-answer-tools';bar.setAttribute('aria-label','Acciones de esta respuesta');
  const copy=document.createElement('button');copy.type='button';copy.className='iu-copy';copy.textContent='⧉';copy.title='Copiar respuesta';copy.setAttribute('aria-label','Copiar respuesta');
  copy.addEventListener('click',async()=>{try{await copyValue(raw);copy.textContent='✓';copy.setAttribute('aria-label','Respuesta copiada');setTimeout(()=>{if(copy.isConnected){copy.textContent='⧉';copy.setAttribute('aria-label','Copiar respuesta')}},1800)}catch(_){notify('No se pudo copiar la respuesta')}});
  const voiceButton=document.createElement('button');voiceButton.type='button';voiceButton.className='iu-voice';voiceButton.textContent='▶';voiceButton.title='Escuchar respuesta';voiceButton.setAttribute('aria-label','Escuchar respuesta');voiceButton.setAttribute('aria-pressed','false');
  if(!supported){voiceButton.disabled=true;voiceButton.title='Voz no compatible con este navegador'}
  voiceButton.addEventListener('click',()=>speak(article,voiceButton));
  const stop=document.createElement('button');stop.type='button';stop.textContent='■';stop.title='Detener voz';stop.setAttribute('aria-label','Detener voz');stop.className='iu-stop';
  stop.addEventListener('click',resetVoice);
  const space=document.createElement('button');space.type='button';space.className='iu-workspace';space.textContent='◇';space.title='Abrir en Workspace';space.setAttribute('aria-label','Abrir respuesta en Workspace');
  space.addEventListener('click',()=>{
    const editor=Q('#documentEditor');
    if(!editor){notify('Workspace no disponible');return}
    editor.innerHTML=rich(raw);
    editor.dispatchEvent(new Event('input',{bubbles:true}));
    Q('#workspaceBtn')?.click();
    Q('.workspace-tabs [data-tab="document"]')?.click();
    notify('Respuesta abierta en Workspace');
  });
  bar.append(copy,voiceButton,stop,space);return bar;
}
function enhance(article){
  if(!article.classList.contains('assistant')||article.id==='typingMessage')return;
  const p=article.querySelector('p');if(!p)return;
  const raw=p.textContent||'';
  if(!raw.trim())return;
  if(raw==='Sistema listo. Investiga, programa, analiza, diseña o escribe directamente lo que necesitas.'){
    if(!Q('.message.user')){article.remove();return}
  }
  if(article.dataset.iuRich==='1')return;
  article.dataset.iuRich='1';article.dataset.iuRaw=raw;
  const body=document.createElement('div');body.className='iu-rich';body.innerHTML=rich(raw);p.replaceWith(body);
  article.append(toolbar(article,raw));
  if(allowAuto&&auto&&article===QA('#messages .message.assistant').at(-1)&&!/^El núcleo de inteligencia está reconectando/.test(raw)){
    const b=article.querySelector('.iu-voice');if(b)speak(article,b);
  }
}
function decorate(){
  QA('#messages .message.assistant').forEach(enhance);
  QA('.v2-recent').forEach(n=>n.remove());
  const fake=Q('.drawer-foot');if(fake&&fake.dataset.iuClean!=='1'){fake.dataset.iuClean='1';fake.innerHTML='<small>MEMORIA UNIVERSAL</small><small>El historial depende de la conexión al núcleo.</small>'}
}
function initialize(){
  const messages=Q('#messages');if(!messages)return;
  decorate();
  // No leer respuestas históricas al cargar; solo respuestas nuevas.
  allowAuto=true;
  const obs=new MutationObserver(decorate);obs.observe(messages,{childList:true,subtree:false});
  const voiceControl=Q('#voiceBtn');
  if(voiceControl){
    voiceControl.title='Activar o desactivar lectura automática';
    function refresh(){voiceControl.textContent=auto?'🔊':'🔇';voiceControl.title=auto?'Voz automática activada · tocar para desactivar':'Voz automática desactivada · tocar para activar';voiceControl.setAttribute('aria-pressed',String(auto));voiceControl.setAttribute('aria-label',auto?'Desactivar respuestas con voz':'Activar respuestas con voz')}
    voiceControl.addEventListener('click',e=>{e.stopImmediatePropagation();auto=!auto;localStorage.setItem(AUTO_KEY,auto?'on':'off');if(!auto)resetVoice();refresh();notify(auto?'Voz automática activada':'Voz automática desactivada')},true);refresh();
  }
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(Recognition&&voiceControl&&!Q('#iuMicBtn')){
    const mic=document.createElement('button');mic.type='button';mic.id='iuMicBtn';mic.className='mini-btn iu-mic';mic.textContent='🎙';mic.title='Dictar mensaje';mic.setAttribute('aria-label','Dictar mensaje por micrófono');mic.setAttribute('aria-pressed','false');
    voiceControl.after(mic);
    let rec=null,active=false;
    function micState(value){active=value;mic.setAttribute('aria-pressed',String(value));mic.title=value?'Detener dictado':'Dictar mensaje';mic.textContent=value?'■ Mic':'🎙'}
    mic.addEventListener('click',()=>{
      if(active){try{rec.stop()}catch(_){}micState(false);return}
      try{
        rec=new Recognition();rec.lang='es-MX';rec.interimResults=false;rec.continuous=false;
        rec.onresult=(event)=>{const words=Array.from(event.results).map(r=>r[0]?.transcript||'').join(' ').trim();const input=Q('#messageInput');if(input&&words){input.value=[input.value.trim(),words].filter(Boolean).join(' ');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()}};
        rec.onerror=(event)=>{micState(false);if(event.error!=='no-speech')notify('Micrófono no disponible: '+event.error)};
        rec.onend=()=>micState(false);rec.start();micState(true);
      }catch(_){micState(false);notify('Tu navegador no pudo iniciar el dictado')}
    });
  }
  QA('.v2-tool').forEach(b=>{if(b.title==='Escuchar'){b.textContent='■';b.title='Detener voz';b.addEventListener('click',e=>{e.stopImmediatePropagation();resetVoice();notify('Voz detenida')},true)}});
  const runtime=Q('.v2-runtime-copy');if(runtime&&/0 req|100%/.test(runtime.textContent||''))runtime.innerHTML='<strong>Universal Core</strong><small>Comprobando conexión…</small>';
  const efficiency=Q('.v2-efficiency');if(efficiency&&/100%/.test(efficiency.textContent||''))efficiency.innerHTML='<strong>CORE</strong><small>ONLINE</small>';
  const drawer=Q('#drawer');if(drawer)new MutationObserver(()=>QA('.v2-recent').forEach(n=>n.remove())).observe(drawer,{childList:true});
  Q('#newChatBtn')?.addEventListener('click',resetVoice);
  Q('#drawerNewChat')?.addEventListener('click',resetVoice);
  window.addEventListener('pagehide',resetVoice);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();