import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectProject,parseProjectOutput,buildProductProject,PROJECT_ENGINE_VERSION} from '../lib/product-builder-v4.js';
const sample=[
 {name:'index.html',content:'<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>WAE Producto</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>Control de productos</h1><p>Panel local para crear y visualizar registros con interacción accesible.</p><button id="add" type="button">Agregar</button><ul id="items"></ul><p>Esta demostración funciona sin conectar servidores ni inventar datos.</p></main><script src="main.js"></script></body></html>'},
 {name:'styles.css',content:':root{font-family:system-ui;color-scheme:dark}body{min-height:100vh;margin:0;background:#091a21;color:#fff}main{max-width:780px;margin:auto;padding:24px}button{background:#42dcb1;color:#082119;border:0;border-radius:12px;padding:12px 20px;cursor:pointer}button:focus-visible{outline:2px solid #fff}@media(max-width:600px){main{padding:14px}button{width:100%}}'},
 {name:'main.js',content:'const button=document.querySelector("#add");const list=document.querySelector("#items");let count=0;button.addEventListener("click",()=>{const li=document.createElement("li");li.textContent="Registro "+(++count);list.append(li);});'},
 {name:'README.md',content:'# Producto WAE\nPrototipo local. Sin backend, autenticación ni publicación activa.'},
];
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('real multi-file project has deterministic structural and JS syntax checks',()=>{
 const result=inspectProject(sample);assert.equal(result.pass,true);assert.equal(result.files.length,4);
 assert.equal(PROJECT_ENGINE_VERSION,'wae-product-builder/v4');
 assert.equal(result.checks.responsive,true);
});
test('reject network calls, traversal, invalid JavaScript and unfinished HTML',()=>{
 const replace=(name,content)=>sample.map(f=>f.name===name?{...f,content}:f);
 assert.equal(inspectProject(replace('main.js','fetch("/steal");')).pass,false);
 assert.equal(inspectProject(replace('main.js','function () {}')).checks.jsSyntax,false);
 assert.equal(inspectProject(replace('index.html','<html>')).checks.fullHtml,false);
 assert.throws(()=>inspectProject([...sample,{name:'../.env',content:'SECRET=foo'}]),/Ruta/);
 assert.throws(()=>inspectProject([...sample,{...sample[0]}]),/duplicados/);
});
test('parse builder JSON not markdown as executable code',()=>{
 assert.equal(parseProjectOutput(JSON.stringify({plan:'ok',files:sample})).files.length,4);
 assert.throws(()=>parseProjectOutput('No hay ruta generativa disponible'),/JSON completo/);
});
test('AI project generation uses one real model call and refuses invalid output',async()=>{
 let calls=0;
 const mock=async args=>{calls++;assert.match(args.message,/index\.html/);assert.match(args.message,/styles\.css/);return{text:JSON.stringify({plan:'Producto local',files:sample}),provider:'test',model:'test-model'}};
 const result=await buildProductProject({request:'Construye un tablero',generate:mock});
 assert.equal(calls,1);assert.equal(result.quality.structural,'passed');
 assert.equal(result.quality.browserTests,'not_run');assert.equal(result.quality.backendTests,'not_run');
 assert.equal(result.changes.length,4);
 await assert.rejects(()=>buildProductProject({request:'Construye un tablero',generate:async()=>({text:'La ruta generativa avanzada no está disponible.'})}),/JSON completo/);
});
test('Render mounts isolated project route and browser commits remain reversible and guarded',()=>{
 const server=read('server.js'),api=read('api/factory-project.js'),frontend=read('factory-projects-render-v2.js'),agent=read('factory-agent-render-v3.js');
 assert.match(server,/factoryProjectHandler/);assert.match(server,/\/api\/factory-project/);
 assert.match(api,/originAllowed\(req\)/);assert.match(api,/rate_limited/);assert.match(api,/Cache-Control','no-store/);
 assert.match(frontend,/function commitProject\(/);assert.match(frontend,/function restorePrevious\(/);
 assert.match(frontend,/JSON\.stringify\(verified\?\.files\)/);
 assert.match(agent,/multiFile\?'\/api\/factory-project':'\/api\/canvas'/);
 assert.match(agent,/commitProject\(data\.project\.files,snapshot\)/);
});
