(()=>{
  const originalFetch=window.fetch.bind(window);
  const BOOT_TIMEOUT_MS=5000;
  const AUX_TIMEOUT_MS=4500;

  function timeoutSignal(ms, upstream){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort('startup_timeout'),ms);
    if(upstream){
      if(upstream.aborted)controller.abort(upstream.reason);
      else upstream.addEventListener('abort',()=>controller.abort(upstream.reason),{once:true});
    }
    return {signal:controller.signal,clear:()=>clearTimeout(timer)};
  }

  function classify(input,init={}){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw,location.href);
      const method=String(init.method||'GET').toUpperCase();
      if(method==='POST'&&url.hostname.endsWith('.supabase.co')){
        let action='';
        try{action=JSON.parse(typeof init.body==='string'?init.body:'{}')?.action||''}catch{}
        if(['bootstrap','health','list_conversations','capabilities','learning_status','route_preview'].includes(action))return BOOT_TIMEOUT_MS;
      }
      if(url.origin===location.origin&&method==='GET'&&['/api/performance','/api/capabilities','/api/health'].includes(url.pathname))return AUX_TIMEOUT_MS;
    }catch{}
    return 0;
  }

  window.fetch=async(input,init={})=>{
    const ms=classify(input,init);
    if(!ms||init.signal)return originalFetch(input,init);
    const timer=timeoutSignal(ms);
    try{return await originalFetch(input,{...init,signal:timer.signal})}
    finally{timer.clear()}
  };

  const markInteractive=()=>{
    document.documentElement.dataset.boot='interactive';
    window.dispatchEvent(new CustomEvent('wae:boot-interactive'));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',markInteractive,{once:true});
  else markInteractive();

  window.__waeStartup={version:'v23',interactive:true,bootTimeoutMs:BOOT_TIMEOUT_MS,auxTimeoutMs:AUX_TIMEOUT_MS};
})();
