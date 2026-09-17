(()=>{
  'use strict';
  if(window.__WAE_MOBILE_BRAIN_V110__)return;

  const priorFetch=window.fetch.bind(window);
  const EDGE_MARK='/functions/v1/wae-local-voice-demo-v61';
  const VERSION='mobile-brain/v110-full-universal-core';

  function parseBody(init={}){
    try{return typeof init.body==='string'?JSON.parse(init.body):{}}catch{return{}}
  }
  function isEdgeChat(input,init={}){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw,location.href);
      const body=parseBody(init);
      return {match:url.pathname.includes(EDGE_MARK)&&String(init.method||'GET').toUpperCase()==='POST'&&body?.action==='chat',body};
    }catch{return{match:false,body:{}}}
  }
  function normalizedMode(body={}){
    const mode=String(body.mode||'general').toLowerCase();
    return ['general','research','analysis','code','design','executive'].includes(mode)?mode:'general';
  }
  async function fullCore(body={},init={}){
    const sessionId=String(body.session_id||body.sessionId||localStorage.getItem('iu.sessionId')||'');
    const conversationId=body.conversation_id||localStorage.getItem('iu.conversationId')||null;
    const payload={
      message:String(body.message||''),
      mode:normalizedMode(body),
      sessionId,
      conversationId,
      attachments:Array.isArray(body.attachments)?body.attachments:[],
      web_enabled:body.web_enabled===true,
      preferences:{responseStyle:'premium-rich',voiceNatural:true,surface:'mobile-universal-core-v110'}
    };
    const response=await priorFetch('/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json','x-wae-mobile-brain':VERSION},
      body:JSON.stringify(payload),
      cache:'no-store',
      signal:init.signal
    });
    const data=await response.clone().json().catch(()=>null);
    const reply=String(data?.reply||data?.response?.content||'').trim();
    if(!response.ok||!reply)return null;
    if(data?.conversation_id)localStorage.setItem('iu.conversationId',String(data.conversation_id));
    return new Response(JSON.stringify({...data,success:true,conversation_id:data?.conversation_id||conversationId}),{
      status:200,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-runtime':VERSION}
    });
  }

  window.fetch=async(input,init={})=>{
    const edge=isEdgeChat(input,init);
    if(!edge.match)return priorFetch(input,init);
    try{
      const primary=await fullCore(edge.body,init);
      if(primary)return primary;
    }catch(error){
      if(String(error?.name||'').toLowerCase()==='aborterror')throw error;
    }
    return priorFetch(input,init);
  };

  window.__WAE_MOBILE_BRAIN_V110__={version:VERSION,primary:'/api/chat',fallback:'supabase-edge'};
  document.documentElement.dataset.mobileBrain='v110';
  window.dispatchEvent(new CustomEvent('wae:mobile-brain-ready',{detail:{version:VERSION,primary:'/api/chat'}}));
})();
