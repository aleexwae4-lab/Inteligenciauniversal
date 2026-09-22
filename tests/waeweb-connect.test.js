import test from "node:test";
import assert from "node:assert/strict";
import {waewebSettings,requestWaeweb,validateWaewebRequest,WaewebConnectError} from "../lib/waeweb-connect.js";
import {inboundWaewebConfigured,authenticateInboundWaeweb} from "../lib/waeweb-inbound.js";
const env={WAEWEB_CONNECT_ENABLED:"true",WAEWEB_CONNECT_BASE_URL:"https://waeweb.example.org/",
  WAEWEB_CONNECT_CLIENT_ID:"inteligenciauniversal",WAEWEB_CONNECT_TOKEN:"X".repeat(45)};
test("WAEWEB settings remain disabled unless explicitly configured",()=>{
  assert.equal(waewebSettings({}),null);
  assert.equal(waewebSettings({...env,WAEWEB_CONNECT_ENABLED:"false"}),null);
  assert.equal(waewebSettings({...env,WAEWEB_CONNECT_BASE_URL:"http://waeweb.example.org"}),null);
  assert.equal(waewebSettings({...env,WAEWEB_CONNECT_BASE_URL:"https://user:pass@waeweb.example.org/"}),null);
  assert.equal(waewebSettings({...env,WAEWEB_CONNECT_TOKEN:"short"}),null);
  assert.equal(waewebSettings({...env,WAEWEB_CONNECT_CLIENT_ID:"waeosgreen"}),null);
  assert.equal(waewebSettings(env).id,"inteligenciauniversal");
  assert.equal(waewebSettings({...env,WAEWEB_CONNECT_CLIENT_ID:"universal-core-vt3h"}).id,"universal-core-vt3h");
});
test("WAEWEB validates query, type and request shape independently",()=>{
  assert.throws(()=>validateWaewebRequest({query:"a"},"search"),WaewebConnectError);
  assert.throws(()=>validateWaewebRequest({query:"web",type:"invalid"},"search"),WaewebConnectError);
  assert.throws(()=>validateWaewebRequest({query:"web",fresh:"yes"},"search"),WaewebConnectError);
  assert.deepEqual(validateWaewebRequest({query:"web",fresh:true},"search"),{
    query:"web",type:"all",fresh:true});
});
test("WAEWEB client sends machine token only in server request and validates contract",async()=>{
  let observed;
  const transport=async(url,options)=>{
    observed={url,options};
    return Response.json({ok:true,contract:"waeweb-connect/v1",results:[]});
  };
  const result=await requestWaeweb("search",{query:"evidencia"},{env,transport});
  assert.equal(result.ok,true);
  assert.equal(observed.url,"https://waeweb.example.org/api/connect/v1/search");
  assert.equal(observed.options.headers.authorization,"Bearer "+env.WAEWEB_CONNECT_TOKEN);
  assert.equal(observed.options.headers["x-waeweb-client"],"inteligenciauniversal");
  assert.equal(observed.options.redirect,"error");
  assert.equal(JSON.parse(observed.options.body).query,"evidencia");
  assert.doesNotMatch(observed.url,/Bearer|XXXXX/);
  await assert.rejects(()=>requestWaeweb("search",{query:"web"},{
    env,transport:async()=>Response.json({ok:true,contract:"wrong"})
  }),{code:"waeweb_contract_invalid"});
  await assert.rejects(()=>requestWaeweb("search",{query:"web"},{
    env,transport:async()=>Response.json({error:"disabled"},{status:503})
  }),{code:"waeweb_upstream_503"});
});
test("WAEWEB refuses streams without SSE and accepts authenticated SSE response",async()=>{
  await assert.rejects(()=>requestWaeweb("stream",{query:"web"},{
    env,transport:async()=>Response.json({ok:true})
  }),{code:"waeweb_stream_contract_invalid"});
  const resp=await requestWaeweb("stream",{query:"web"},{
    env,transport:async()=>new Response("event: ready\\ndata: {}\\n\\n",{
      headers:{"content-type":"text/event-stream"}
    })
  });
  assert.match(resp.headers.get("content-type"),/text\/event-stream/);
});

test("Universal Core optional proxy cannot be abused by anonymous browser clients",()=>{
  const safeEnv={...env,WAEWEB_CONNECT_INBOUND_TOKEN:"separate-inbound-"+"Z".repeat(40)};
  assert.equal(inboundWaewebConfigured(env),false);
  assert.equal(inboundWaewebConfigured({...safeEnv,WAEWEB_CONNECT_INBOUND_TOKEN:env.WAEWEB_CONNECT_TOKEN}),false);
  assert.equal(inboundWaewebConfigured(safeEnv),true);
  assert.equal(authenticateInboundWaeweb({},safeEnv),false);
  assert.equal(authenticateInboundWaeweb({"x-waeweb-internal-token":env.WAEWEB_CONNECT_TOKEN},safeEnv),false);
  assert.equal(authenticateInboundWaeweb({"x-waeweb-internal-token":safeEnv.WAEWEB_CONNECT_INBOUND_TOKEN},safeEnv),true);
  assert.equal(authenticateInboundWaeweb({origin:"https://inteligenciauniversal.onrender.com",
    "x-waeweb-internal-token":safeEnv.WAEWEB_CONNECT_INBOUND_TOKEN},safeEnv),false);
  assert.equal(authenticateInboundWaeweb({"x-waeweb-internal-token":"wrong"},safeEnv),false);
});

test("SSE timeout stays active after headers arrive and interrupts a stalled body",async()=>{
  const stalled=()=>new ReadableStream({
    async pull(controller){
      await new Promise(resolve=>setTimeout(resolve,160));
      try{controller.enqueue(new TextEncoder().encode('event: results\\ndata: {}\\n\\n'));}
      catch{}
    }
  });
  const result=await requestWaeweb("stream",{query:"time bounded"},{
    env,timeoutMs:35,transport:async()=>new Response(stalled(),{
      headers:{"content-type":"text/event-stream"}
    })
  });
  await assert.rejects(async()=>{for await (const _chunk of result.body){};},
    /waeweb_stream_timeout/);
});

test("SSE enforces bounded transfer and aborts excessive payloads",async()=>{
  let transportSignal;
  const output=await requestWaeweb("stream",{query:"bounded web"},{
    env,transport:async(_url,opts)=>{
      transportSignal=opts.signal;
      return new Response(new ReadableStream({
        start(controller){
          controller.enqueue(new Uint8Array(129*1024));
          controller.close();
        }
      }),{headers:{"content-type":"text/event-stream"}});
    }
  });
  await assert.rejects(async()=>{for await(const _chunk of output.body){};},
    /waeweb_stream_too_large/);
  assert.equal(transportSignal.aborted,true);
});

test("SSE downstream cancellation aborts the upstream machine request",async()=>{
  let transportSignal;
  const response=await requestWaeweb("stream",{query:"cancelled"},{
    env,transport:async(_url,opts)=>{
      transportSignal=opts.signal;
      return new Response(new ReadableStream({
        start(controller){controller.enqueue(new TextEncoder().encode("event: ready\\ndata: {}\\n\\n"));}
      }),{headers:{"content-type":"text/event-stream"}});
    }
  });
  const reader=response.body.getReader();
  assert.equal((await reader.read()).done,false);
  await reader.cancel("client disconnect");
  assert.equal(transportSignal.aborted,true);
});
