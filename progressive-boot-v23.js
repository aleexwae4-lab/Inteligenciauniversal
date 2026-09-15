(()=>{
  let started=false;
  const loadScript=src=>new Promise(resolve=>{
    if(document.querySelector(`script[data-progressive-src="${src}"]`)){resolve(true);return}
    const s=document.createElement('script');
    s.src=src;s.defer=true;s.dataset.progressiveSrc=src;
    s.onload=()=>resolve(true);s.onerror=()=>resolve(false);
    document.head.appendChild(s);
  });

  const start=async()=>{
    if(started)return;started=true;
    document.documentElement.dataset.enhancement='loading';
    const [polish,premium,learning,semanticUx,capabilities]=await Promise.all([
      loadScript('./polish-v2.js'),
      loadScript('./gpt-experience-v1.js?v=1'),
      loadScript('./learning-client-v29.js?v=1'),
      loadScript('./semantic-ux-v32.js?v=33'),
      loadScript('./capability-client-v36.js?v=37')
    ]);
    const ok=polish&&premium&&learning&&semanticUx&&capabilities;
    document.documentElement.dataset.enhancement=ok?'ready':'degraded';
    window.dispatchEvent(new CustomEvent('wae:enhancement-ready',{detail:{ok,polish,premium,learning,semanticUx,capabilities}}));
  };

  const schedule=()=>{
    if('requestIdleCallback'in window)requestIdleCallback(()=>start(),{timeout:700});
    else setTimeout(start,220);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();

  document.addEventListener('pointerdown',()=>start(),{once:true,passive:true});
  document.addEventListener('keydown',()=>start(),{once:true});
  window.__waeProgressiveBoot={version:'v37-execution-plane',start};
})();
