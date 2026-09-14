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
    const ok=await loadScript('./polish-v2.js');
    document.documentElement.dataset.enhancement=ok?'ready':'degraded';
    window.dispatchEvent(new CustomEvent('wae:enhancement-ready',{detail:{ok}}));
  };

  const schedule=()=>{
    if('requestIdleCallback'in window)requestIdleCallback(()=>start(),{timeout:1200});
    else setTimeout(start,450);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();

  document.addEventListener('pointerdown',()=>start(),{once:true,passive:true});
  document.addEventListener('keydown',()=>start(),{once:true});
  window.__waeProgressiveBoot={version:'v23',start};
})();
