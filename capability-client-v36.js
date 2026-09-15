(()=>{
  'use strict';
  async function boot(){
    const status=document.querySelector('.status-strip .status-meta');
    if(!status)return;
    try{
      const response=await fetch('/api/capabilities',{headers:{accept:'application/json'},cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json();
      const kernel=payload.capabilityKernel;
      if(!kernel)return;
      const ready=kernel.byStatus?.ready||0;
      const partial=kernel.byStatus?.partial||0;
      status.textContent=`${kernel.domainCount} dominios · ${ready} listos · ${partial} parciales`;
      status.title=`${kernel.abilityCount} capacidades mapeadas · ${kernel.version}`;
      window.WAE_CAPABILITY_KERNEL=kernel;
    }catch(error){
      status.textContent='capacidades · diagnóstico pendiente';
      console.warn('[Universal Core] capability kernel unavailable',error);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
