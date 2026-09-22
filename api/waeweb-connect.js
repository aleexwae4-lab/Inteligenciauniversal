// Optional, server-only WAEWEB realtime search/reader provider.
// The existing /api/web/* endpoints remain authoritative and unchanged.
import { applyHeaders, originAllowed, allowRequest } from "../lib/security.js";
import { requestWaeweb, waewebSettings, WaewebConnectError } from "../lib/waeweb-connect.js";
import { authenticateInboundWaeweb, inboundWaewebConfigured } from "../lib/waeweb-inbound.js";

export default async function waewebConnectHandler(req,res){
  applyHeaders(res);
  if(!waewebSettings() || !inboundWaewebConfigured())
    return res.status(503).json({error:"waeweb_connect_disabled"});
  if(!authenticateInboundWaeweb(req.headers))
    return res.status(401).json({error:"waeweb_inbound_unauthorized"});
  if(!originAllowed(req))return res.status(403).json({error:"origin_not_allowed"});
  if(!allowRequest(req,8,20))return res.status(429).json({error:"rate_limited"});
  const pathname=new URL(req.url||"/api/waeweb/status","http://localhost").pathname;
  const kind=pathname.split("/").at(-1);
  if(!["status","search","stream","retrieve"].includes(kind))
    return res.status(404).json({error:"waeweb_route_not_found"});
  if(req.method!==(kind==="status"?"GET":"POST"))
    return res.status(405).json({error:"method_not_allowed"});
  try{
    const result=await requestWaeweb(kind,req.body||null);
    res.setHeader("X-WAE-Web-Provider","waeweb-connect/v1");
    if(kind==="stream"){
      res.statusCode=200;
      res.setHeader("Content-Type","text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control","no-store, no-transform");
      for await (const chunk of result.body) {
        if(res.destroyed||res.writableEnded)break;
        res.write(chunk);
      }
      return res.end();
    }
    return res.status(200).json({success:true,provider:"waeweb",...result});
  }catch(error){
    if(res.headersSent){
      // A streaming HTTP 200 may still fail after the initial SSE frame.
      // Surface the failure in the event protocol, never as silent success.
      if(!res.destroyed&&!res.writableEnded){
        res.write('event: error\\ndata: {"error":"waeweb_stream_interrupted"}\\n\\n');
        res.write('event: done\\ndata: {"ok":false}\\n\\n');
        res.end();
      }
      return;
    }
    const status=error instanceof WaewebConnectError?error.status:502;
    const code=error instanceof WaewebConnectError?error.code:"waeweb_connect_failed";
    return res.status(status).json({error:code,provider:"waeweb"});
  }
}
