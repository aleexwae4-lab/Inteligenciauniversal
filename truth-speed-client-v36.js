(()=>{
  const VERSION='truth-speed-client/v36';
  const EDGE_HOST='pbswcbryxawsmltyromd.supabase.co';
  const EDGE_PATH='/functions/v1/wae-local-voice-demo-v61';
  const previousFetch=window.fetch.bind(window);

  const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const CURRENT_RX=/\b(hoy|ahora|actual(?:es|idad|izado|izada)?|reciente|ultim[oa]s?|latest|today|current|news|noticias|precio|cotizacion|jurisprudencia|reforma|ley vigente|presidente actual|ceo actual)\b/i;
  const RESEARCH_RX=/\b(investiga|investigacion|fuentes?|citas?|verifica|benchmark|estadistica|mercado|competidor|buscar en (?:la )?web)\b|\b(?:con|usa|aporta|incluye)\s+evidencia\b|\bevidencia\s+(?:web|externa|verificable|actual|de fuentes?)\b/i;
  const HIGH_RISK_RX=/\b(medic|salud|diagnostic|tratamiento|dosis|farmacol|legal|juridic|penal|delito|fiscal|tributar|inversion|credito|fraude|seguridad critica|alto riesgo|high[- ]risk)\b/i;
  const STRUCTURED_RX=/\b(?:devuelve|responde|entrega|genera|salida|output|formato)\b[\s\S]{0,100}\b(?:json|yaml|csv|xml|tabla|table)\b|\b(?:json|yaml|csv|xml|tabla|table)\b[\s\S]{0,100}\b(?:devuelve|responde|entrega|genera|salida|output|formato)\b/i;

  function requestUrl(input){
    try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}
  }
  function parseBody(init={}){
    try{return typeof init.body==='string'?JSON.parse(init.body):null}catch{return null}
  }
  function policy(payload={}){
    const q=fold(payload.message||payload.task||'');
    const current=CURRENT_RX.test(q),research=String(payload.mode||'').toLowerCase()==='research'||payload.web_enabled===true||RESEARCH_RX.test(q),highRisk=HIGH_RISK_RX.test(q),structured=STRUCTURED_RX.test(q);
    return{gate:current||research||highRisk||structured,current,research,highRisk,structured};
  }
  function isEdgeChat(url,payload){return !!url&&url.hostname===EDGE_HOST&&url.pathname===EDGE_PATH&&payload?.action==='chat'}
  function isLocalChat(url){return !!url&&url.origin===location.origin&&url.pathname==='/api/chat'}
  function serverPayload(payload={}){
    return{
      message:String(payload.message||payload.task||''),
      mode:String(payload.mode||'general'),
      sessionId:String(payload.session_id||payload.sessionId||payload.conversation_id||''),
      attachments:Array.isArray(payload.attachments)?payload.attachments:[],
      web_enabled:payload.web_enabled===true,
      preferences:{responseStyle:'premium-rich',voiceNatural:true,truthSpeedGate:VERSION}
    };
  }
  function gatedResponse(payload,init){
    const headers=new Headers();
    headers.set('content-type','application/json');
    headers.set('x-wae-truth-speed-client',VERSION);
    return previousFetch('/api/truth-chat',{
      method:'POST',headers,body:JSON.stringify(serverPayload(payload)),cache:'no-store',signal:init?.signal
    });
  }

  window.fetch=async(input,init={})=>{
    if(String(init.method||'GET').toUpperCase()!=='POST')return previousFetch(input,init);
    const url=requestUrl(input),payload=parseBody(init);
    if(!payload)return previousFetch(input,init);
    const targetEdge=isEdgeChat(url,payload),targetLocal=isLocalChat(url);
    if(!targetEdge&&!targetLocal)return previousFetch(input,init);
    const decision=policy(payload);
    if(!decision.gate)return previousFetch(input,init);

    document.documentElement.dataset.truthSpeedGate='active';
    window.dispatchEvent(new CustomEvent('wae:truth-speed-gate',{detail:{version:VERSION,current:decision.current,research:decision.research,highRisk:decision.highRisk,structured:decision.structured}}));

    // Mobile attempts verified SSE first. Gated requests intentionally skip that
    // direct Edge stream so the next non-stream attempt is inspected by the server gate.
    if(targetEdge&&(payload.stream===true||(new Headers(init.headers||{}).get('accept')||'').includes('text/event-stream'))){
      return new Response(JSON.stringify({error:'truth_gate_requires_verified_response',recoverable:true}),{status:409,headers:{'content-type':'application/json','x-wae-truth-speed-client':VERSION}});
    }
    return gatedResponse(payload,init);
  };

  window.__waeTruthSpeed={version:VERSION,policy,active:true};
})();
