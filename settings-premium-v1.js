(()=>{
'use strict';
const KEY='iu.premium.settings.v1',VOICE_KEY='iu.premium.voice.auto.v1';
const q=s=>document.querySelector(s);
const LIMITS={instructions:4000,knowledge:12000};
const initial=()=>({coreName:'Universal Core',instructions:'',knowledge:'',voiceURI:'',rate:1,pitch:1,auto:localStorage.getItem(VOICE_KEY)!=='off'});
const clean=s=>String(s==null?'':s).trim();
const num=(v,low,high)=>Math.max(low,Math.min(high,Number.isFinite(Number(v))?Number(v):1));
function load(){
  let data={};try{data=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){}
  if(!data||typeof data!=='object'||Array.isArray(data))data={};
  return {...initial(),coreName:clean(data.coreName||localStorage.getItem('wae.coreName')||'Universal Core').slice(0,80)||'Universal Core',instructions:clean(data.instructions).slice(0,LIMITS.instructions),knowledge:clean(data.knowledge).slice(0,LIMITS.knowledge),voiceURI:clean(data.voiceURI).slice(0,300),rate:num(data.rate,0.75,1.5),pitch:num(data.pitch,0.7,1.4),auto:localStorage.getItem(VOICE_KEY)!=='off'};
}
let config=load();
function voices(){return window.speechSynthesis?window.speechSynthesis.getVoices():[]}
function fillVoices(){
  const select=q('#iuVoiceSelect');if(!select)return;
  const current=select.value||config.voiceURI;
  const list=voices().filter(v=>/^es(?:-|_)/i.test(v.lang));
  const all=list.length?list:voices();
  select.replaceChildren(new Option('Automática · voz del dispositivo',''));
  all.forEach(v=>select.add(new Option(v.name+' · '+v.lang+(v.localService?' · local':''),v.voiceURI)));
  select.value=all.some(v=>v.voiceURI===current)?current:'';
  const hint=q('#iuVoiceCount');if(hint)hint.textContent=all.length?all.length+' voces disponibles en este navegador':'El navegador no expone un catálogo de voces todavía.';
}
function syncNumber(){
  const rate=q('#iuRate'),pitch=q('#iuPitch');
  if(rate)q('#iuRateValue').textContent=Number(rate.value).toFixed(2)+'×';
  if(pitch)q('#iuPitchValue').textContent=Number(pitch.value).toFixed(2);
}
function updateCounts(){
  for(const id of ['instructions','knowledge']){const el=q('#iu-'+id),counter=q('#iu-'+id+'-counter');if(el&&counter)counter.textContent=el.value.length+'/'+LIMITS[id];}
}
function open(){
  const dialog=q('#settingsDialog');if(!dialog)return;
  config=load();
  q('#iuCoreName').value=config.coreName;
  q('#iu-instructions').value=config.instructions;
  q('#iu-knowledge').value=config.knowledge;
  q('#iuVoiceSelect').value=config.voiceURI;
  q('#iuRate').value=config.rate;q('#iuPitch').value=config.pitch;
  q('#iuAutoVoice').checked=config.auto;
  fillVoices();syncNumber();updateCounts();
  q('#drawer')?.classList.remove('open');q('#drawer')?.setAttribute('aria-hidden','true');q('#scrim')?.classList.remove('visible');
  if(!dialog.open)dialog.showModal();
}
function save(){
  const next={
    coreName:clean(q('#iuCoreName').value).slice(0,80)||'Universal Core',
    instructions:clean(q('#iu-instructions').value).slice(0,LIMITS.instructions),
    knowledge:clean(q('#iu-knowledge').value).slice(0,LIMITS.knowledge),
    voiceURI:q('#iuVoiceSelect').value,rate:num(q('#iuRate').value,0.75,1.5),pitch:num(q('#iuPitch').value,0.7,1.4),auto:q('#iuAutoVoice').checked
  };
  localStorage.setItem(KEY,JSON.stringify(next));localStorage.setItem('wae.coreName',next.coreName);
  localStorage.setItem(VOICE_KEY,next.auto?'on':'off');config=next;
  document.dispatchEvent(new CustomEvent('wae:preferences-saved',{detail:next}));
  window.dispatchEvent(new CustomEvent('wae:voice-settings',{detail:{auto:next.auto}}));
  q('#settingsDialog')?.close();window.toast?.('Preferencias guardadas en este dispositivo');
}
function preview(){
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){window.toast?.('Voz no disponible en este navegador');return}
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance('Hola, soy Universal Core. Esta es una prueba de voz con tu configuración.');
  u.lang='es-MX';u.rate=num(q('#iuRate').value,.75,1.5);u.pitch=num(q('#iuPitch').value,.7,1.4);
  const chosen=voices().find(v=>v.voiceURI===q('#iuVoiceSelect').value);
  if(chosen)u.voice=chosen;
  window.speechSynthesis.speak(u);
}
function setView(){
  const dialog=q('#settingsDialog');if(!dialog)return;
  dialog.classList.add('iu-settings-dialog');
  dialog.innerHTML=String.raw`<div class="iu-settings-panel">
    <header class="iu-settings-header"><div><span class="iu-settings-eyebrow">UNIVERSAL CORE</span><h2>Configuración</h2><p>Personaliza tus respuestas y la voz.</p></div><button type="button" id="iuSettingsClose" aria-label="Cerrar configuración">×</button></header>
    <div class="iu-settings-scroll">
      <section class="iu-settings-section"><h3>Perfil e instrucciones</h3><label for="iuCoreName">Nombre de tu núcleo</label><input id="iuCoreName" type="text" maxlength="80" autocomplete="off">
      <label for="iu-instructions">Instrucciones generales <small id="iu-instructions-counter"></small></label><textarea id="iu-instructions" maxlength="4000" rows="5" placeholder="Ej.: responde en español, usa tablas solo cuando aporten valor y distingue hechos de hipótesis."></textarea>
      <p class="iu-settings-help">Se aplican a las nuevas consultas del asistente. No modifican sus reglas de seguridad.</p></section>
      <section class="iu-settings-section"><h3>Conocimiento general</h3><label for="iu-knowledge">Contexto y referencias que quieres compartir <small id="iu-knowledge-counter"></small></label><textarea id="iu-knowledge" maxlength="12000" rows="6" placeholder="Agrega información sobre tu empresa, servicios, productos, procesos o glosario."></textarea>
      <div class="iu-settings-inline"><button type="button" id="iuKnowledgeFile">＋ Importar .txt / .md</button><input type="file" accept=".txt,.md,text/plain,text/markdown" id="iuKnowledgeInput" hidden></div>
      <p class="iu-settings-help">Este texto se enviará al proveedor de IA cuando formules nuevas consultas. Es contexto declarado por ti, no información verificada automáticamente.</p></section>
      <section class="iu-settings-section"><h3>Voz</h3>
      <label class="iu-settings-toggle" for="iuAutoVoice"><span>Leer respuestas automáticamente</span><input id="iuAutoVoice" type="checkbox"></label>
      <label for="iuVoiceSelect">Seleccionar voz</label><select id="iuVoiceSelect"><option value="">Automática · voz del dispositivo</option></select>
      <p id="iuVoiceCount" class="iu-settings-help">Buscando voces…</p>
      <label for="iuRate">Velocidad <output id="iuRateValue">1.00×</output></label><input id="iuRate" type="range" min=".75" max="1.5" step=".05" value="1">
      <label for="iuPitch">Tono (pitch) <output id="iuPitchValue">1.00</output></label><input id="iuPitch" type="range" min=".7" max="1.4" step=".05" value="1">
      <div class="iu-settings-inline"><button type="button" id="iuPreviewVoice">▶ Probar voz</button><button type="button" id="iuStopPreview">■ Detener</button></div>
      <p class="iu-settings-help">Las voces y la reproducción automática dependen del navegador y sus permisos.</p></section>
      <p class="iu-settings-privacy">Tus preferencias se almacenan localmente en este navegador. No introduzcas contraseñas ni secretos: el contenido personalizado se envía al proveedor de IA para responder tus consultas.</p>
    </div><footer class="iu-settings-actions"><button type="button" id="iuCancelSettings">Cancelar</button><button type="button" id="iuSaveSettings">Guardar cambios</button></footer>
  </div>`;
  q('#iuSettingsClose').addEventListener('click',()=>dialog.close());
  q('#iuCancelSettings').addEventListener('click',()=>dialog.close());
  q('#iuSaveSettings').addEventListener('click',save);
  for(const id of ['instructions','knowledge'])q('#iu-'+id).addEventListener('input',updateCounts);
  q('#iuRate').addEventListener('input',syncNumber);q('#iuPitch').addEventListener('input',syncNumber);
  q('#iuPreviewVoice').addEventListener('click',preview);
  q('#iuStopPreview').addEventListener('click',()=>window.speechSynthesis?.cancel());
  q('#iuKnowledgeFile').addEventListener('click',()=>q('#iuKnowledgeInput').click());
  q('#iuKnowledgeInput').addEventListener('change',async()=>{
    const file=q('#iuKnowledgeInput').files?.[0];if(!file)return;
    if(!/(\.txt|\.md)$/i.test(file.name)||file.size>50000){window.toast?.('Solo archivos TXT/MD de hasta 50 KB');return}
    const value=(await file.text()).slice(0,LIMITS.knowledge);
    const area=q('#iu-knowledge');area.value=(area.value.trim()?area.value+'\n\n':'')+value;
    area.value=area.value.slice(0,LIMITS.knowledge);updateCounts();window.toast?.('Texto importado; guarda los cambios');
  });
  if(window.speechSynthesis){window.speechSynthesis.addEventListener?.('voiceschanged',fillVoices);}
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
}
window.WAESettings={open,save,get:()=>({...load()}),getPromptSettings:()=>{const c=load();return {instructions:c.instructions,knowledge:c.knowledge}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setView,{once:true});else setView();
})();