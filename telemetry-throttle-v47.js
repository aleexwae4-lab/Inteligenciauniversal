(()=>{
  'use strict';
  if(window.__WAE_TELEMETRY_THROTTLE_V47__)return;

  const downstream=window.fetch.bind(window);
  const DIAG='/api/ui-diagnostics';
  const DROP=new Set(['input','pointerdown','touchstart','focus']);
  const COALESCE_MS=5000;
  const lastSent=new Map();
  let dropped=0;

  function diagnostic(input,init={}){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw,location.href);
      if(url.pathname!==DIAG||String(init.method||'GET').toUpperCase()!=='POST')return null;
      const body=typeof init.body==='string'?JSON.parse(init.body):{};
      return {event:String(body?.event||''),body};
    }catch{return null}
  }

  function synthetic(){
    return Promise.resolve(new Response(JSON.stringify({ok:true,throttled:true}),{
      status:200,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-telemetry':'throttled-v47'}
    }));
  }

  window.fetch=(input,init={})=>{
    const d=diagnostic(input,init);
    if(!d)return downstream(input,init);
    if(DROP.has(d.event)){
      dropped++;
      return synthetic();
    }
    if(d.event==='page_loaded'||d.event==='sw_state'){
      const now=Date.now(),last=Number(lastSent.get(d.event)||0);
      if(now-last<COALESCE_MS){dropped++;return synthetic()}
      lastSent.set(d.event,now);
    }
    return downstream(input,init);
  };

  window.__WAE_TELEMETRY_THROTTLE_V47__={
    version:'47.0.0',
    droppedEvents:[...DROP],
    get dropped(){return dropped}
  };
  document.documentElement.dataset.telemetry='throttled-v47';
})();
