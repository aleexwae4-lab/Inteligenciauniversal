(()=>{
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const VOICE_ENDPOINT=`${SUPABASE_URL}/functions/v1/wae-natural-voice-v60`;
  const SID='iu.sessionId',SECRET='iu.sessionSecret',VOICE_ENABLED='iu.voiceEnabled',VOICE_NAME='iu.voiceName';
  let enabled=localStorage.getItem(VOICE_ENABLED)!=='false';
  let voice=localStorage.getItem(VOICE_NAME)||'Kore';
  let context=null,currentSource=null,currentAudio=null,runId=0;

  const toast=m=>window.toast?.(m);
  const session=()=>({session_id:localStorage.getItem(SID)||'',session_secret:localStorage.getItem(SECRET)||''});
  const cleanChunk=t=>String(t||'').trim();
  function chunks(text,max=3400){
    text=cleanChunk(text);if(!text)return[];
    const parts=text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/u),out=[];let buf='';
    for(const part of parts){
      if(part.length>max){if(buf){out.push(buf);buf=''};for(let i=0;i<part.length;i+=max)out.push(part.slice(i,i+max));continue}
      if((buf+' '+part).trim().length>max){out.push(buf);buf=part}else buf=(buf+' '+part).trim();
    }
    if(buf)out.push(buf);return out;
  }
  function getContext(){
    if(context)return context;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(AC)context=new AC({latencyHint:'interactive'});
    return context;
  }
  async function unlock(){try{const c=getContext();if(c?.state==='suspended')await c.resume();return true}catch{return false}}
  function stop(){runId++;try{currentSource?.stop()}catch{}currentSource=null;if(currentAudio){currentAudio.pause();currentAudio.src='';currentAudio=null}document.documentElement.dataset.voicePlaying='false'}
  async function fetchAudio(text){
    const s=session();if(!s.session_id||!s.session_secret)throw new Error('voice_session_missing');
    const r=await fetch(VOICE_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-inteligencia-universal-voice/1.0'},body:JSON.stringify({action:'speak',...s,text,voice}),cache:'no-store'});
    if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||`voice_${r.status}`)}
    return r.arrayBuffer();
  }
  async function playBuffer(buffer,myRun){
    const c=getContext();
    if(c){
      if(c.state==='suspended')await c.resume();
      const decoded=await c.decodeAudioData(buffer.slice(0));if(myRun!==runId)return;
      await new Promise((resolve,reject)=>{const src=c.createBufferSource();currentSource=src;src.buffer=decoded;src.connect(c.destination);src.onended=()=>{if(currentSource===src)currentSource=null;resolve()};try{src.start()}catch(e){reject(e)}});return;
    }
    const blob=new Blob([buffer],{type:'audio/wav'}),url=URL.createObjectURL(blob);await new Promise((resolve,reject)=>{const a=new Audio(url);currentAudio=a;a.onended=()=>{URL.revokeObjectURL(url);resolve()};a.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('audio_playback_failed'))};a.play().catch(reject)});
  }
  async function speak(text,{force=false}={}){
    if(!enabled&&!force)return false;stop();const myRun=runId;document.documentElement.dataset.voicePlaying='true';
    try{
      await unlock();
      for(const chunk of chunks(text)){if(myRun!==runId)return false;const audio=await fetchAudio(chunk);if(myRun!==runId)return false;await playBuffer(audio,myRun)}
      return true;
    }catch(e){console.warn('[WAE Voice]',e?.message||e);toast('La voz está disponible en Escuchar');return false}
    finally{if(myRun===runId)document.documentElement.dataset.voicePlaying='false'}
  }
  async function setEnabled(value){enabled=!!value;localStorage.setItem(VOICE_ENABLED,String(enabled));if(!enabled)stop();const s=session();if(s.session_id&&s.session_secret){fetch(VOICE_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({action:'preferences',...s,set:{voice_enabled:enabled,voice_name:voice}}),cache:'no-store'}).catch(()=>{})}return enabled}
  async function toggle(){const value=await setEnabled(!enabled);toast(value?'Voz automática activada':'Voz automática desactivada');return value}
  async function setVoice(name){voice=String(name||'Kore');localStorage.setItem(VOICE_NAME,voice);return voice}
  window.__waeVoice={speak,stop,toggle,unlock,setEnabled,setVoice,get enabled(){return enabled},get voice(){return voice}};
})();
