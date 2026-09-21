import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CANVAS_ENGINE_VERSION,canvasKind,auditCanvas,createPremiumCanvas,hardenCanvasHtml
} from '../lib/canvas-factory-render-v1.js';
import handler from '../api/canvas.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const artifact='<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Producto verificable</title><style>body{font-family:system-ui}@media(max-width:600px){body{padding:1rem}}</style></head><body><main><h1>Un producto listo para editar</h1><section>'+'Contenido original y verificable de valor para un negocio real. '.repeat(60)+'</section></main></body></html>';

test('Render factory classifies and structurally gates HTML for four product types',()=>{
 assert.equal(CANVAS_ENGINE_VERSION,'universal-render-canvas-factory/v1');
 assert.equal(canvasKind('Presentación para inversores'),'presentation');
 assert.equal(canvasKind('Dashboard para operaciones'),'dashboard');
 assert.equal(canvasKind('Una aplicación local'),'app');
 assert.equal(canvasKind('Landing para cafetería'),'landing');
 assert.equal(auditCanvas(artifact).pass,true);
 assert.equal(auditCanvas('<html>demo</html>').pass,false);
 assert.equal(auditCanvas(artifact,'presentation').pass,false);
});

test('factory executes actual expert briefs and builder; supports non-destructive revisions',async()=>{
 let calls=[];
 const result=await createPremiumCanvas({
   request:'Crea landing para tienda de café local',
   kind:'landing',baseHtml:artifact,generate:async({message})=>{
     calls.push(message);
     return{text:message.includes('Encargo original:')?artifact:'Brief profesional de UX y negocio'};
   }
 });
 assert.equal(calls.length,4);
 assert.equal(result.revision,true);
 assert.equal(result.quality.structural,'passed');
 assert.equal(result.quality.browserTests,'not_run');
 assert.ok(result.experts.includes('Constructor frontend'));
 assert.match(calls[3],/MODO REVISIÓN/);
});

test('factory removes network resources and refuses unrepairable artifacts',async()=>{
 const dangerous=artifact.replace('</main>','<iframe src="https://example.com"></iframe><script src="https://example.com/x.js"></script></main>');
 const safe=hardenCanvasHtml(dangerous);
 assert.doesNotMatch(safe,/example\.com/);
 assert.match(safe,/Content-Security-Policy/);
 await assert.rejects(createPremiumCanvas({
   request:'Landing para café sin inventar resultados',
   generate:async({message})=>({text:message.includes('Encargo original:')?'<html>incompleto</html>':'Brief'})
 }),error=>error.code==='canvas_quality_gate_failed');
});

test('Render edition mounts a standalone endpoint and Canvas overlay after its original UI',()=>{
 const server=read('server.js'),html=read('index.html'),sw=read('sw.js');
 const old=html.indexOf('canvas-premium-v2.js?v=19'),factory=html.indexOf('canvas-render-factory-v1.js?v=1');
 assert.ok(old>=0&&factory>old);
 assert.match(server,/import canvasHandler from '.\/api\/canvas.js'/);
 assert.match(server,/\['\/api\/canvas', canvasHandler\]/);
 assert.match(sw,/canvas-render-factory-v1.js/);
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 const adapter=read('canvas-render-factory-v1.js');
 assert.match(adapter,/WAECanvasCommit/);
 assert.match(read('api/canvas.js'),/const canvasBuckets = new Map\(\)/);
 assert.doesNotMatch(read('api/canvas.js'),/allowRequest\(req/);
 assert.match(adapter,/WAEStorage\.load\('html'\)/);
 assert.match(adapter,/stopImmediatePropagation/);
 assert.match(adapter,/Conservé el Canvas anterior/);
 assert.match(read('canvas-premium-v2.js'),/WAECanvasCommit=apply/);
});

test('endpoint validates brief and revision size before consuming provider quota',async()=>{
 const request=(body)=>({method:'POST',body,headers:{host:'inteligenciauniversal.onrender.com','sec-fetch-site':'same-origin'},socket:{remoteAddress:'test'}});
 const reply=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.payload=v;return this}});
 let res=reply();await handler(request({request:'corto'}),res);
 assert.equal(res.statusCode,400);
 res=reply();await handler(request({request:'Necesito una landing para café',baseHtml:'x'.repeat(100001)}),res);
 assert.equal(res.statusCode,413);
});
test('Render Canvas build keeps external image inference separate and explicitly runnable',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.match(pkg.scripts.check,/tests\/canvas-factory-render-v1\.test\.js/);
 assert.doesNotMatch(pkg.scripts.check,/visual-photo-canary-once\.mjs/);
 assert.equal(pkg.scripts['check:vision:live'],'node scripts/visual-photo-canary-once.mjs');
});
