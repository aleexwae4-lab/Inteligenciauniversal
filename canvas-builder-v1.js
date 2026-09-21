(()=>{
'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const word=value=>String(value??'').replace(/\s+/g,' ').trim();
const text=(value,max=260)=>word(value).slice(0,max);
const normalize=value=>word(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const palettes={
  warm:['#20140f','#35251d','#dfad73','#ffeddb','#b77b44'],
  forest:['#0b1916','#153128','#8ce2ba','#ecffed','#4ba881'],
  blue:['#0c1529','#17284a','#9bc2ff','#edf4ff','#5b8cdb'],
  violet:['#171127','#2b1e45','#c7b0ff','#f9f2ff','#9272d3'],
  coral:['#241319','#48282d','#ffa99b','#fff0e9','#d78378']
};
function decode(raw){
 let source=String(raw??'').trim();
 const fence=source.match(/[\x60]{3}(?:json)?\s*([\s\S]*?)[\x60]{3}/i);
 if(fence)source=fence[1].trim();
 try{return JSON.parse(source)}catch(_){}
 const first=source.indexOf('{'),last=source.lastIndexOf('}');
 if(first<0||last<=first)throw Error('La IA no entregó una estructura JSON completa');
 try{return JSON.parse(source.slice(first,last+1))}catch(_){throw Error('La IA entregó JSON incompleto')}
}
function validate(raw,kind,brief){
 const p=decode(raw);
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Estructura del Canvas inválida');
 const result={
   kind,brand:text(p.brand,62),eyebrow:text(p.eyebrow,72),headline:text(p.headline,135),
   subheadline:text(p.subheadline,380),cta:text(p.cta,48),story:text(p.story,560),
   contact:text(p.contact,190),palette:palettes[p.palette]?p.palette:'forest',
   features:Array.isArray(p.features)?p.features.slice(0,5).map(x=>({title:text(x?.title,70),description:text(x?.description,200)})).filter(x=>x.title.length>2&&x.description.length>=15):[],
   slides:Array.isArray(p.slides)?p.slides.slice(0,7).map(x=>({title:text(x?.title,110),body:text(x?.body,330)})).filter(x=>x.title.length>4&&x.body.length>=14):[]
 };
 if(result.brand.length<3||result.headline.length<9||result.subheadline.length<25)throw Error('El contenido de IA no tiene suficiente detalle');
 if(/^(wae(?:\s+os)?(?:\s+enterprise)?|universal\s+core|tu próximo gran producto)$/i.test(result.brand)&&!/\bwae\b|universal core/i.test(brief))throw Error('La IA respondió con una marca distinta a la solicitada');
 if(kind==='slides'||kind==='prototype'){
   if(result.slides.length<3)throw Error('Faltan secciones para una presentación o prototipo completo');
 }else if(result.features.length<3)throw Error('El resultado aún no incluye contenido suficiente para la página');
 if(result.features.length>=3&&result.features.every(x=>/^(innovaci[oó]n|confianza|resultados|beneficios|soluciones)$/i.test(x.title)))throw Error('El contenido sigue siendo un ejemplo genérico, no un diseño específico');
 const keywords=normalize(brief).split(/[^a-z0-9]+/).filter(x=>x.length>=5&&!['landing','pagina','quiero','crear','creame','crea','para','sobre','nuevo','canvas','html','presentacion','prototipo'].includes(x));
 if(keywords.length&&!keywords.some(k=>normalize(result.brand+' '+result.headline+' '+result.subheadline+' '+result.features.map(x=>x.title).join(' ')).includes(k.slice(0,Math.min(k.length,6)))))throw Error('El resultado no corresponde suficientemente al encargo');
 return result;
}
function base(p,body,cssExtra='',js=''){
 const colors=palettes[p.palette];
 const css=[
 '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--white);font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;overflow-x:hidden}',
 ':root{--bg:'+colors[0]+';--panel:'+colors[1]+';--accent:'+colors[2]+';--white:'+colors[3]+';--secondary:'+colors[4]+'}',
 'a{color:inherit;text-decoration:none}button,input,textarea{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}',
 '.wrap{max-width:1120px;margin:auto;padding:0 clamp(20px,5vw,54px)}.eyebrow{color:var(--accent);font-size:.76rem;font-weight:750;letter-spacing:.18em;text-transform:uppercase}',
 'header{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:86px}header .brand{font-size:1.16rem;letter-spacing:-.04em;font-weight:850}header nav{display:flex;gap:26px;font-size:.88rem;color:var(--white);opacity:.86}',
 '.button{display:inline-flex;justify-content:center;align-items:center;gap:8px;border:0;border-radius:13px;min-height:47px;padding:12px 23px;background:var(--accent);color:var(--bg);font-weight:850;box-shadow:0 12px 36px #0003}.button.secondary{background:transparent;border:1px solid #ffffff4d;color:var(--white);box-shadow:none}',
 '.hero{position:relative;isolation:isolate;padding:clamp(72px,12vw,140px) 0 clamp(78px,11vw,120px);overflow:hidden}.hero:before{content:"";position:absolute;z-index:-1;right:-200px;top:-180px;width:min(70vw,670px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,var(--secondary),transparent 64%);opacity:.25;filter:blur(10px)}',
 'h1{font-size:clamp(2.8rem,7vw,6.4rem);line-height:1.04;letter-spacing:-.065em;max-width:900px;margin:19px 0 22px}h2{font-size:clamp(1.85rem,3.4vw,3rem);line-height:1.15;letter-spacing:-.045em;margin:0 0 17px}h3{font-size:1.18rem;margin:0 0 9px;line-height:1.3}',
 '.lead{max-width:610px;font-size:clamp(1.05rem,2vw,1.3rem);line-height:1.65;color:var(--white);opacity:.78;margin-bottom:30px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}',
 '.section{padding:clamp(60px,8vw,105px) 0}.section.alt{background:var(--panel)}.intro{max-width:740px;margin-bottom:35px}.copy{opacity:.78;line-height:1.8}',
 '.card{padding:clamp(22px,3vw,34px);border:1px solid #ffffff22;border-radius:20px;background:linear-gradient(145deg,#ffffff0e,#ffffff03);min-width:0}.card .num{color:var(--accent);font-size:.74rem;font-weight:800;letter-spacing:.12em;display:block;margin-bottom:31px}.card p{font-size:.92rem;line-height:1.7;opacity:.76;margin:0}',
 '.story{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(26px,6vw,110px);align-items:start}.story p{line-height:1.9;opacity:.8}.cta-block{border:1px solid #ffffff30;border-radius:24px;padding:clamp(30px,6vw,70px);background:linear-gradient(120deg,var(--panel),var(--bg))}',
 'footer{border-top:1px solid #ffffff24;padding:28px 0;color:var(--white);font-size:.83rem;opacity:.65}.muted{opacity:.68}',
 '@media(max-width:760px){header{min-height:70px}header nav{gap:14px;font-size:.77rem}.hero{padding:78px 0 85px}.grid{grid-template-columns:1fr}.story{grid-template-columns:1fr}.button{max-width:100%;min-height:45px}h1{font-size:clamp(2.7rem,12vw,4.5rem)}.card .num{margin-bottom:19px}}',
 '@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'
 ].join('')+cssExtra;
 const draftLabel=p.draft?'<aside style="padding:8px 18px;background:#3d291b;color:#ffe4bd;text-align:center;font:12px system-ui">Borrador local ilustrativo · no generado por IA · personaliza y verifica el contenido</aside>':'';
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>'+esc(p.brand)+' | '+esc(p.headline)+'</title><style>'+css+'</style></head><body>'+draftLabel+body+(js?'<script>'+js+'<\/script>':'')+'</body></html>';
}
function header(p,withNav=true){
 return '<header class="wrap">'+(withNav?'<a class="brand" href="#inicio">'+esc(p.brand)+'</a><nav aria-label="Secciones"><a href="#experiencia">Experiencia</a><a href="#contacto">Contacto</a></nav>':'<span class="brand">'+esc(p.brand)+'</span>')+'</header>';
}
function heroVisual(p){
 const warm=p.palette==='warm'||/caf[eé]|coffee|panader/i.test(p.brand+' '+p.headline);
 if(warm)return '<div class="hero-visual" role="img" aria-label="Ilustración editorial de taza de café"><svg viewBox="0 0 500 500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="glow"><stop stop-color="#e5b67d" stop-opacity=".72"/><stop offset="1" stop-color="#e5b67d" stop-opacity="0"/></radialGradient></defs><circle cx="250" cy="240" r="225" fill="url(#glow)"/><ellipse cx="247" cy="411" rx="164" ry="26" fill="#120b09" opacity=".36"/><path d="M118 170h222v133c0 64-43 109-111 109S118 367 118 303Z" fill="#f2dac0"/><path d="M340 204h37c91 0 77 115-35 114" fill="none" stroke="#f2dac0" stroke-width="30"/><ellipse cx="229" cy="172" rx="110" ry="34" fill="#f8e6d0"/><ellipse cx="229" cy="169" rx="92" ry="23" fill="#533025"/><path d="M174 164c24-11 66-13 104 0-28 10-71 14-104 0Z" fill="#d8ac83"/><path d="M191 89c-32-32 31-43 4-77M242 99c-29-32 22-49 1-77M288 91c-23-24 18-44-4-64" fill="none" stroke="#eac8a9" stroke-width="9" stroke-linecap="round" opacity=".8"/><path d="M110 423h280" stroke="#c69b73" stroke-width="12" stroke-linecap="round"/></svg><span class="visual-label">'+esc(p.brand)+' · concepto visual</span></div>';
 return '<div class="hero-visual abstract" role="img" aria-label="Composición editorial abstracta"><svg viewBox="0 0 500 500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><circle cx="250" cy="250" r="205" stroke="#ffffff33" stroke-width="1" fill="none"/><circle cx="250" cy="250" r="150" fill="#ffffff11"/><rect x="147" y="137" width="219" height="220" rx="32" transform="rotate(-11 255 247)" fill="var(--secondary)" opacity=".75"/><rect x="140" y="161" width="219" height="220" rx="32" transform="rotate(11 250 271)" stroke="var(--accent)" stroke-width="2" fill="var(--panel)"/><circle cx="250" cy="270" r="57" fill="var(--accent)" opacity=".8"/></svg><span class="visual-label">'+esc(p.brand)+' · concepto visual</span></div>';
}
function landing(p){
 const features=p.features.map((x,i)=>'<article class="card"><span class="num">0'+(i+1)+'</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p></article>').join('');
 const body=header(p)+'<main id="inicio"><section class="hero"><div class="wrap hero-grid"><div class="hero-copy"><p class="eyebrow">'+esc(p.eyebrow||p.brand)+'</p><h1>'+esc(p.headline)+'</h1><p class="lead">'+esc(p.subheadline)+'</p><a class="button" href="#experiencia">'+esc(p.cta||'Descubrir más')+' →</a></div>'+heroVisual(p)+'</div></section>'+
 '<section class="section alt" id="experiencia"><div class="wrap"><div class="intro"><p class="eyebrow">'+esc(p.brand)+'</p><h2>'+esc(p.eyebrow||p.headline)+'</h2></div><div class="grid">'+features+'</div></div></section>'+
 '<section class="section"><div class="wrap story"><div><p class="eyebrow">Nuestra propuesta</p><h2>'+esc(p.brand)+'</h2></div><p>'+esc(p.story||p.subheadline)+'</p></div></section>'+
 '<section id="contacto" class="section"><div class="wrap"><div class="cta-block"><p class="eyebrow">Siguiente paso</p><h2>'+esc(p.cta||'Conoce nuestra propuesta')+'</h2><p class="lead">'+esc(p.contact||p.subheadline)+'</p><a class="button" href="#inicio">Volver al inicio ↑</a></div></div></section></main>'+
 '<footer><div class="wrap">'+esc(p.brand)+' · Diseño adaptable y editable</div></footer>';
 const extra='.hero-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:center;gap:clamp(18px,3vw,56px)}.hero-copy{min-width:0}.hero-copy h1{font-size:clamp(2.6rem,6vw,5.5rem)}.hero-visual{position:relative;min-width:0;aspect-ratio:1;border-radius:30px;background:linear-gradient(145deg,var(--panel),var(--bg));border:1px solid #ffffff24;display:grid;place-items:center;overflow:hidden}.hero-visual svg{width:95%;height:95%}.visual-label{position:absolute;bottom:16px;left:18px;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}@media(max-width:760px){.hero-grid{grid-template-columns:1fr}.hero-visual{max-height:360px;width:100%;aspect-ratio:1.4}.hero-visual svg{width:75%;height:110%}}';
 return base(p,body,extra);
}
function slides(p){
 const sections=p.slides.map((x,i)=>'<section class="slide" aria-label="Diapositiva '+(i+1)+'"'+(i?' hidden':'')+'><p class="eyebrow">'+esc(p.brand)+' · '+String(i+1).padStart(2,'0')+'</p><h1>'+esc(x.title)+'</h1><p class="lead">'+esc(x.body)+'</p></section>').join('');
 const extra='.stage{min-height:min(76dvh,760px);display:flex;align-items:center}.slide{width:100%}.slide[hidden]{display:none}.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-bottom:35px}.controls span{margin-left:auto;color:var(--accent);font-weight:800}@media(max-width:760px){.stage{min-height:65dvh}}';
 const script='(function(){const s=[...document.querySelectorAll(".slide")],count=document.getElementById("count"),back=document.getElementById("back"),next=document.getElementById("next");let n=0;function paint(){s.forEach((e,i)=>{e.hidden=i!==n});count.textContent=(n+1)+" / "+s.length;back.disabled=n===0;next.textContent=n===s.length-1?"Volver al inicio ↺":"Siguiente →";}back.addEventListener("click",()=>{n=Math.max(0,n-1);paint()});next.addEventListener("click",()=>{n=(n+1)%s.length;paint()});document.addEventListener("keydown",e=>{if(e.key==="ArrowRight"){n=(n+1)%s.length;paint()}if(e.key==="ArrowLeft"){n=Math.max(0,n-1);paint()}});paint()})();';
 return base(p,header(p,false)+'<main class="wrap"><div class="stage">'+sections+'</div><div class="controls"><button class="button secondary" id="back" type="button">← Anterior</button><button class="button" id="next" type="button">Siguiente →</button><span id="count" aria-live="polite"></span></div></main>',extra,script);
}
function prototype(p){
 const sections=p.slides.map((x,i)=>'<section class="screen"'+(i?' hidden':'')+'><p class="eyebrow">Paso 0'+(i+1)+'</p><h2>'+esc(x.title)+'</h2><p class="lead">'+esc(x.body)+'</p><button type="button" class="button next">Continuar →</button></section>').join('');
 const extra='.stage{max-width:590px;margin:65px auto;min-height:60dvh}.screen{border:1px solid #ffffff3a;padding:clamp(26px,5vw,52px);border-radius:28px;background:var(--panel)}.screen[hidden]{display:none}.lead{font-size:1.03rem}';
 const js='(function(){const screens=[...document.querySelectorAll(".screen")];let n=0;document.querySelectorAll(".next").forEach(b=>b.addEventListener("click",()=>{screens[n].hidden=true;n=(n+1)%screens.length;screens[n].hidden=false}));})();';
 return base(p,header(p,false)+'<main class="wrap"><div class="stage">'+sections+'</div></main>',extra,js);
}
function dashboard(p){
 const cards=p.features.map((x,i)=>'<article class="card"><span class="num">'+String(i+1).padStart(2,'0')+'</span><h3>'+esc(x.title)+'</h3><p>'+esc(x.description)+'</p><p class="data-status">Sin datos conectados</p></article>').join('');
 const css='.dashboard-heading{padding:62px 0 35px}.dashboard-heading h1{font-size:clamp(2.3rem,5vw,4.8rem)}.data-status{display:inline-block;border:1px solid #ffffff32;border-radius:10px;padding:7px 10px;margin-top:24px!important;color:var(--accent);font-size:.72rem!important}.dashboard-note{font-size:.85rem;color:var(--accent);padding:16px 0 40px}';
 const body=header(p,false)+'<main class="wrap" id="inicio"><section class="dashboard-heading"><p class="eyebrow">'+esc(p.eyebrow||'Panel del proyecto')+'</p><h1>'+esc(p.headline)+'</h1><p class="lead">'+esc(p.subheadline)+'</p></section><div class="grid">'+cards+'</div><p class="dashboard-note">Estructura editable de dashboard · conecta fuentes reales antes de publicar métricas.</p></main>';
 return base(p,body,css);
}
function build(plan){if(plan.kind==='slides')return slides(plan);if(plan.kind==='prototype')return prototype(plan);if(plan.kind==='dashboard')return dashboard(plan);return landing(plan)}
function draft(brief,kind='landing'){
 const instruction=word(brief);
 const named=instruction.match(/\b(?:para|de)\s+([\p{L}\p{N}][\p{L}\p{N} '&-]{2,60})/iu)?.[1];
 const brand=text((named||instruction.replace(/^(crear?|crea(?:me)?|diseña(?:me)?|haz|una?|un|landing|pagina|página)\s+/gi,'')).replace(/[.!?].*$/,'').replace(/\b(?:con|que|en|y|sobre)\b.*$/i,'').trim(),50)||'Tu proyecto';
 const coffee=/caf[eé]|cafeter[ií]a|coffee/i.test(instruction+' '+brand);
 const textFor=coffee?{
  headline:'Una pausa con carácter, aroma y sabor',
  subheadline:'Una propuesta visual para presentar tus bebidas y contar la historia detrás de cada taza.',
  story:'Un espacio para contar qué hace especial a esta cafetería y cómo quieres que tus visitantes vivan la experiencia.',
  cta:'Explorar la propuesta',
  features:[
   {title:'Café de especialidad',description:'Presenta tu selección y explica la experiencia que quieres ofrecer.'},
   {title:'Bebidas para cada momento',description:'Describe tus preparaciones, frías o calientes, sin inventar precios.'},
   {title:'Un espacio para compartir',description:'Cuenta qué ambiente quieres crear para tus visitantes.'}
  ],
  slides:[
   {title:'Una bienvenida con aroma',body:'Presenta la identidad de tu cafetería y su propuesta.'},
   {title:'La experiencia',body:'Explica qué bebidas y momentos quieres destacar.'},
   {title:'Próximo encuentro',body:'Incluye una invitación a conocer tu propuesta sin datos de contacto inventados.'}
  ]
 }:{
  headline:'Presenta '+brand+' con una propuesta clara',
  subheadline:'Un punto de partida editable para presentar tu idea, tus servicios y lo que quieres construir.',
  story:'Personaliza esta sección con información real sobre tu proyecto, su audiencia y el valor que ofreces.',
  cta:'Conocer la propuesta',
  features:[
   {title:'La propuesta',description:'Describe aquí el producto o servicio que quieres ofrecer.'},
   {title:'La experiencia',description:'Explica cómo las personas podrán utilizar tu producto o servicio.'},
   {title:'Siguiente paso',description:'Añade una invitación verificable y adaptada a tu audiencia.'}
  ],
  slides:[
   {title:'La idea principal',body:'Presenta el propósito y el alcance de '+brand+'.'},
   {title:'El valor',body:'Describe con ejemplos lo que tu propuesta aportará.'},
   {title:'El siguiente paso',body:'Muestra una conclusión y una acción concreta para avanzar.'}
  ]
 };
 const plan={...textFor,kind,brand,eyebrow:coffee?'Concepto de cafetería':'Concepto de proyecto',contact:'Reemplaza este bloque con información de contacto real.',palette:coffee?'warm':'blue',draft:true};
 return {plan,html:build(plan)};
}
window.WAECanvasBuilder={parse:validate,build,draft};
})();
