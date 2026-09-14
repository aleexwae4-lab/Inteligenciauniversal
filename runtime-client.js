(()=>{
  const nativeFetch=window.fetch.bind(window);
  const sessionId=localStorage.getItem('wae.sessionId')||crypto.randomUUID();
  localStorage.setItem('wae.sessionId',sessionId);
  if(!localStorage.getItem('wae.endpoint')) localStorage.setItem('wae.endpoint','/api/chat');
  window.__waeRuntimeAttachments=[];

  function isRuntimeChat(input){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw,location.href);
      return url.origin===location.origin&&url.pathname==='/api/chat';
    }catch{return false;}
  }

  window.fetch=async(input,init={})=>{
    if(isRuntimeChat(input)&&String(init.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
      try{
        const payload=JSON.parse(init.body);
        const history=JSON.parse(localStorage.getItem('wae.messages')||'[]')
          .slice(-12)
          .filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.text==='string')
          .map(m=>({role:m.role,text:m.text}));
        init={...init,body:JSON.stringify({...payload,sessionId,userKey:sessionId,history,attachments:window.__waeRuntimeAttachments||[]})};
      }catch{}
    }
    return nativeFetch(input,init);
  };

  async function readAttachments(files){
    const allowed=/\.(txt|md|markdown|json|csv|tsv|js|mjs|cjs|ts|tsx|jsx|css|html|htm|xml|yaml|yml|py|java|go|rs|sql|sh|log)$/i;
    const selected=[...files].slice(0,5);
    const output=[];
    for(const file of selected){
      const looksText=file.type.startsWith('text/')||file.type.includes('json')||file.type.includes('xml')||allowed.test(file.name);
      if(!looksText) continue;
      const text=(await file.text()).slice(0,120000);
      output.push({name:file.name,type:file.type||'text/plain',text});
    }
    window.__waeRuntimeAttachments=output;
    if(typeof window.toast==='function') window.toast(output.length?`${output.length} archivo(s) listos para IA`:'Ese formato aún no se procesa como texto');
  }

  async function loadHealth(){
    try{
      const res=await nativeFetch('/api/health',{headers:{'Accept':'application/json'},cache:'no-store'});
      const health=await res.json();
      const providers=(health.providers||[]).filter(p=>p.configured);
      const tools=(health.tools||[]).filter(t=>t.configured);
      const copy=document.querySelector('.v2-runtime-copy');
      const efficiency=document.querySelector('.v2-efficiency');
      if(copy){
        copy.innerHTML=providers.length
          ? `<strong>Universal Runtime · ${providers.length} proveedor${providers.length===1?'':'es'}</strong><small>${providers.map(p=>p.id).join(' · ')}${tools.length?` · ${tools.length} herramienta${tools.length===1?'':'s'}`:''}${health.memory?.configured?' · memoria activa':''}</small>`
          : '<strong>Universal Runtime · sin proveedor</strong><small>Configura una API key en Vercel para activar inferencia real</small>';
      }
      if(efficiency){
        efficiency.innerHTML=`<strong>${providers.length?'LIVE':'SETUP'}</strong><small>${providers.length?'RUNTIME IA':'CONFIGURACIÓN'}</small>`;
      }
      document.documentElement.dataset.runtimeReady=providers.length?'true':'false';
    }catch{
      const copy=document.querySelector('.v2-runtime-copy');
      if(copy)copy.innerHTML='<strong>Runtime no disponible</strong><small>La interfaz continúa en modo local seguro</small>';
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('#fileInput')?.addEventListener('change',e=>readAttachments(e.target.files));
    setTimeout(loadHealth,350);
  });
})();
