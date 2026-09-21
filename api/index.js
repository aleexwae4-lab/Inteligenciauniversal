/* Single Vercel function entrypoint; implementations stay unchanged in api/. */
const routes=Object.freeze({
  "benchmark-v93":()=>import("./benchmark-v93.js"),
  "capabilities":()=>import("./capabilities.js"),
  "capacity-certification":()=>import("./capacity-certification.js"),
  "capacity-chat-v105":()=>import("./capacity-chat-v105.js"),
  "capacity-chat-v58":()=>import("./capacity-chat-v58.js"),
  "capacity-chat-v60":()=>import("./capacity-chat-v60.js"),
  "capacity-chat-v61":()=>import("./capacity-chat-v61.js"),
  "capacity-chat-v62":()=>import("./capacity-chat-v62.js"),
  "capacity-chat-v63":()=>import("./capacity-chat-v63.js"),
  "capacity-chat-v76":()=>import("./capacity-chat-v76.js"),
  "capacity-chat-v77":()=>import("./capacity-chat-v77.js"),
  "capacity-chat-v81":()=>import("./capacity-chat-v81.js"),
  "capacity-chat-v82":()=>import("./capacity-chat-v82.js"),
  "capacity-chat-v83":()=>import("./capacity-chat-v83.js"),
  "capacity-chat-v84":()=>import("./capacity-chat-v84.js"),
  "capacity-chat-v86":()=>import("./capacity-chat-v86.js"),
  "capacity-chat-v87":()=>import("./capacity-chat-v87.js"),
  "capacity-chat-v88":()=>import("./capacity-chat-v88.js"),
  "capacity-chat-v89":()=>import("./capacity-chat-v89.js"),
  "capacity-chat-v90":()=>import("./capacity-chat-v90.js"),
  "capacity-chat-v91":()=>import("./capacity-chat-v91.js"),
  "capacity-chat":()=>import("./capacity-chat.js"),
  "chat":()=>import("./chat.js"),
  "continuity":()=>import("./continuity.js"),
  "evals-v62":()=>import("./evals-v62.js"),
  "evals":()=>import("./evals.js"),
  "execute":()=>import("./execute.js"),
  "health":()=>import("./health.js"),
  "knowledge":()=>import("./knowledge.js"),
  "live-data":()=>import("./live-data.js"),
  "mobile":()=>import("./mobile.js"),
  "native-brain":()=>import("./native-brain.js"),
  "orchestrate":()=>import("./orchestrate.js"),
  "performance":()=>import("./performance.js"),
  "premium-gate-v98":()=>import("./premium-gate-v98.js"),
  "tasks":()=>import("./tasks.js"),
  "tools":()=>import("./tools.js"),
  "ui-diagnostics":()=>import("./ui-diagnostics.js"),
  "web-intelligence":()=>import("./web-intelligence.js"),
});
export default async function vercelUniversalRouter(req,res){
  const raw=req.query?.wae_route;
  const name=String(Array.isArray(raw)?raw[0]:raw||'').replace(/\.js$/,'');
  if(!Object.prototype.hasOwnProperty.call(routes,name))return res.status(404).json({error:'not_found'});
  try{
    const mod=await routes[name]();
    if(typeof mod.default!=='function')return res.status(404).json({error:'not_found'});
    return await mod.default(req,res);
  }catch(error){
    console.error('[Universal Core] api route failed',name,String(error?.message||error).slice(0,240));
    if(!res.headersSent)return res.status(500).json({error:'api_route_failed'});
  }
}
