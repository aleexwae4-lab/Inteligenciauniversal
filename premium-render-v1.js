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
const voice={token:0,active:null,paused:false,started:false,startTimer:null,utterances:[],fallbackAttempted:false,completedChunks:0,route:null,source:null,cloudAbort:null};
const synth=window.speechSynthesis;
const browserSupported=!!(synth&&window.SpeechSynthesisUtterance);
const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
let sharedAudioContext=null;
const cloudSupported=()=>!!(AudioContextCtor&&window.WAEVoiceRuntime?.synthesize);
const supported=()=>browserSupported||cloudSupported();
function audioContext(){
  if(!AudioContextCtor)return null;
  if(!sharedAudioContext||sharedAudioContext.state==='closed')sharedAudioContext=new AudioContextCtor();
  return sharedAudioContext;
}
function unlockAudio(){
  try{const ctx=audioContext();if(ctx?.state==='suspended')void ctx.resume();return ctx}catch(_){return null}
}
document.addEventListener('pointerdown',unlockAudio,{once:true,capture:true});
window.WAEVoice={stop:()=>resetVoice(),available:()=>supported(),unlock:unlockAudio};
function voiceEvent(status,details={}){
  try{window.dispatchEvent(new CustomEvent('wae:voice-e2e',{detail:{status,...details}}))}catch(_){}
}

