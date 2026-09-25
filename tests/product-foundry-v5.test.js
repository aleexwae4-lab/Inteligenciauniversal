import test from 'node:test';
import assert from 'node:assert/strict';
import {productKind,inspectFoundryProject,buildDigitalProduct,PRODUCT_FOUNDRY_VERSION} from '../lib/product-foundry-v5.js';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=profile=>JSON.stringify({schema:'wae-product/v5',name:'Prueba',profile,targets:['web-preview'],entry:'index.html'},null,2);

function game3dFiles(){
  const html=`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Juego 3D</title><link rel="stylesheet" href="styles.css"></head>
<body><main><header><p class="eyebrow">WAE GAME LAB · DEMOSTRACIÓN</p><h1>Órbita 3D</h1><p>Recorre una arena espacial procedural, suma puntos y prueba el pipeline WebGL sin recursos externos.</p></header><section id="hud" aria-live="polite"><strong>Score <span id="score">0</span></strong><span id="status">Motor 3D listo</span></section><canvas id="game" aria-label="Escena 3D interactiva"></canvas><section class="controls"><h2>Controles</h2><p>Usa W o flecha arriba para sumar impulso. En móvil toca la escena. El lienzo responde al tamaño y densidad de pantalla.</p><button id="restart">Reiniciar partida</button></section><footer><small>Demo local autocontenida · Sin CDN · Sin recursos remotos</small></footer></main><script src="main.js"></script></body></html>`;
  const css=`:root{font-family:system-ui;color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#050816;color:#eef;min-height:100vh}
main{min-height:100vh;display:grid;grid-template-rows:auto auto 1fr auto;gap:12px;padding:16px}canvas{width:100%;height:70vh;border:1px solid #345;border-radius:16px;background:#02040a}
button{padding:12px;border-radius:10px}@media(max-width:700px){main{padding:8px}canvas{height:62vh}}`;
  const js=`const canvas=document.querySelector('#game');
const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
const score=document.querySelector('#score');let points=0,angle=0;
function perspective(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,-1,-1,0,0,-.2,0])}
const viewMatrix=perspective(),modelMatrix=new Float32Array(16);
if(gl){
 gl.enable(gl.DEPTH_TEST);
 const vs=gl.createShader(gl.VERTEX_SHADER),fs=gl.createShader(gl.FRAGMENT_SHADER);
 gl.shaderSource(vs,'attribute vec3 p; void main(){gl_Position=vec4(p,1.0);}');
 gl.shaderSource(fs,'precision mediump float; void main(){gl_FragColor=vec4(.2,.7,1.,1.);}');
 gl.compileShader(vs);gl.compileShader(fs);const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
 function resize(){const d=devicePixelRatio||1;canvas.width=canvas.clientWidth*d;canvas.height=canvas.clientHeight*d;gl.viewport(0,0,canvas.width,canvas.height)}
 addEventListener('resize',resize);resize();
 addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='w')points++;score.textContent=String(points)});
 canvas.addEventListener('pointerdown',()=>{points++;score.textContent=String(points)});
 function render(){angle+=.01;gl.clearColor(.01,.02,.08,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);requestAnimationFrame(render)}render();
}
function resetGame(){points=0;score.textContent='0'}document.querySelector('#restart').addEventListener('click',resetGame);`;
  return [
    {name:'index.html',content:html},{name:'styles.css',content:css},{name:'main.js',content:js},
    {name:'README.md',content:'# Juego 3D\n\nJuego WebGL autocontenido. Controles: WASD/touch. QA estructural incluido.'},
    {name:'wae-product.json',content:manifest('game_3d')}
  ];
}

test('v5 classifies 3D games before generic apps',()=>{
  assert.equal(productKind('Crea un juego 3D de carreras'),'game_3d');
  assert.equal(productKind('Simulación 3D de una fábrica'),'simulation_3d');
  assert.equal(productKind('App Android para inventarios'),'mobile_app');
  assert.equal(productKind('API REST de clientes'),'api_service');
});

test('v5 accepts a real self-contained WebGL game and exposes measurable 3D gates',()=>{
  const audit=inspectFoundryProject(game3dFiles(),{profile:'game_3d'});
  assert.equal(audit.pass,true);
  for(const key of ['canvas3d','webgl','shaderPipeline','renderLoop','matrix3d','input3d','resize3d','hud3d'])assert.equal(audit.checks[key],true,key);
  assert.equal(audit.checks.previewLocalOnly,true);
  assert.equal(audit.checks.manifest,true);
});

test('v5 rejects fake 3D that only paints a canvas without WebGL pipeline',()=>{
  const files=game3dFiles();
  files.find(f=>f.name==='main.js').content="const c=document.querySelector('canvas');const x=c.getContext('2d');function render(){x.fillRect(0,0,20,20);requestAnimationFrame(render)}render();";
  const audit=inspectFoundryProject(files,{profile:'game_3d'});
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('webgl'));
  assert.ok(audit.failed.includes('shaderPipeline'));
});

test('v5 build contract returns profile, manifest, targets and QA using a deterministic generator',async()=>{
  const files=game3dFiles();
  const generate=async()=>({text:JSON.stringify({plan:'Juego 3D jugable y local.',files}),provider:'test',model:'fixture'});
  const result=await buildDigitalProduct({request:'Construye un juego 3D premium con WebGL y controles.',kind:'game_3d',generate});
  assert.equal(result.version,PRODUCT_FOUNDRY_VERSION);
  assert.equal(result.kind,'game_3d');
  assert.equal(result.quality.structural,'passed');
  assert.deepEqual(result.artifact.targets,['web-preview']);
  assert.equal(result.project.files.some(f=>f.name==='wae-product.json'),true);
});

test('v5 UI and API expose real multi-product Foundry instead of HTML-only builder',()=>{
  const api=read('api/factory-project.js'),agent=read('factory-agent-render-v3.js'),workspace=read('factory-projects-render-v2.js'),core=read('lib/core-self-description.js');
  assert.match(api,/product-foundry-v5/);
  assert.match(agent,/value="game_3d"/);
  assert.match(agent,/value="mobile_app"/);
  assert.match(agent,/Universal Product Foundry/);
  assert.match(workspace,/wae-product\.json/);
  assert.match(workspace,/nextFiles\.length>20/);
  assert.match(core,/game3DFactory:true/);
  assert.match(core,/wae-product-foundry\/v5/);
});
