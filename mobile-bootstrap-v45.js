(()=>{
  'use strict';

  const previousFetch=window.fetch.bind(window);
  const EDGE_MARK='/functions/v1/wae-local-voice-demo-v61';
  const SID_KEY='iu.sessionId';
  const SECRET_KEY='iu.sessionSecret';
  const RELEASE='v45-render-first-bootstrap';

  function parseJsonBody(init={}){
    try{return typeof init.body==='string'?JSON.parse(init.body):{}}catch{return{}}
  }

  function isEdgeBootstrap(input,init={}){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw,location.href);
      const body=parseJsonBody(init);
      return url.pathname.includes(EDGE_MARK)
        && String(init.method||'GET').toUpperCase()==='POST'
        && body?.action==='bootstrap';
    }catch{return false}
  }

  function randomToken(prefix){
    try{
      if(globalThis.crypto?.randomUUID)return `${prefix}-${crypto.randomUUID()}`;
      const bytes=new Uint8Array(24);
      globalThis.crypto?.getRandomValues?.(bytes);
      const value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
      if(value)return `${prefix}-${value}`;
    }catch{}
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function localSession(){
    let sessionId='';
    let sessionSecret='';
    try{
      sessionId=localStorage.getItem(SID_KEY)||'';
      sessionSecret=localStorage.getItem(SECRET_KEY)||'';
      if(!sessionId){sessionId=randomToken('render');localStorage.setItem(SID_KEY,sessionId)}
      if(!sessionSecret){sessionSecret=randomToken('local');localStorage.setItem(SECRET_KEY,sessionSecret)}
    }catch{
      sessionId=sessionId||randomToken('render');
      sessionSecret=sessionSecret||randomToken('local');
    }
    return {session_id:sessionId,session_secret:sessionSecret};
  }

  function bootstrapResponse(){
    const session=localSession();
    return new Response(JSON.stringify({
      success:true,
      ...session,
      runtime:'render_primary',
      bootstrap:'local_nonblocking',
      release:RELEASE
    }),{
      status:200,
      headers:{
        'content-type':'application/json; charset=utf-8',
        'cache-control':'no-store',
        'x-wae-mobile-bootstrap':RELEASE
      }
    });
  }

  window.fetch=(input,init={})=>{
    if(isEdgeBootstrap(input,init))return Promise.resolve(bootstrapResponse());
    return previousFetch(input,init);
  };

  window.__WAE_MOBILE_BOOTSTRAP__={release:RELEASE,renderPrimary:true,edgeBlocking:false};
  document.documentElement.dataset.mobileBootstrap='v45-render-first';
})();