function inline(value){
  // Permit only explicit line-break tags from model output. Every other HTML token
  // is still escaped, so rendering <br> cleanly does not weaken the XSS boundary.
  let s=text(value).split(/<br\s*\/?>/gi).map(esc).join('<br>');
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
  const out=[];let paragraph=[],list=null,fence=false,code=[],blockType='',orderedCounter=0;
  function closePara(){if(paragraph.length){out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');paragraph=[]}}
  function closeList(){if(list){out.push('</'+list+'>');list=null}}
  function block(s){closePara();closeList();out.push(s)}
  for(let i=0;i<lines.length;i++){
    let line=lines[i], t=line.trim(), marker=t.match(/^(?:\x60{3}|~{3})/);
    if(marker){if(fence){out.push('<pre'+(blockType?' data-wae-block="'+blockType+'"':'')+'><code>'+esc(code.join('\n'))+'</code></pre>');fence=false;code=[];blockType=''}else{closePara();closeList();fence=true;blockType=/^(?:\x60{3}|~{3})wae-(card|chart)\s*$/i.exec(t)?.[1]?.toLowerCase()||''}continue}
    if(fence){code.push(line);continue}
    if(!t){closePara();closeList();continue}
    if(i+1<lines.length&&line.includes('|')&&tableRule(lines[i+1])){
      closePara();closeList();orderedCounter=0;
      const heads=cells(line); i+=1;
      let html='<div class="iu-table-scroll" role="region" tabindex="0" aria-label="Tabla de respuesta"><table><thead><tr>'+heads.map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';
      while(i+1<lines.length&&lines[i+1].includes('|')&&lines[i+1].trim()){
        const row=cells(lines[++i]);html+='<tr>'+heads.map((h,j)=>'<td data-label="'+esc(text(h).replace(/[\x60*_~]/g,'').slice(0,90))+'">'+inline(row[j]||'')+'</td>').join('')+'</tr>';
      }
      html+='</tbody></table></div>';out.push(html);continue;
    }
    const heading=t.match(/^(#{1,4})\s+(.+)$/);
    if(heading){orderedCounter=0;block('<h'+Math.min(heading[1].length+1,5)+'>'+inline(heading[2])+'</h'+Math.min(heading[1].length+1,5)+'>');continue}
    if(/^[-*_]{3,}$/.test(t)){orderedCounter=0;block('<hr>');continue}
    const quote=t.match(/^>\s?(.+)$/);if(quote){orderedCounter=0;block('<blockquote>'+inline(quote[1])+'</blockquote>');continue}
    const bullet=t.match(/^[-*+]\s+(.+)$/),number=t.match(/^(\d+)[.)]\s+(.+)$/);
    if(bullet||number){
      closePara();
      const type=bullet?'ul':'ol';
      if(number){
        const sourceNumber=Math.max(1,Number(number[1])||1);
        const start=sourceNumber===1&&orderedCounter>0?orderedCounter+1:sourceNumber;
        if(list!==type){closeList();out.push('<ol'+(start!==1?' start="'+start+'"':'')+'>');list=type}
        out.push('<li>'+inline(number[2])+'</li>');orderedCounter=start;
      }else{
        if(list!==type){closeList();out.push('<ul>');list=type}
        out.push('<li>'+inline(bullet[1])+'</li>');
      }
      continue;
    }
    closeList();orderedCounter=0;paragraph.push(line.trim());
  }
  closePara();closeList();if(fence)out.push('<pre'+(blockType?' data-wae-block="'+blockType+'"':'')+'><code>'+esc(code.join('\n'))+'</code></pre>');
  return out.join('')||'<p>'+esc(raw)+'</p>';
}
function rawOf(article){return article.dataset.iuRaw||article.querySelector('p')?.textContent||''}
function speechText(raw){
  let t=text(raw).normalize('NFKC').replace(/\r\n?/g,'\n');
  t=t
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/(?:\x60{3}|~{3})wae-(?:card|chart)[\s\S]*?(?:\x60{3}|~{3})/gi,' ')
    .replace(/\x60{3}[\s\S]*?\x60{3}/g,' ')
    .replace(/~{3}[\s\S]*?~{3}/g,' ')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm,' ')
    .replace(/^\s*[-*_#=]{2,}\s*$/gm,' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/\[(?:W|M|MEM)\d+\]/gi,' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g,'$1')
    .replace(/(^|\n)\s*(?:[-+*•▪◦●○■□◆◇►▶]|\d+[.)])\s+/gu,'$1')
    .replace(/\x60[^\x60\n]+\x60/g,' código ')
    .replace(/\*\*|__|~~|[*_~\x60#@]/g,' ')
    .replace(/[→⇒➜➝➞➡⟶⟹↦↪•▪◦●○■□◆◇►▶]/gu,', ')
    .replace(/\s*\|+\s*/g,', ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,' ')
    .replace(/[\[\]{}<>]/g,' ')
    .replace(/[“”„‟"«»]/g,' ')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*%/g,'$1 por ciento')
    .replace(/(^|[\s(])-(\d+(?:[.,]\d+)?)/g,'$1menos $2')
    .replace(/[-‐‑‒–—―]+/g,' ')
    .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])\.([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g,'$1 $2')
    .replace(/(\d)\.(\d)/g,'$1§DEC§$2')
    .replace(/[.!?;:]+/g,', ')
    .replace(/§DEC§/g,'.')
    .replace(/[ \t]+/g,' ')
    .replace(/\s*,\s*/g,', ')
    .replace(/,+/g,',')
    .replace(/,\s*(?=\n|$)/g,'')
    .replace(/\s*\n+\s*/g,', ')
    .replace(/(?:,\s*){2,}/g,', ')
    .replace(/^,\s*|,\s*$/g,'')
    .trim();
  return t.slice(0,9000);
}
function takeEnvelope(article){
  const envelope=window.__waePendingResponseEnvelope;
  if(!envelope||article!==QA('#messages .message.assistant').at(-1))return null;
  window.__waePendingResponseEnvelope=null;
  return envelope;
}
function sourceRows(envelope){
  const seen=new Set(),rows=[];
  for(const item of Array.isArray(envelope?.sources)?envelope.sources:[]){
    if(!item||typeof item!=='object'||!item.url||!item.title)continue;
    let url;try{url=new URL(String(item.url));if(!['http:','https:'].includes(url.protocol))continue}catch{continue}
    if(seen.has(url.href))continue;seen.add(url.href);
    rows.push({title:text(item.title).replace(/[\r\n]+/g,' ').slice(0,120),url:url.href,host:url.hostname.replace(/^www\./,'')});
    if(rows.length>=5)break;
  }
  return rows;
}
function sourceStrip(envelope){
  const rows=sourceRows(envelope);if(!rows.length)return null;
  const wrap=document.createElement('div');wrap.className='iu-native-sources';wrap.setAttribute('aria-label','Fuentes de esta respuesta');
  const label=document.createElement('span');label.className='iu-native-sources-label';label.textContent='Fuentes';
  wrap.append(label);
  for(const row of rows){
    const a=document.createElement('a');a.href=row.url;a.target='_blank';a.rel='noopener noreferrer';a.className='iu-native-source';
    const strong=document.createElement('strong');strong.textContent=row.title;
    const small=document.createElement('small');small.textContent=row.host;
    a.append(strong,small);wrap.append(a);
  }
  return wrap;
}
function resetVoice(){
  voice.token++;
  voice.active=null;voice.paused=false;voice.started=false;voice.route=null;
  if(voice.startTimer){clearTimeout(voice.startTimer);voice.startTimer=null}
  if(voice.cloudAbort){try{voice.cloudAbort.abort()}catch(_){}voice.cloudAbort=null}
  if(voice.source){try{voice.source.onended=null;voice.source.stop(0)}catch(_){}try{voice.source.disconnect()}catch(_){}voice.source=null}
  voice.utterances=[];voice.fallbackAttempted=false;voice.completedChunks=0;
  if(browserSupported)try{synth.cancel()}catch(_){}
  QA('.iu-voice').forEach(b=>{b.textContent='▶';b.title='Escuchar respuesta';b.setAttribute('aria-label','Escuchar respuesta');b.setAttribute('aria-pressed','false')});
}
function setPlaying(button,route,details={}){
  voice.started=true;voice.route=route;voice.paused=false;
  button.textContent='⏸';button.title='Pausar voz';button.setAttribute('aria-label','Pausar voz');button.setAttribute('aria-pressed','true');
  voiceEvent('playing',{route,...details});
}
function browserPlayback(content,button,token,prefs,{recoveredFrom=null}={}){
  if(!browserSupported){
    voiceEvent('failed',{code:recoveredFrom||'browser_tts_unavailable',route:'browser'});
    resetVoice();notify('No se pudo iniciar la voz');return;
  }
  const allVoices=synth.getVoices();
  const selected=allVoices.find(v=>v.voiceURI===prefs.voiceURI);
  const spanish=allVoices.find(v=>/^es[-_]/i.test(v.lang)&&/mx/i.test(v.lang))||allVoices.find(v=>/^es/i.test(v.lang));
  const queue=(chunks,{fallback=false}={})=>{
    if(voice.startTimer){clearTimeout(voice.startTimer);voice.startTimer=null}
    const utterances=chunks.map((chunk,index)=>{
      const utter=new SpeechSynthesisUtterance(chunk);
      utter.lang='es-MX';
      utter.rate=fallback?Math.min(Number(prefs.rate)||1,1):Number(prefs.rate)||1;
      utter.pitch=fallback?1:Number(prefs.pitch)||1;
      utter.volume=1;
      if(!fallback){if(selected)utter.voice=selected;else if(spanish)utter.voice=spanish}
      utter.onstart=()=>{
        if(token!==voice.token)return;
        if(voice.startTimer){clearTimeout(voice.startTimer);voice.startTimer=null}
        setPlaying(button,'browser',{fallback,recoveredFrom});
        if(recoveredFrom)voiceEvent('recovered',{route:'browser',code:recoveredFrom});
      };
      utter.onend=()=>{
        if(token!==voice.token)return;
        voice.completedChunks++;
        if(index===chunks.length-1){voiceEvent('completed',{route:'browser',fallback,recoveredFrom});resetVoice()}
      };
      utter.onerror=(event)=>{
        if(token!==voice.token)return;
        const code=String(event?.error||'speech_error');
        const recoverable=/^(?:voice-unavailable|language-unavailable|synthesis-unavailable|synthesis-failed|text-too-long|network)$/i.test(code);
        if(!fallback&&recoverable&&voice.completedChunks===0&&!voice.fallbackAttempted){
          voice.fallbackAttempted=true;
          try{synth.cancel()}catch(_){}
          const smaller=window.WAESpeechChunks?window.WAESpeechChunks(content,700):[content];
          voiceEvent('recovering',{code,route:'browser'});
          setTimeout(()=>{if(token===voice.token)queue(smaller,{fallback:true})},0);
          return;
        }
        voiceEvent('failed',{code,fallback,route:'browser'});resetVoice();notify('No se pudo reproducir la voz');
      };
      return utter;
    });
    voice.utterances=utterances;
    try{
      utterances.forEach(utter=>synth.speak(utter));
      voice.startTimer=setTimeout(()=>{
        if(token!==voice.token||voice.started)return;
        try{synth.cancel()}catch(_){}
        if(!fallback&&!voice.fallbackAttempted){
          voice.fallbackAttempted=true;
          const smaller=window.WAESpeechChunks?window.WAESpeechChunks(content,700):[content];
          voiceEvent('recovering',{code:'start_timeout',route:'browser'});
          queue(smaller,{fallback:true});
        }else{
          voiceEvent('failed',{code:'start_timeout',fallback,route:'browser'});resetVoice();notify('No se pudo iniciar la voz');
        }
      },2800);
    }catch(_){
      if(!fallback&&!voice.fallbackAttempted){
        voice.fallbackAttempted=true;
        const smaller=window.WAESpeechChunks?window.WAESpeechChunks(content,700):[content];
        voiceEvent('recovering',{code:'speak_throw',route:'browser'});
        setTimeout(()=>{if(token===voice.token)queue(smaller,{fallback:true})},0);
      }else{voiceEvent('failed',{code:'speak_throw',fallback,route:'browser'});resetVoice();notify('No se pudo iniciar la voz')}
    }
  };
  const chunks=window.WAESpeechChunks?window.WAESpeechChunks(content,1350):[content];
  queue(chunks,{fallback:!!recoveredFrom});
}
async function cloudPlayback(content,button,token,prefs){
  const runtime=window.WAEVoiceRuntime;
  const ctx=unlockAudio();
  if(!runtime?.synthesize||!ctx)throw Object.assign(new Error('cloud_tts_unavailable'),{code:'cloud_tts_unavailable'});
  if(ctx.state==='suspended')await ctx.resume();
  const chunks=window.WAESpeechChunks?window.WAESpeechChunks(content,3400):[content];
  if(!chunks.length)throw Object.assign(new Error('voice_text_empty'),{code:'voice_text_empty'});
  const controller=new AbortController();voice.cloudAbort=controller;voice.route='cloud';
  const request=index=>runtime.synthesize({text:chunks[index],voice:'Kore'},{signal:controller.signal});
  let pending=request(0);
  for(let index=0;index<chunks.length;index++){
    const packet=await pending;
    if(token!==voice.token||controller.signal.aborted)return;
    if(index+1<chunks.length)pending=request(index+1);
    const bytes=await packet.blob.arrayBuffer();
    const buffer=await ctx.decodeAudioData(bytes.slice(0));
    if(token!==voice.token||controller.signal.aborted)return;
    await new Promise((resolve,reject)=>{
      const source=ctx.createBufferSource();voice.source=source;source.buffer=buffer;source.connect(ctx.destination);
      source.onended=()=>{try{source.disconnect()}catch(_){}if(voice.source===source)voice.source=null;resolve()};
      try{
        if(!voice.started)setPlaying(button,'cloud',{version:packet.version||null,voice:packet.voice||null,model:packet.model||null});
        source.start(0);
      }catch(error){reject(error)}
    });
  }
  if(token===voice.token){voiceEvent('completed',{route:'cloud'});resetVoice()}
}
function speak(article,button){
  if(!supported()){voiceEvent('failed',{code:'unsupported'});notify('La voz no está disponible en este navegador');return}
  if(voice.active===article&&!voice.started){resetVoice();return}
  if(voice.active===article&&voice.started&&!voice.paused){
    if(voice.route==='cloud'&&sharedAudioContext){
      void sharedAudioContext.suspend().then(()=>{if(voice.active===article){voice.paused=true;button.textContent='▶';button.title='Reanudar voz';button.setAttribute('aria-label','Reanudar voz');button.setAttribute('aria-pressed','false')}}).catch(()=>{});
      return;
    }
    if(voice.route==='browser'&&(synth.speaking||synth.pending)){
      try{synth.pause();voice.paused=true;button.textContent='▶';button.title='Reanudar voz';button.setAttribute('aria-label','Reanudar voz');button.setAttribute('aria-pressed','false')}catch(_){}
      return;
    }
  }
  if(voice.active===article&&voice.paused){
    if(voice.route==='cloud'&&sharedAudioContext){
      void sharedAudioContext.resume().then(()=>{if(voice.active===article){voice.paused=false;button.textContent='⏸';button.title='Pausar voz';button.setAttribute('aria-label','Pausar voz');button.setAttribute('aria-pressed','true')}}).catch(()=>{});
      return;
    }
    if(voice.route==='browser'){
      try{synth.resume();voice.paused=false;button.textContent='⏸';button.title='Pausar voz';button.setAttribute('aria-label','Pausar voz');button.setAttribute('aria-pressed','true')}catch(_){}
      return;
    }
  }
  unlockAudio();
  resetVoice();
  const content=speechText(text(article.dataset.iuSpeech||'').trim()||rawOf(article));if(!content)return;
  const token=voice.token;voice.active=article;voice.paused=false;voice.started=false;voice.completedChunks=0;voice.fallbackAttempted=false;
  button.textContent='◌';button.title='Generando voz natural';button.setAttribute('aria-label','Generando voz natural');button.setAttribute('aria-pressed','false');
  const prefs=window.WAESettings?.get?.()||{};
  if(cloudSupported()){
    cloudPlayback(content,button,token,prefs).catch(error=>{
      if(token!==voice.token)return;
      const code=String(error?.code||error?.name||'cloud_tts_failed').slice(0,80);
      if(code==='AbortError')return;
      voice.fallbackAttempted=true;
      voiceEvent('recovering',{code,route:'cloud_to_browser'});
      browserPlayback(content,button,token,prefs,{recoveredFrom:code});
    });
    return;
  }
  browserPlayback(content,button,token,prefs);
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
  if(!supported()){voiceButton.disabled=true;voiceButton.title='Voz no compatible con este navegador'}
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
  const envelope=takeEnvelope(article);
  article.dataset.iuRich='1';article.dataset.iuRaw=raw;
  if(envelope?.speechText)article.dataset.iuSpeech=text(envelope.speechText).slice(0,12000);
  if(envelope?.schema)article.dataset.iuResponseSchema=text(envelope.schema).slice(0,80);
  const body=document.createElement('div');body.className='iu-rich';body.innerHTML=rich(raw);p.replaceWith(body);
  const sources=sourceStrip(envelope);if(sources)article.append(sources);
  article.append(toolbar(article,raw));
  if(envelope){
    const detail={schema:envelope.schema||null,sourceCount:sourceRows(envelope).length,componentCount:Array.isArray(envelope.components)?envelope.components.length:0,requestId:envelope.metadata?.requestId||null};
    try{window.dispatchEvent(new CustomEvent('wae:assistant-envelope',{detail}))}catch(_){}
  }
  if(allowAuto&&auto&&!window.__waeHydratingHistory&&article===QA('#messages .message.assistant').at(-1)&&!/^El núcleo de inteligencia está reconectando/.test(raw)){
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
    voiceControl.addEventListener('click',e=>{e.stopImmediatePropagation();auto=!auto;localStorage.setItem(AUTO_KEY,auto?'on':'off');if(!auto)resetVoice();refresh();notify(auto?'Voz automática activada':'Voz automática desactivada')},true);window.addEventListener('wae:voice-settings',e=>{auto=!!e.detail?.auto;if(!auto)resetVoice();refresh()});refresh();
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
  // The stop control in polish-v2.js invokes WAEVoice.stop directly; no competing click handlers.
  const runtime=Q('.v2-runtime-copy');if(runtime&&/0 req|100%/.test(runtime.textContent||''))runtime.innerHTML='<strong>Universal Core</strong><small>Comprobando conexión…</small>';
  const efficiency=Q('.v2-efficiency');if(efficiency&&/100%/.test(efficiency.textContent||''))efficiency.innerHTML='<strong>CORE</strong><small>ONLINE</small>';
  const drawer=Q('#drawer');if(drawer)new MutationObserver(()=>QA('.v2-recent').forEach(n=>n.remove())).observe(drawer,{childList:true});
  Q('#newChatBtn')?.addEventListener('click',resetVoice);
  Q('#drawerNewChat')?.addEventListener('click',resetVoice);
  window.addEventListener('pagehide',resetVoice);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();