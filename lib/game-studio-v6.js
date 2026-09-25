export const GAME_STUDIO_VERSION='wae-game-studio/v6';

const escHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cleanTitle=value=>String(value??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
export const supportsNativeGameStudio=profile=>profile==='game_3d'||profile==='simulation_3d';

function sceneDefinition(profile){
  const simulation=profile==='simulation_3d';
  return {
    engine:GAME_STUDIO_VERSION,
    mode:simulation?'simulation':'game',
    physics:{gravity:simulation?0:-18,moveSpeed:simulation?3.8:6.2,jumpSpeed:8.5,worldLimit:12},
    camera:{fov:62,near:0.1,far:100,offset:[0,5.2,9.5]},
    materials:{
      player:[0.20,0.95,0.72,1],
      obstacle:[0.16,0.34,0.54,1],
      collectible:[1.0,0.72,0.20,1],
      floor:[0.08,0.12,0.18,1],
      accent:[0.44,0.52,1.0,1]
    },
    levels:[
      {id:'level-1',name:simulation?'Laboratorio orbital':'Órbita Uno',goal:4},
      {id:'level-2',name:simulation?'Cámara dinámica':'Órbita Dos',goal:6}
    ],
    entities:[
      {id:'player',type:'player',position:[0,0.7,3],scale:[0.7,0.7,0.7],material:'player',dynamic:true},
      {id:'floor',type:'floor',position:[0,-0.35,0],scale:[12,0.25,12],material:'floor',dynamic:false},
      {id:'wall-a',type:'obstacle',position:[-3,0.65,-1.5],scale:[1.4,1,1.4],material:'obstacle',dynamic:false},
      {id:'wall-b',type:'obstacle',position:[3.2,0.9,-3.6],scale:[1.3,1.5,1.3],material:'obstacle',dynamic:false},
      {id:'energy-1',type:'collectible',position:[-4,0.7,-4],scale:[0.38,0.38,0.38],material:'collectible',dynamic:false},
      {id:'energy-2',type:'collectible',position:[4,0.7,-1],scale:[0.38,0.38,0.38],material:'collectible',dynamic:false},
      {id:'energy-3',type:'collectible',position:[1,0.7,4],scale:[0.38,0.38,0.38],material:'collectible',dynamic:false},
      {id:'energy-4',type:'collectible',position:[-1.5,0.7,0],scale:[0.38,0.38,0.38],material:'collectible',dynamic:false}
    ]
  };
}

function gameMain(scene,request){
  const sceneJson=JSON.stringify(scene);
  const brief=JSON.stringify(cleanTitle(request));
  return [
"const canvas=document.querySelector('#game');",
"const gl=canvas.getContext('webgl2',{antialias:true,alpha:false})||canvas.getContext('webgl',{antialias:true,alpha:false});",
"const ui={score:document.querySelector('#score'),level:document.querySelector('#level'),status:document.querySelector('#status'),editor:document.querySelector('#editorPanel'),entityCount:document.querySelector('#entityCount')};",
"const BRIEF="+brief+";",
"const SCENE="+sceneJson+";",
"const state={running:true,editor:false,levelIndex:0,score:0,last:performance.now(),keys:new Set(),particles:[],added:[],audio:null};",
"const clone=value=>JSON.parse(JSON.stringify(value));",
"let entities=clone(SCENE.entities);",
"const player=()=>entities.find(e=>e.type==='player');",
"const level=()=>SCENE.levels[state.levelIndex%SCENE.levels.length];",
"const vec3=(x=0,y=0,z=0)=>[x,y,z];",
"function identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}",
"function multiply(a,b){const out=new Float32Array(16);for(let r=0;r<4;r++)for(let c=0;c<4;c++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];out[c*4+r]=v}return out}",
"function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o}",
"function normalize(v){const n=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/n,v[1]/n,v[2]/n]}",
"function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}",
"function lookAt(eye,target,up){const z=normalize([eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]]),x=normalize(cross(up,z)),y=cross(z,x),o=identity();o[0]=x[0];o[1]=y[0];o[2]=z[0];o[4]=x[1];o[5]=y[1];o[6]=z[1];o[8]=x[2];o[9]=y[2];o[10]=z[2];o[12]=-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]);o[13]=-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]);o[14]=-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]);return o}",
"function modelMatrix(position,scale,rotY=0){const c=Math.cos(rotY),s=Math.sin(rotY),o=identity();o[0]=c*scale[0];o[2]=-s*scale[0];o[5]=scale[1];o[8]=s*scale[2];o[10]=c*scale[2];o[12]=position[0];o[13]=position[1];o[14]=position[2];return o}",
"const VERTICES=new Float32Array([-1,-1,-1,1,-1,-1,1,1,-1,-1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,-1,1,1,1,1,-1,1,1,-1,-1,-1,-1,1,-1,-1,1,1,-1,-1,-1,-1,1,1,-1,-1,1,1,-1,-1,1,1,-1,1,1,1,1,-1,-1,1,1,1,1,-1,1,-1,-1,-1,-1,-1,1,1,-1,1,-1,-1,-1,1,-1,1,1,-1,-1,-1,1,-1,-1,1,1,1,1,1,-1,1,1,1,1,1,-1]);",
"let program=null,buffer=null,loc={};",
"function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader error');return s}",
"function initGL(){if(!gl){document.querySelector('#fallback').hidden=false;canvas.hidden=true;return false}const vs=shader(gl.VERTEX_SHADER,'attribute vec3 aPosition;uniform mat4 uMVP;void main(){gl_Position=uMVP*vec4(aPosition,1.0);}');const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform vec4 uColor;void main(){gl_FragColor=uColor;}');program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Program error');buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,VERTICES,gl.STATIC_DRAW);loc.position=gl.getAttribLocation(program,'aPosition');loc.mvp=gl.getUniformLocation(program,'uMVP');loc.color=gl.getUniformLocation(program,'uColor');gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);return true}",
"function resize(){if(!gl)return;const d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.floor(canvas.clientWidth*d)),h=Math.max(1,Math.floor(canvas.clientHeight*d));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h)}",
"function drawCube(entity,viewProj){const m=modelMatrix(entity.position,entity.scale,entity.rotation||0),mvp=multiply(viewProj,m),color=SCENE.materials[entity.material]||SCENE.materials.accent;gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniform4fv(loc.color,color);gl.drawArrays(gl.TRIANGLES,0,36)}",
"function cameraMatrix(){const p=player(),target=p?p.position:[0,0,0],off=SCENE.camera.offset,eye=[target[0]+off[0],target[1]+off[1],target[2]+off[2]],proj=perspective(SCENE.camera.fov*Math.PI/180,canvas.width/Math.max(1,canvas.height),SCENE.camera.near,SCENE.camera.far);return multiply(proj,lookAt(eye,target,[0,1,0]))}",
"function aabb(e){return{min:[e.position[0]-e.scale[0],e.position[1]-e.scale[1],e.position[2]-e.scale[2]],max:[e.position[0]+e.scale[0],e.position[1]+e.scale[1],e.position[2]+e.scale[2]]}}",
"function overlaps(a,b){return a.min[0]<=b.max[0]&&a.max[0]>=b.min[0]&&a.min[1]<=b.max[1]&&a.max[1]>=b.min[1]&&a.min[2]<=b.max[2]&&a.max[2]>=b.min[2]}",
"function ensureAudio(){if(state.audio)return state.audio;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;state.audio=new C();return state.audio}",
"function tone(freq=440,duration=.08){const a=ensureAudio();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.06,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+duration);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+duration)}",
"function emitParticles(pos,color='accent'){for(let i=0;i<12;i++)state.particles.push({position:[pos[0],pos[1],pos[2]],velocity:[(Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3],life:.75,material:color,scale:[.06,.06,.06]})}",
"function resetLevel(next=false){if(next)state.levelIndex=(state.levelIndex+1)%SCENE.levels.length;state.score=0;entities=clone(SCENE.entities);const p=player();p.velocity=vec3();state.particles=[];syncUI();tone(next?720:320,.09)}",
"function collect(){const p=player();entities=entities.filter(e=>{if(e.type!=='collectible')return true;const dx=e.position[0]-p.position[0],dy=e.position[1]-p.position[1],dz=e.position[2]-p.position[2];if(Math.hypot(dx,dy,dz)<1.15){state.score++;emitParticles(e.position,'collectible');tone(620+state.score*35,.07);return false}return true});if(state.score>=level().goal){ui.status.textContent='Objetivo completado · siguiente nivel';setTimeout(()=>resetLevel(true),650)}syncUI()}",
"function physics(dt){const p=player();if(!p)return;p.velocity=p.velocity||vec3();const speed=SCENE.physics.moveSpeed,dirX=(state.keys.has('KeyD')?1:0)-(state.keys.has('KeyA')?1:0),dirZ=(state.keys.has('KeyS')?1:0)-(state.keys.has('KeyW')?1:0);p.velocity[0]=dirX*speed;p.velocity[2]=dirZ*speed;if(SCENE.physics.gravity!==0)p.velocity[1]+=SCENE.physics.gravity*dt;if(state.keys.has('Space')&&p.position[1]<=.71){p.velocity[1]=SCENE.physics.jumpSpeed;tone(300,.05)}const old=[...p.position];p.position[0]+=p.velocity[0]*dt;p.position[1]+=p.velocity[1]*dt;p.position[2]+=p.velocity[2]*dt;const L=SCENE.physics.worldLimit;p.position[0]=Math.max(-L,Math.min(L,p.position[0]));p.position[2]=Math.max(-L,Math.min(L,p.position[2]));if(p.position[1]<.7){p.position[1]=.7;p.velocity[1]=0}for(const e of entities){if(e.type==='obstacle'&&overlaps(aabb(p),aabb(e))){p.position=old;p.velocity[0]=p.velocity[2]=0;break}}collect()}",
"function updateParticles(dt){for(const p of state.particles){p.life-=dt;p.velocity[1]-=3*dt;p.position[0]+=p.velocity[0]*dt;p.position[1]+=p.velocity[1]*dt;p.position[2]+=p.velocity[2]*dt}state.particles=state.particles.filter(p=>p.life>0)}",
"function renderScene(){if(!gl)return;resize();gl.clearColor(.015,.025,.055,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);const vp=cameraMatrix();for(const e of entities)drawCube(e,vp);for(const p of state.particles)drawCube(p,vp)}",
"function frame(now){const dt=Math.min(.033,(now-state.last)/1000||0);state.last=now;if(state.running&&!state.editor)physics(dt);updateParticles(dt);renderScene();requestAnimationFrame(frame)}",
"function syncUI(){ui.score.textContent=String(state.score)+' / '+String(level().goal);ui.level.textContent=level().name;ui.entityCount.textContent=String(entities.length);if(state.score<level().goal)ui.status.textContent=state.editor?'Editor de escena activo':'Motor 3D listo · '+BRIEF}",
"function addEntity(type){const n=state.added.length+1,e={id:'editor-'+type+'-'+n,type,position:[(n%5)-2,type==='collectible'?.7:.75,-(n%4)],scale:type==='collectible'?[.34,.34,.34]:[.7,.7,.7],material:type==='collectible'?'collectible':'obstacle',dynamic:false};entities.push(e);state.added.push(e.id);emitParticles(e.position,'accent');syncUI()}",
"function clearEditorEntities(){entities=entities.filter(e=>!state.added.includes(e.id));state.added=[];syncUI()}",
"function toggleEditor(){state.editor=!state.editor;ui.editor.hidden=!state.editor;document.querySelector('#editorToggle').setAttribute('aria-pressed',String(state.editor));syncUI()}",
"addEventListener('keydown',e=>{state.keys.add(e.code);if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault()});",
"addEventListener('keyup',e=>state.keys.delete(e.code));",
"document.querySelectorAll('[data-key]').forEach(btn=>{const code=btn.dataset.key;const down=e=>{e.preventDefault();state.keys.add(code);ensureAudio()};const up=e=>{e.preventDefault();state.keys.delete(code)};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up)});",
"document.querySelector('#restart').addEventListener('click',()=>resetLevel(false));",
"document.querySelector('#pause').addEventListener('click',e=>{state.running=!state.running;e.currentTarget.textContent=state.running?'Pausar':'Continuar';ui.status.textContent=state.running?'Motor 3D reanudado':'Pausa'});",
"document.querySelector('#editorToggle').addEventListener('click',toggleEditor);",
"document.querySelector('#addObstacle').addEventListener('click',()=>addEntity('obstacle'));",
"document.querySelector('#addEnergy').addEventListener('click',()=>addEntity('collectible'));",
"document.querySelector('#clearEditor').addEventListener('click',clearEditorEntities);",
"canvas.addEventListener('pointerdown',()=>ensureAudio());",
"addEventListener('resize',resize);",
"try{if(initGL()){syncUI();requestAnimationFrame(frame)}}catch(error){document.querySelector('#fallback').hidden=false;document.querySelector('#fallback').textContent='No se pudo iniciar WebGL: '+String(error.message||error);canvas.hidden=true}",
"window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,state,addEntity,resetLevel};"
  ].join('\n');
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
  const scene=sceneDefinition(profile);
  const title=profile==='simulation_3d'?'WAE Sim Lab 3D':'WAE Orbit Runner 3D';
  const summary=cleanTitle(request)||'Experiencia 3D interactiva';
  const html='<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#07110f"><title>'+escHtml(title)+'</title><link rel="stylesheet" href="styles.css"></head><body><main><header class="hero"><div><p class="eyebrow">UNIVERSAL CORE · GAME STUDIO V6</p><h1>'+escHtml(title)+'</h1><p>'+escHtml(summary)+'</p></div><div class="hud" aria-live="polite"><span>Nivel <strong id="level">—</strong></span><span>Energía <strong id="score">0</strong></span><span id="status">Preparando motor 3D…</span></div></header><section class="stage"><canvas id="game" aria-label="Escena tridimensional interactiva"></canvas><div id="fallback" class="fallback" hidden>WebGL no está disponible en este dispositivo.</div><div class="touch" aria-label="Controles táctiles"><button data-key="KeyW" aria-label="Avanzar">▲</button><button data-key="KeyA" aria-label="Izquierda">◀</button><button data-key="Space" aria-label="Saltar">●</button><button data-key="KeyD" aria-label="Derecha">▶</button><button data-key="KeyS" aria-label="Retroceder">▼</button></div></section><section class="toolbar" aria-label="Herramientas del juego"><button id="pause">Pausar</button><button id="restart">Reiniciar nivel</button><button id="editorToggle" aria-pressed="false">Editor de escena</button></section><section id="editorPanel" class="editor" hidden><div><p class="eyebrow">EDITOR NATIVO</p><h2>Escena 3D</h2><p>Entidades activas: <strong id="entityCount">0</strong>. Agrega elementos sin salir de la vista previa.</p></div><div class="editor-actions"><button id="addObstacle">+ Obstáculo</button><button id="addEnergy">+ Energía</button><button id="clearEditor">Limpiar añadidos</button></div></section><section class="facts"><article><strong>WebGL</strong><span>Render 3D nativo</span></article><article><strong>Physics</strong><span>Gravedad + AABB</span></article><article><strong>Particles</strong><span>Emisión procedural</span></article><article><strong>Audio</strong><span>Web Audio local</span></article></section></main><script src="main.js"></script></body></html>';
  const css=':root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color-scheme:dark;background:#030807;color:#effff9}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -20%,#154936 0,#07110f 38%,#030807 72%);color:#effff9}button{font:inherit;color:#eafff7;background:#10251e;border:1px solid #2a5a47;border-radius:12px;padding:10px 14px;cursor:pointer}button:hover,button:focus-visible{border-color:#45e9ad;outline:none;box-shadow:0 0 0 3px #45e9ad22}.hero{display:flex;justify-content:space-between;gap:20px;align-items:end;padding:18px 20px 12px}.hero h1{margin:.2rem 0;font-size:clamp(1.45rem,4vw,2.5rem)}.hero p{margin:.25rem 0;color:#a9c9bd}.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:#55e6ae}.hud{display:grid;gap:4px;min-width:240px;padding:12px 14px;border:1px solid #23463a;border-radius:16px;background:#07130fbb;box-shadow:0 18px 60px #0006}.hud span{display:flex;justify-content:space-between;gap:14px}.stage{position:relative;margin:0 16px;border:1px solid #1e4436;border-radius:22px;overflow:hidden;background:#020605;box-shadow:0 25px 80px #0008}canvas{display:block;width:100%;height:min(64vh,680px);min-height:420px}.fallback{display:grid;place-items:center;min-height:420px;padding:30px;color:#ffd9d9}.toolbar,.editor,.facts{margin:14px 16px;display:flex;gap:10px;flex-wrap:wrap}.toolbar{justify-content:center}.editor{justify-content:space-between;align-items:center;padding:14px 16px;border:1px solid #2b5e49;border-radius:18px;background:#081a14}.editor h2{margin:.2rem 0}.editor p{margin:.25rem 0;color:#a9c9bd}.editor-actions{display:flex;gap:8px;flex-wrap:wrap}.facts{display:grid;grid-template-columns:repeat(4,1fr)}.facts article{padding:13px;border:1px solid #183b2e;border-radius:14px;background:#07130fcc;display:grid;gap:4px}.facts span{color:#86a99c;font-size:.82rem}.touch{position:absolute;left:16px;bottom:16px;display:grid;grid-template-columns:repeat(3,44px);grid-template-areas:". up ." "left jump right" ". down .";gap:6px}.touch button{width:44px;height:44px;padding:0;border-radius:50%;background:#07130fdd;backdrop-filter:blur(8px)}.touch button:nth-child(1){grid-area:up}.touch button:nth-child(2){grid-area:left}.touch button:nth-child(3){grid-area:jump}.touch button:nth-child(4){grid-area:right}.touch button:nth-child(5){grid-area:down}@media(pointer:fine){.touch{opacity:.38}.touch:hover{opacity:1}}@media(max-width:760px){.hero{align-items:stretch;flex-direction:column}.hud{min-width:0}.stage{margin:0 8px}.toolbar,.editor,.facts{margin:10px 8px}.facts{grid-template-columns:repeat(2,1fr)}canvas{height:57vh;min-height:360px}.editor{align-items:stretch;flex-direction:column}}';
  const manifest={
    schema:'wae-product/v5',name:title,profile,targets:['web-preview'],entry:'index.html',
    studio:GAME_STUDIO_VERSION,capabilities:['scene-graph','entities','physics-aabb','materials','particles','web-audio','levels','scene-editor','keyboard-touch']
  };
  const readme=['# '+title,'','Producto 3D autocontenido generado por Universal Core '+GAME_STUDIO_VERSION+'.','','## Incluye','- WebGL/WebGL2 sin CDN ni recursos remotos.','- Escena y entidades declarativas.','- Física local con gravedad, salto, límites y colisiones AABB.','- Materiales por entidad.','- Partículas procedurales.','- Audio procedural con Web Audio tras interacción del usuario.','- Niveles, objetivo, HUD, pausa y reinicio.','- Editor de escena dentro de la preview para agregar obstáculos y coleccionables.','- Controles teclado y táctiles.','','## Archivos','scene.json conserva la definición declarativa de referencia. main.js incluye una copia embebida para que la preview aislada funcione sin fetch.','','## QA','El paquete debe superar Product Foundry v5 y Game Studio v6. No se afirma build nativo, publicación ni backend.'].join('\n');
  const studioDoc=['# WAE Game Studio v6','','Pipeline: brief → escena → entidades → física → materiales → partículas/audio → niveles → preview → QA.','','La plantilla nativa existe como recuperación determinista cuando los proveedores generativos no están disponibles. La IA puede enriquecer el proyecto, pero el arranque 3D no depende de ella.'].join('\n');
  return {
    plan:'Game Studio v6 construyó una experiencia 3D local con escena, entidades, físicas, materiales, partículas, audio, niveles y editor integrado.',
    files:[
      {name:'index.html',content:html},
      {name:'styles.css',content:css},
      {name:'main.js',content:gameMain(scene,request)},
      {name:'scene.json',content:JSON.stringify(scene,null,2)},
      {name:'wae-product.json',content:JSON.stringify(manifest,null,2)},
      {name:'README.md',content:readme},
      {name:'GAME-STUDIO.md',content:studioDoc}
    ]
  };
}

export function inspectGameStudioProject(files){
  const map=new Map((files||[]).map(f=>[f.name,String(f.content||'')]));
  const js=map.get('main.js')||'',html=map.get('index.html')||'',sceneRaw=map.get('scene.json')||'';
  let scene=null;try{scene=JSON.parse(sceneRaw)}catch{}
  const checks={
    studioScene:Boolean(scene&&scene.engine===GAME_STUDIO_VERSION&&Array.isArray(scene.entities)&&scene.entities.length>=4),
    levels:Boolean(scene&&Array.isArray(scene.levels)&&scene.levels.length>=1),
    materials:Boolean(scene&&scene.materials&&Object.keys(scene.materials).length>=3),
    sceneGraph:/entities|scene/i.test(js)&&/entity/i.test(js),
    physics:/gravity/i.test(js)&&/velocity/i.test(js)&&/aabb|overlaps/i.test(js),
    particles:/particles/i.test(js)&&/emitParticles/i.test(js),
    audio:/AudioContext|webkitAudioContext/i.test(js),
    editor:/editorPanel|toggleEditor|addEntity/i.test(js)&&/Editor de escena/i.test(html),
    camera:/lookAt|cameraMatrix|perspective/i.test(js),
    input:/keydown/i.test(js)&&/pointerdown/i.test(js),
    levelRuntime:/levelIndex|resetLevel|goal/i.test(js)
  };
  const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
  return{pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
