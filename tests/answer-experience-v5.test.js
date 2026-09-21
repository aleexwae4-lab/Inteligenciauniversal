import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('premium Markdown retains native widget type and escapes untrusted user HTML',()=>{
 const source=read('premium-render-v1.js');
 assert.doesNotThrow(()=>new vm.Script(source));
 const first=source.indexOf('function inline(value){'),last=source.indexOf('function rawOf(article)');
 assert.ok(first>=0&&last>first);
 const section=source.slice(first,last);
 const context={text:v=>String(v==null?'':v),esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
 vm.runInNewContext(section+';this.rich=rich;',context);
 const input='**Construcción real**\n\n'+String.fromCharCode(96).repeat(3)+'wae-card\n{"title":"Producto","description":"Listo"}\n'+String.fromCharCode(96).repeat(3)+'\n\n<script>alert(1)</script>';
 const html=context.rich(input);
 assert.match(html,/data-wae-block="card"/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(context.rich(''+String.fromCharCode(96).repeat(3)+'js\nconst a=1;\n'+String.fromCharCode(96).repeat(3)),/<pre><code>/);
});
test('native card and chart render via textContent and keep demonstration numbers labelled',()=>{
 const source=read('wae-answer-widgets-v1.js');
 assert.doesNotThrow(()=>new vm.Script(source));
 class Node {
  constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attrs={};this.textContent='';this.className='';this.dataset={};}
  setAttribute(name,value){this.attrs[name]=String(value)}
  append(...children){this.children.push(...children)}
  get childElementCount(){return this.children.length}
  addEventListener(name,handler){this['on'+name]=handler}
 }
 const window={},document={readyState:'loading',createElement:tag=>new Node(tag),addEventListener(){}};
 vm.runInNewContext(source,{window,document,TextEncoder,console});
 const card=window.WAEAnswerWidgets.card({title:'<script>evil</script>',description:'Un producto',metrics:[{label:'Ventas',value:'10'}],actions:[{type:'ask',label:'Pedir ajuste',prompt:'Cambia tamaño'}]});
 assert.equal(card.children[0].children[0].children[0].textContent,'<script>evil</script>');
 assert.equal(card.children.some(n=>n.className==='iu-widget-disclaimer'),true);
 assert.equal(card.children.some(n=>n.className==='iu-widget-actions'),true);
 const chart=window.WAEAnswerWidgets.chart({title:'Ingresos',data:[{label:'Junio',value:10},{label:'Julio',value:20}]});
 assert.equal(chart.children.some(n=>n.className==='iu-widget-disclaimer'),true);
 assert.equal(chart.children[1].children[1].children[1].children[0].style.width,'100.00%');
 assert.throws(()=>window.WAEAnswerWidgets.chart({title:'Sin valores',data:[{label:'Junio',value:-1}]}),/empty_chart/);
 assert.doesNotMatch(source,/eval\(|new Function\(|innerHTML\s*=/);
});
test('response widgets do not replace chat, voice, workspace or conversation source requirements',()=>{
 const html=read('index.html'),sw=read('sw.js'),runtime=read('runtime-client.js'),quality=read('lib/response-quality.js'),premium=read('premium-render-v1.js');
 assert.match(html,/wae-answer-widgets-v1\.js\?v=1/);
 assert.match(html,/wae-answer-widgets-v1\.css\?v=1/);
 assert.ok(html.indexOf('premium-render-v1.js')<html.indexOf('wae-answer-widgets-v1.js'));
 assert.match(sw,/wae-universal-render-selfquery-v37/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/wae-answer-widgets-v1\.js\?v=1/);
 assert.match(runtime,/degraded_supabase_reply/);
 assert.match(runtime,/Contrat[oa] visual opcional WAE/i);
 assert.match(quality,/Formato visual opcional/);
 assert.match(premium,/wae-\(card\|chart\)/);
 assert.match(premium,/function speak\(/);
 assert.match(premium,/Copiar respuesta/);
 assert.match(premium,/Abrir respuesta en Workspace/);
});
