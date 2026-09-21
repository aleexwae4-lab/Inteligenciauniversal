(()=>{
  if(window.__iuPremiumExperience)return;
  window.__iuPremiumExperience={version:'1.0.0'};

  const css=document.createElement('link');css.rel='stylesheet';css.href='./gpt-experience-v1.css?v=1';document.head.appendChild(css);
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=v=>{try{const u=new URL(String(v),location.href);return /^https?:$/.test(u.protocol)?u.href:'#'}catch{return'#'}};
  const inline=v=>{
    let x=esc(v);
    x=x.replace(/`([^`]+)`/g,'<code>$1</code>');
    x=x.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,(_,label,url)=>`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    x=x.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>');
    x=x.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
    return x;
  };

  function renderMarkdown(raw){
    const lines=String(raw||'').replace(/\r/g,'').split('\n');
    let html='',list=null,table=[],inCode=false,codeLang='',code=[];
    const closeList=()=>{if(list){html+=`</${list}>`;list=null}};
    const flushTable=()=>{
      if(table.length<2){html+=table.map(line=>'<p>'+inline(line)+'</p>').join('');table=[];return false}
      const rows=table.map(r=>r.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
      if(!rows[1]?.every(c=>/^:?-{3,}:?$/.test(c))){html+=table.map(line=>'<p>'+inline(line)+'</p>').join('');table=[];return false}
      html+='<div class="rich-table-wrap"><table class="rich-table"><thead><tr>'+rows[0].map(c=>`<th>${inline(c)}</th>`).join('')+'</tr></thead><tbody>'+rows.slice(2).map(r=>'<tr>'+r.map(c=>`<td>${inline(c)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>';table=[];return true;
    };
    const flushCode=()=>{const text=esc(code.join('\n'));const lang=esc(codeLang||'código');html+=`<div class="iu-code"><div class="iu-code-head"><span>${lang}</span><button class="iu-code-copy" type="button">Copiar</button></div><pre><code>${text}</code></pre></div>`;code=[];codeLang=''};

    for(const line of lines){
      const fence=line.match(/^```\s*([\w.+#-]*)\s*$/);
      if(fence){closeList();if(table.length)flushTable();if(inCode){flushCode();inCode=false}else{inCode=true;codeLang=fence[1]||''}continue}
      if(inCode){code.push(line);continue}
      if(/^\|.*\|\s*$/.test(line)){closeList();table.push(line);continue}else if(table.length)flushTable();
      if(!line.trim()){closeList();continue}
      let m;
      if(/^---+$/.test(line.trim())){closeList();html+='<hr>';continue}
      if((m=line.match(/^#{1,4}\s+(.+)$/))){closeList();const level=Math.min(4,m[0].match(/^#+/)[0].length+1);html+=`<h${level}>${inline(m[1])}</h${level}>`;continue}
      if((m=line.match(/^[-*•]\s+(.+)$/))){if(list!=='ul'){closeList();list='ul';html+='<ul>'}html+=`<li>${inline(m[1])}</li>`;continue}
      if((m=line.match(/^\d+[.)]\s+(.+)$/))){if(list!=='ol'){closeList();list='ol';html+='<ol>'}html+=`<li>${inline(m[1])}</li>`;continue}
      if((m=line.match(/^>\s?(.+)$/))){closeList();html+=`<blockquote>${inline(m[1])}</blockquote>`;continue}
      if((m=line.match(/^:::metric\s+([^|]+)\|(.+)$/i))){closeList();html+=`<div class="iu-callout"><strong>${inline(m[1].trim())}</strong><span>${inline(m[2].trim())}</span></div>`;continue}
      if((m=line.match(/^:::progress\s+([^|]+)\|(\d{1,3})\s*$/i))){closeList();const n=Math.max(0,Math.min(100,Number(m[2])));html+=`<div class="iu-progress"><div class="iu-progress-top"><strong>${inline(m[1].trim())}</strong><span>${n}%</span></div><div class="iu-progress-track"><i style="width:${n}%"></i></div></div>`;continue}
      closeList();html+=`<p>${inline(line)}</p>`;
    }
    if(inCode)flushCode();if(table.length)flushTable();closeList();return html;
  }

  function storedAssistantTexts(){
    try{return (JSON.parse(localStorage.getItem('wae.messages')||'[]')||[]).filter(x=>x?.role==='assistant').map(x=>String(x.text||''))}catch{return[]}
  }
  function attachCodeCopy(root){
    $$('.iu-code-copy',root).forEach(btn=>{if(btn.dataset.bound)return;btn.dataset.bound='1';btn.addEventListener('click',()=>{const text=btn.closest('.iu-code')?.querySelector('code')?.textContent||'';(window.__waePremiumControlsV1?.copy?window.__waePremiumControlsV1.copy(text):navigator.clipboard?.writeText(text))?.then?.(ok=>{if(ok===false)return;btn.textContent='Copiado';setTimeout(()=>btn.textContent='Copiar',1200)}).catch(()=>window.toast?.('No se pudo copiar'))})});
  }
  function sourcesFromRuntime(data){return Array.isArray(data?.web_sources)?data.web_sources:Array.isArray(data?.response?.sources)?data.response.sources:[]}
  function decorateLatest(node){
    const data=window.__iuLastRuntime;if(!data||node.dataset.runtimeDecorated)return;
    const all=$$('.message.assistant:not(#typingMessage):not(#iuLiveStream)');if(all.at(-1)!==node)return;
    node.dataset.runtimeDecorated='1';
    const latency=Number(data.latency_ms??data.latencyMs),mem=Number(data.memory_count??data.memory?.recalled),sources=sourcesFromRuntime(data),meta=document.createElement('div');meta.className='iu-answer-meta';
    const labels=[];if(Number.isFinite(latency)&&latency>0)labels.push(`${(latency/1000).toFixed(latency>9500?0:1)} s`);if(Number.isFinite(mem)&&mem>0)labels.push(`${mem} memorias`);if(sources.length)labels.push(`${sources.length} fuentes`);if(data.degraded!==true)labels.push('respuesta completa');
    meta.innerHTML=labels.map((x,i)=>`<span class="${i===labels.length-1&&data.degraded!==true?'ok':''}">${esc(x)}</span>`).join('');if(labels.length)node.appendChild(meta);
    if(sources.length){const box=document.createElement('div');box.className='iu-sources';box.innerHTML='<div class="iu-sources-title">Fuentes</div>'+sources.slice(0,5).map((s,i)=>`<a class="iu-source" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.host||`Fuente ${i+1}`)}</a>`).join('');node.appendChild(box)}
  }
  function enhanceMessages(){
    const texts=storedAssistantTexts(),nodes=$$('.message.assistant:not(#typingMessage):not(#iuLiveStream)'),offset=Math.max(0,texts.length-nodes.length);
    nodes.forEach((node,i)=>{const body=$('.rich-answer',node),text=texts[i+offset];if(body&&text&&body.dataset.premiumRendered!=='1'){body.innerHTML=renderMarkdown(text);body.dataset.premiumRendered='1';attachCodeCopy(body)}});
    if(nodes.length)decorateLatest(nodes.at(-1));
    const live=$('#iuLiveStream');if(live&&nodes.at(-1)&&nodes.at(-1)!==live&&live.dataset.complete==='1')live.remove();
  }

  let liveText='',liveNode=null,renderTimer=null;
  function ensureLive(){
    if(liveNode?.isConnected)return liveNode;
    liveNode=document.createElement('article');liveNode.id='iuLiveStream';liveNode.className='message assistant iu-live-stream';liveNode.innerHTML='<div class="message-meta"><strong>Universal Core</strong><span>respondiendo</span></div><div class="rich-answer iu-live-body"></div><div class="iu-processing"><i class="iu-processing-dot"></i><span class="iu-processing-copy">Generando respuesta</span></div>';
    $('#messages')?.appendChild(liveNode);return liveNode;
  }
  function renderLive(){renderTimer=null;const node=ensureLive(),body=$('.iu-live-body',node);if(body){body.innerHTML=renderMarkdown(liveText)+(node.dataset.complete==='1'?'':'<span class="iu-stream-cursor"></span>');attachCodeCopy(body)}node.scrollIntoView({block:'end',behavior:'smooth'})}
  function scheduleLive(){if(!renderTimer)renderTimer=setTimeout(renderLive,70)}
  window.addEventListener('wae:stream-event',ev=>{
    const {event,data}=ev.detail||{};
    if(event==='response.start'){liveText='';liveNode=null;ensureLive();scheduleLive()}
    if(event==='reasoning.status'){const copy=$('.iu-processing-copy',ensureLive());if(copy)copy.textContent=data?.status==='buscando'?'Consultando fuentes':'Procesando contexto'}
    if(event==='content.delta'){liveText+=String(data?.text||'');scheduleLive()}
    if(event==='response.complete'){if(typeof data?.reply==='string'&&data.reply.trim())liveText=data.reply.trim();const node=ensureLive();node.dataset.complete='1';const copy=$('.iu-processing',node);if(copy)copy.remove();scheduleLive()}
    if(event==='response.error'){const copy=$('.iu-processing-copy',ensureLive());if(copy)copy.textContent='Cambiando a ruta de continuidad'}
  });

  const statusCopies=['Procesando contexto','Preparando una respuesta clara','Comprobando continuidad','Estructurando la respuesta'];let statusIndex=0,statusTimer=null;
  function syncThinking(){
    const typing=$('#typingMessage'),busy=document.documentElement.dataset.aiBusy==='true';
    if(busy&&typing){let row=$('.iu-processing',typing);if(!row){row=document.createElement('div');row.className='iu-processing';row.innerHTML='<i class="iu-processing-dot"></i><span class="iu-processing-copy">Procesando contexto</span>';typing.appendChild(row)}if(!statusTimer)statusTimer=setInterval(()=>{statusIndex=(statusIndex+1)%statusCopies.length;const c=$('.iu-processing-copy',typing);if(c)c.textContent=statusCopies[statusIndex]},1500)}
    else if(statusTimer){clearInterval(statusTimer);statusTimer=null}
  }

  const observer=new MutationObserver(()=>{enhanceMessages();syncThinking()});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ai-busy']});
  document.addEventListener('DOMContentLoaded',()=>{enhanceMessages();syncThinking()},{once:true});
  if(document.readyState!=='loading'){enhanceMessages();syncThinking()}
})();
