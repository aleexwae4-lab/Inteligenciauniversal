(()=>{
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=u=>{try{const x=new URL(String(u));return /^https?:$/.test(x.protocol)?x.href:'#'}catch{return'#'}};
  const sourceMap=sources=>new Map((Array.isArray(sources)?sources:[]).map(x=>[String(x.key||''),x]));

  function inline(raw,sources){
    let t=esc(raw);
    t=t.replace(/`([^`]+)`/g,'<code>$1</code>');
    t=t.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    t=t.replace(/__([^_]+)__/g,'<strong>$1</strong>');
    t=t.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
    t=t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(m,label,url)=>`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    const sm=sourceMap(sources);
    t=t.replace(/\[(W\d+)\]/g,(m,key)=>sm.has(key)?`<a class="iu-source-ref" href="#source-${esc(key)}" title="Ver fuente">${esc(key)}</a>`:m);
    return t;
  }
  function chart(spec){
    if(!spec||!['bar','line'].includes(spec.type)||!Array.isArray(spec.items)||!spec.items.length)return'';
    const items=spec.items.slice(0,12).map(x=>({label:String(x.label||''),value:Number(x.value)})).filter(x=>x.label&&Number.isFinite(x.value));if(!items.length)return'';
    const min=Math.min(0,...items.map(x=>x.value)),max=Math.max(0,...items.map(x=>x.value)),span=max-min||1;
    if(spec.type==='line'){
      const w=640,h=230,p=30,pts=items.map((x,i)=>{const xx=p+(i*(w-p*2)/Math.max(1,items.length-1)),yy=h-p-((x.value-min)/span)*(h-p*2);return[xx,yy]});
      return `<figure class="iu-chart"><figcaption>${esc(spec.title||'Gráfica')}</figcaption><div class="iu-line-wrap"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(spec.title||'Gráfica')}"><path d="M ${pts.map(p=>p.join(' ')).join(' L ')}" fill="none" stroke="currentColor" stroke-width="3"/><g>${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4"><title>${esc(items[i].label)}: ${items[i].value}</title></circle>`).join('')}</g></svg></div><div class="iu-chart-labels">${items.map(x=>`<span>${esc(x.label)}</span>`).join('')}</div></figure>`;
    }
    return `<figure class="iu-chart"><figcaption>${esc(spec.title||'Comparación')}</figcaption><div class="iu-bars">${items.map(x=>{const pct=Math.max(3,((x.value-min)/span)*100);return`<div class="iu-bar-row"><span>${esc(x.label)}</span><div><i style="width:${pct}%"></i></div><strong>${esc(new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(x.value))}</strong></div>`}).join('')}</div></figure>`;
  }
  function table(lines,sources){
    const rows=lines.map(l=>l.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim()));if(rows.length<2)return'';
    const headers=rows[0],body=rows.slice(2);
    return `<div class="iu-table-wrap"><table><thead><tr>${headers.map(x=>`<th>${inline(x,sources)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${headers.map((_,i)=>`<td>${inline(r[i]||'',sources)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function rich(raw,sources=[]){
    const placeholders=[];
    raw=String(raw||'').replace(/```wae-chart\s*([\s\S]*?)```/gi,(_,body)=>{let html='';try{html=chart(JSON.parse(body.trim()))}catch{}const key=`@@BLOCK${placeholders.length}@@`;placeholders.push(html||`<pre><code>${esc(body)}</code></pre>`);return key})
      .replace(/```(?:\w+)?\s*([\s\S]*?)```/g,(_,body)=>{const key=`@@BLOCK${placeholders.length}@@`;placeholders.push(`<pre><code>${esc(body.trim())}</code></pre>`);return key});
    const lines=raw.split('\n'),out=[];let i=0;
    while(i<lines.length){const line=lines[i],trim=line.trim();if(!trim){i++;continue}
      if(/^@@BLOCK\d+@@$/.test(trim)){out.push(trim);i++;continue}
      const metric=trim.match(/^:::metric\s+([^|]+)\|([^|]+)(?:\|(.+))?$/i);if(metric){out.push(`<div class="iu-metric"><span>${inline(metric[1].trim(),sources)}</span><strong>${inline(metric[2].trim(),sources)}</strong>${metric[3]?`<small>${inline(metric[3].trim(),sources)}</small>`:''}</div>`);i++;continue}
      const prog=trim.match(/^:::progress\s+([^|]+)\|(\d+(?:\.\d+)?)$/i);if(prog){const v=Math.max(0,Math.min(100,Number(prog[2])));out.push(`<div class="iu-progress"><div><span>${inline(prog[1].trim(),sources)}</span><strong>${v}%</strong></div><div class="iu-progress-track"><i style="width:${v}%"></i></div></div>`);i++;continue}
      if(/^\|?.+\|.+\|?$/.test(trim)&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){const block=[line,lines[i+1]];i+=2;while(i<lines.length&&/\|/.test(lines[i])&&lines[i].trim())block.push(lines[i++]);out.push(table(block,sources));continue}
      const h=trim.match(/^(#{1,4})\s+(.+)$/);if(h){const level=Math.min(4,h[1].length+1);out.push(`<h${level}>${inline(h[2],sources)}</h${level}>`);i++;continue}
      if(/^>\s?/.test(trim)){out.push(`<blockquote>${inline(trim.replace(/^>\s?/,''),sources)}</blockquote>`);i++;continue}
      if(/^[-*+]\s+/.test(trim)){const list=[];while(i<lines.length&&/^\s*[-*+]\s+/.test(lines[i]))list.push(lines[i++].replace(/^\s*[-*+]\s+/,''));out.push(`<ul>${list.map(x=>`<li>${inline(x,sources)}</li>`).join('')}</ul>`);continue}
      if(/^\d+[.)]\s+/.test(trim)){const list=[];while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i]))list.push(lines[i++].replace(/^\s*\d+[.)]\s+/,''));out.push(`<ol>${list.map(x=>`<li>${inline(x,sources)}</li>`).join('')}</ol>`);continue}
      const para=[trim];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,4})\s+|^:::|^[-*+]\s+|^\d+[.)]\s+|^>\s?|^@@BLOCK\d+@@$/.test(lines[i].trim())){if(i+1<lines.length&&/\|/.test(lines[i])&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1]))break;para.push(lines[i].trim());i++}out.push(`<p>${inline(para.join(' '),sources)}</p>`);
    }
    let html=out.join('');placeholders.forEach((v,idx)=>{html=html.replace(`@@BLOCK${idx}@@`,v)});return html;
  }
  function sourcesHtml(sources){if(!Array.isArray(sources)||!sources.length)return'';return `<section class="iu-sources"><h4>Fuentes</h4><div>${sources.slice(0,6).map(s=>`<a id="source-${esc(s.key||'')}" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer"><span>${esc(s.key||'Fuente')}</span><strong>${esc(s.title||s.host||'Fuente')}</strong><small>${esc(s.host||'')}</small></a>`).join('')}</div></section>`}
  async function feedback(rating,button){
    const sid=localStorage.getItem('iu.sessionId')||'',secret=localStorage.getItem('iu.sessionSecret')||'',cid=localStorage.getItem('iu.conversationId')||'';if(!sid||!secret||!cid){window.toast?.('La sesión aún se está sincronizando');return}
    try{const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/iu_submit_feedback`,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY},body:JSON.stringify({p_session_id:sid,p_session_secret:secret,p_conversation_id:cid,p_rating:rating,p_reason:null})});if(!r.ok)throw new Error(`feedback_${r.status}`);button.parentElement?.querySelectorAll('[data-feedback]').forEach(b=>b.classList.remove('selected'));button.classList.add('selected');window.toast?.(rating>0?'Respuesta añadida al aprendizaje':'Feedback registrado')}catch(e){console.warn(e);window.toast?.('No pude registrar el feedback')}
  }
  function workspace(html){const editor=document.querySelector('#documentEditor');if(!editor)return;const placeholder=editor.querySelector('.placeholder-line');placeholder?.remove();editor.insertAdjacentHTML('beforeend',`<section class="workspace-ai-block">${html}</section>`);document.querySelector('#workspaceBtn')?.click();window.toast?.('Respuesta enviada al Workspace')}
  function enhance(article){if(!article||article.dataset.premium==='true'||article.id==='typingMessage'||!article.classList.contains('assistant'))return;const p=article.querySelector(':scope > p');if(!p)return;const raw=p.textContent||'';if(!raw)return;const runtime=window.__iuLastRuntime||{},isLatest=String(runtime.reply||'').trim()===raw.trim(),sources=isLatest?(runtime.web_sources||[]):[];p.outerHTML=`<div class="rich-content">${rich(raw,sources)}</div>${sourcesHtml(sources)}`;
    const actions=document.createElement('div');actions.className='iu-answer-actions';actions.innerHTML='<button type="button" data-act="listen">Escuchar</button><button type="button" data-act="copy">Copiar</button><button type="button" data-act="workspace">Workspace</button><span></span><button type="button" data-feedback="1" aria-label="Útil">Útil</button><button type="button" data-feedback="-1" aria-label="Mejorar">Mejorar</button>';article.appendChild(actions);
    actions.querySelector('[data-act="listen"]').addEventListener('click',e=>{if(document.documentElement.dataset.voicePlaying==='true'){window.__waeVoice?.stop();e.currentTarget.textContent='Escuchar'}else{e.currentTarget.textContent='Detener';window.__waeVoice?.speak(raw,{force:true}).finally(()=>e.currentTarget.textContent='Escuchar')}});
    actions.querySelector('[data-act="copy"]').addEventListener('click',()=>navigator.clipboard?.writeText(raw).then(()=>window.toast?.('Respuesta copiada')).catch(()=>{}));
    actions.querySelector('[data-act="workspace"]').addEventListener('click',()=>workspace(article.querySelector('.rich-content')?.innerHTML||esc(raw)));
    actions.querySelectorAll('[data-feedback]').forEach(b=>b.addEventListener('click',()=>feedback(Number(b.dataset.feedback),b)));
    article.dataset.premium='true';
    if(isLatest&&window.__waeVoice?.enabled&&!article.dataset.autoSpoken){article.dataset.autoSpoken='true';setTimeout(()=>window.__waeVoice.speak(raw).catch(()=>{}),120)}
  }
  function enhanceAll(){document.querySelectorAll('#messages .message.assistant').forEach(enhance)}
  function init(){
    const messages=document.querySelector('#messages');if(messages){enhanceAll();new MutationObserver(()=>enhanceAll()).observe(messages,{childList:true,subtree:true})}
    const form=document.querySelector('#composer');form?.addEventListener('submit',()=>window.__waeVoice?.unlock(),true);
    const voiceBtn=document.querySelector('#voiceBtn');if(voiceBtn){voiceBtn.title='Voz automática';voiceBtn.setAttribute('aria-pressed',String(window.__waeVoice?.enabled!==false));voiceBtn.addEventListener('click',()=>window.__waeVoice?.toggle().then(v=>voiceBtn.setAttribute('aria-pressed',String(v))),true)}
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  window.__waeRich={render:rich};
})();
