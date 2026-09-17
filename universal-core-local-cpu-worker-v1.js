import { pipeline, env } from 'https://esm.run/@huggingface/transformers@3.8.1';

const MODEL='onnx-community/SmolLM-135M-Instruct-ONNX';
let generator=null;
let loading=null;

try{
  env.allowRemoteModels=true;
  env.useBrowserCache=true;
  if(env.backends?.onnx?.wasm) env.backends.onnx.wasm.numThreads=Math.max(1,Math.min(2,Number(self.navigator?.hardwareConcurrency||2)-1||1));
}catch{}

const clean=(v,max=30000)=>String(v??'').replace(/\u0000/g,'').trim().slice(0,max);
const post=(payload)=>self.postMessage(payload);

async function ensure(){
  if(generator)return generator;
  if(loading)return loading;
  loading=(async()=>{
    post({type:'state',state:'loading',backend:'wasm',model:MODEL,progress:0,text:'preparando CPU/WASM'});
    generator=await pipeline('text-generation',MODEL,{
      dtype:'q4',
      progress_callback:(report)=>{
        const p=Number(report?.progress);
        post({type:'state',state:'loading',backend:'wasm',model:MODEL,progress:Number.isFinite(p)?Math.max(0,Math.min(1,p)):0,text:clean(report?.file||report?.status||report?.name||'cargando modelo',140)});
      }
    });
    post({type:'state',state:'ready',backend:'wasm',model:MODEL,progress:1,text:'CPU/WASM listo'});
    return generator;
  })().catch(error=>{
    generator=null;
    post({type:'state',state:'error',backend:'wasm',model:MODEL,progress:0,error:clean(error?.message||error,300)});
    throw error;
  }).finally(()=>{loading=null});
  return loading;
}

function normalizeMessages(items=[]){
  return (Array.isArray(items)?items:[]).slice(-10).filter(x=>x&&['system','user','assistant'].includes(x.role)).map(x=>({role:x.role,content:clean(x.content??x.text,5000)})).filter(x=>x.content);
}

self.onmessage=async(event)=>{
  const msg=event?.data||{};
  const id=clean(msg.id,120);
  try{
    if(msg.type==='init'){
      await ensure();
      return post({type:'ready',id,backend:'wasm',model:MODEL});
    }
    if(msg.type==='generate'){
      const pipe=await ensure();
      const messages=normalizeMessages(msg.messages);
      if(!messages.length)throw new Error('messages_required');
      const output=await pipe(messages,{
        max_new_tokens:Math.max(48,Math.min(320,Number(msg.max_new_tokens||220))),
        do_sample:true,
        temperature:Math.max(0.1,Math.min(0.8,Number(msg.temperature||0.35))),
        top_p:0.9,
        repetition_penalty:1.08,
        return_full_text:true
      });
      const generated=output?.[0]?.generated_text;
      let text='';
      if(Array.isArray(generated)){
        const last=[...generated].reverse().find(x=>x?.role==='assistant'&&x?.content);
        text=clean(last?.content,30000);
      }else{
        text=clean(generated,30000);
      }
      if(!text)throw new Error('cpu_local_empty_reply');
      return post({type:'result',id,text,backend:'wasm',model:MODEL});
    }
  }catch(error){
    post({type:'error',id,error:clean(error?.message||error,300),backend:'wasm',model:MODEL});
  }
};
