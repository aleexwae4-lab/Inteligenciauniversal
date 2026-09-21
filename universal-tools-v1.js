// Universal Core native tool registry: orchestration belongs to the chat, not to a camera-button special case.
(()=>{
  'use strict';
  const registered=new Map();
  let active=null,last=null;
  const emit=(kind,detail)=>window.dispatchEvent(new CustomEvent('wae:core-tool',{detail:{kind,...detail}}));
  const safeText=v=>String(v??'').trim();
  function register(tool){
    if(!tool||typeof tool!=='object'||!/^[-a-z0-9]+(?:\.[-a-z0-9]+)+$/i.test(tool.id)||typeof tool.canHandle!=='function'||typeof tool.run!=='function')throw Error('invalid_core_tool');
    if(registered.has(tool.id))throw Error('duplicate_core_tool:'+tool.id);
    const record=Object.freeze({id:tool.id,label:safeText(tool.label).slice(0,80),kind:safeText(tool.kind).slice(0,50),canHandle:tool.canHandle,run:tool.run});
    registered.set(record.id,record);emit('registered',{id:record.id,label:record.label});return record.id;
  }
  function list(){return [...registered.values()].map(t=>({id:t.id,label:t.label,kind:t.kind}))}
  function status(){return {registered:list(),active,last:last?{...last}:null}}
  function defaultQuestion(){for(const tool of registered.values()){if(tool.canHandle({})&&typeof window.WAECamera?.defaultQuestion==='function')return window.WAECamera.defaultQuestion()}return''}
  async function runTurn(context={}){
    if(active)throw Object.assign(Error('Ya hay una herramienta trabajando'),{code:'core_tool_busy'});
    const available=[...registered.values()].filter(tool=>tool.canHandle(context));
    if(!available.length)return {handled:false};
    // One visual source at a time; never secretly dispatch to multiple providers.
    const tool=available[0],started=Date.now();
    active=tool.id;emit('start',{id:tool.id,label:tool.label});
    try{
      const result=await tool.run(context);
      if(!result||typeof result.reply!=='string'||!result.reply.trim())throw Object.assign(Error('La herramienta no devolvió análisis verificable'),{code:'core_tool_empty'});
      last={id:tool.id,ok:true,at:new Date().toISOString(),elapsedMs:Date.now()-started};
      emit('success',{...last});
      return {handled:true,reply:result.reply,tool:tool.id,metadata:result.metadata||null};
    }catch(error){
      last={id:tool.id,ok:false,at:new Date().toISOString(),elapsedMs:Date.now()-started,code:String(error?.code||'core_tool_error')};
      emit('failure',{...last});
      throw error;
    }finally{active=null}
  }
  window.WAECoreTools=Object.freeze({register,list,status,runTurn,defaultQuestion});
})();