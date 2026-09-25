import {
  createNativeGameStudioProject as createV7Project,
  supportsNativeGameStudio
} from './game-studio-v7.js';

export const GAME_STUDIO_VERSION='wae-game-studio/v8';
export const WORLD_SCHEMA='wae-world/v8';
export { supportsNativeGameStudio };

const byName=files=>new Map((files||[]).map(file=>[file.name,file]));
const replaceOrAdd=(files,name,content)=>{
  const found=files.some(file=>file.name===name);
  return found?files.map(file=>file.name===name?{...file,content}:file):files.concat([{name,content}]);
};
const clone=value=>JSON.parse(JSON.stringify(value));

function worldFromScene(scene){
  const base=clone(scene.entities);
  const second=clone(base).map(entity=>{
    const next=clone(entity);
    if(next.type==='player')next.position=[-4,0.7,3.5];
    if(next.type==='collectible')next.position=[-next.position[0],next.position[1],next.position[2]-2];
    if(next.type==='obstacle')next.position=[next.position[0]*.75,next.position[1],next.position[2]-3];
    return next;
  });
  return {
    schema:WORLD_SCHEMA,
    activeSceneId:'world-alpha',
    lighting:{ambient:0.78,sky:[0.015,0.028,0.06,1],direction:[-0.4,-1,-0.25],intensity:1},
    scenes:[
      {
        id:'world-alpha',name:'Órbita Alpha',entities:base,
        spawnPoints:[{id:'spawn-alpha',position:[0,0.7,3]}],
        triggers:[
          {id:'trigger-alpha-message',type:'zone',position:[0,0.8,-5],size:[2,2,2],once:true,action:{type:'message',text:'Portal Alpha descubierto'}},
          {id:'trigger-alpha-exit',type:'zone',position:[8,0.8,-8],size:[1.6,2,1.6],once:false,action:{type:'scene',target:'world-beta'}}
        ]
      },
      {
        id:'world-beta',name:'Sector Beta',entities:second,
        spawnPoints:[{id:'spawn-beta',position:[-4,0.7,3.5]}],
        triggers:[
          {id:'trigger-beta-message',type:'zone',position:[3,0.8,-6],size:[2,2,2],once:true,action:{type:'message',text:'Sector Beta sincronizado'}},
          {id:'trigger-beta-return',type:'zone',position:[-8,0.8,-8],size:[1.6,2,1.6],once:false,action:{type:'scene',target:'world-alpha'}}
        ]
      }
    ],
    prefabs:{
      crate:{label:'Caja',type:'obstacle',scale:[0.65,0.65,0.65],material:'obstacle',dynamic:false},
      energy:{label:'Energía',type:'collectible',scale:[0.34,0.34,0.34],material:'collectible',dynamic:false},
      tower:{label:'Torre',type:'obstacle',scale:[0.8,2.2,0.8],material:'accent',dynamic:false}
    },
    missions:[
      {id:'mission-energy',title:'Recolecta energía',type:'score',target:4,status:'active'},
      {id:'mission-explore',title:'Explora dos sectores',type:'scenes',target:2,status:'active'}
    ],
    visitedScenes:['world-alpha']
  };
}

function upgradeScene(raw){
  const scene=JSON.parse(raw);
  scene.engine=GAME_STUDIO_VERSION;
  scene.editor={...(scene.editor||{}),worldBuilder:true,prefabs:true,triggers:true,missions:true,cameraEditor:true,lightingEditor:true,version:8};
  scene.world=worldFromScene(scene);
  scene.entities=clone(scene.world.scenes[0].entities);
  return scene;
}

function worldMarkup(){
  return '<section id="worldBuilderPanel" class="world-builder">'
    +'<div class="world-head"><div><p class="eyebrow">GAME STUDIO V8 · WORLD BUILDER</p><h2>Constructor de mundos</h2><p>Mapas, prefabs, cámara, iluminación, triggers y misiones desde la misma preview.</p></div><button id="saveWorld" type="button" class="save-world">Guardar mundo</button></div>'
    +'<div class="world-grid"><section class="world-card"><div class="panel-title">Escenas <span id="worldSceneCount">0</span></div><select id="worldSceneSelect" aria-label="Escena activa"></select><div class="world-actions"><button id="newWorldScene">＋ Nueva</button><button id="duplicateWorldScene">Duplicar</button><button id="deleteWorldScene">Eliminar</button></div><div class="world-mini"><span>Visitadas <strong id="visitedScenes">1</strong></span><span>Triggers <strong id="triggerCount">0</strong></span></div></section>'
    +'<section class="world-card"><div class="panel-title">Prefabs</div><div id="prefabLibrary" class="prefab-library"></div><div class="world-actions"><button id="spawnPrefab">Instanciar prefab</button><button id="addTrigger">＋ Trigger aquí</button></div></section>'
    +'<section class="world-card"><div class="panel-title">Cámara</div><div class="xyz"><label>X<input id="camX" type="number" step="0.2"></label><label>Y<input id="camY" type="number" step="0.2"></label><label>Z<input id="camZ" type="number" step="0.2"></label></div><label>FOV<input id="camFov" type="range" min="35" max="95" step="1"><output id="camFovValue"></output></label><button id="applyCamera">Aplicar cámara</button></section>'
    +'<section class="world-card"><div class="panel-title">Iluminación</div><label>Ambiente<input id="ambientLight" type="range" min="0.2" max="1.4" step="0.05"><output id="ambientValue"></output></label><label>Fondo<input id="skyColor" type="color"></label><button id="applyLighting">Aplicar luz</button></section>'
    +'<section class="world-card mission-card"><div class="panel-title">Misiones</div><div id="missionList"></div><button id="addMission">＋ Misión de energía</button></section>'
    +'</div><div id="worldSaveStatus" class="scene-save-status" role="status"></div></section>';
}

function worldCss(){
  return [
    '.world-builder{margin:14px 16px;padding:15px;border:1px solid #274f42;border-radius:20px;background:linear-gradient(180deg,#071812,#040d0a);box-shadow:0 20px 70px #0007}.world-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:12px}.world-head h2{margin:.18rem 0}.world-head p{margin:.2rem 0;color:#96b8ac}.save-world{background:#174b38;border-color:#53e5ae}.world-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.world-card{border:1px solid #1d4335;border-radius:14px;background:#06110d;padding:11px;min-width:0}.world-card label{display:grid;gap:5px;font-size:.72rem;color:#9fc0b4;margin:7px 0}.world-card input,.world-card select{width:100%;min-width:0;background:#030a08;color:#effff9;border:1px solid #254c3d;border-radius:9px;padding:8px}.world-card input[type="color"]{height:38px;padding:2px}.world-card output{font-size:.7rem;color:#64e8b5}.world-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.world-actions button{padding:7px 9px}.world-mini{display:flex;justify-content:space-between;gap:8px;margin-top:9px;font-size:.72rem;color:#81a99a}.prefab-library{display:grid;gap:5px}.prefab-library button{display:flex;justify-content:space-between;width:100%;padding:7px 9px}.prefab-library button[aria-pressed="true"]{border-color:#58e5b2;background:#123127}.mission-card{grid-column:span 1}.mission-card article{padding:7px 0;border-bottom:1px solid #17382c}.mission-card article:last-child{border-bottom:0}.mission-card small{display:block;color:#7da494;margin-top:3px}',
    '@media(max-width:1100px){.world-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mission-card{grid-column:span 2}}@media(max-width:760px){.world-builder{margin:10px 8px}.world-head{align-items:stretch;flex-direction:column}.world-grid{grid-template-columns:1fr}.mission-card{grid-column:auto}}'
  ].join('');
}

function runtimeV8(){
  return [
    "const worldState={selectedPrefab:'crate',triggered:new Set(),lastTriggerAt:0};",
    "function activeWorldScene(){return SCENE.world.scenes.find(scene=>scene.id===SCENE.world.activeSceneId)||SCENE.world.scenes[0]}",
    "function syncEntitiesIntoWorld(){const scene=activeWorldScene();if(scene)scene.entities=clone(entities)}",
    "function worldUniqueId(base,list){let n=1,id=base+'-'+n;const ids=new Set(list.map(item=>item.id));while(ids.has(id)){n++;id=base+'-'+n}return id}",
    "function loadWorldScene(id){syncEntitiesIntoWorld();const next=SCENE.world.scenes.find(scene=>scene.id===id);if(!next)return false;SCENE.world.activeSceneId=next.id;entities=clone(next.entities);const spawn=next.spawnPoints?.[0];const p=player();if(spawn&&p)p.position=clone(spawn.position);if(!SCENE.world.visitedScenes.includes(next.id))SCENE.world.visitedScenes.push(next.id);worldState.triggered.clear();studioEditor.selectedId='';renderStudioEditor();renderWorldBuilder();syncUI();tone(520,.07);return true}",
    "function createWorldScene(){syncEntitiesIntoWorld();const current=activeWorldScene(),id=worldUniqueId('world',SCENE.world.scenes),copy=clone(current);copy.id=id;copy.name='Escena '+SCENE.world.scenes.length;copy.entities=copy.entities.map(entity=>({...entity,id:entity.type==='player'?'player':entity.type==='floor'?'floor':worldUniqueId(entity.type,copy.entities)}));copy.spawnPoints=[{id:'spawn-'+id,position:[0,.7,3]}];copy.triggers=[];SCENE.world.scenes.push(copy);loadWorldScene(id)}",
    "function duplicateWorldScene(){syncEntitiesIntoWorld();const current=activeWorldScene();if(!current)return;const copy=clone(current),id=worldUniqueId('world-copy',SCENE.world.scenes);copy.id=id;copy.name=current.name+' copia';copy.triggers=(copy.triggers||[]).map((t,i)=>({...t,id:'trigger-'+id+'-'+(i+1)}));SCENE.world.scenes.push(copy);loadWorldScene(id)}",
    "function deleteWorldScene(){if(SCENE.world.scenes.length<=1){ui.status.textContent='Debe existir al menos una escena.';return}const current=activeWorldScene();SCENE.world.scenes=SCENE.world.scenes.filter(scene=>scene.id!==current.id);loadWorldScene(SCENE.world.scenes[0].id)}",
    "function renderScenePicker(){const select=editorEl('worldSceneSelect');if(!select)return;select.replaceChildren();for(const scene of SCENE.world.scenes){const o=document.createElement('option');o.value=scene.id;o.textContent=scene.name;select.appendChild(o)}select.value=SCENE.world.activeSceneId;editorEl('worldSceneCount').textContent=String(SCENE.world.scenes.length);editorEl('visitedScenes').textContent=String(SCENE.world.visitedScenes.length);editorEl('triggerCount').textContent=String(activeWorldScene()?.triggers?.length||0)}",
    "function renderPrefabLibrary(){const host=editorEl('prefabLibrary');if(!host)return;host.replaceChildren();for(const [name,prefab] of Object.entries(SCENE.world.prefabs)){const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(worldState.selectedPrefab===name));const l=document.createElement('span');l.textContent=prefab.label||name;const t=document.createElement('small');t.textContent=prefab.type;b.append(l,t);b.addEventListener('click',()=>{worldState.selectedPrefab=name;renderPrefabLibrary()});host.appendChild(b)}}",
    "function spawnWorldPrefab(){const prefab=SCENE.world.prefabs[worldState.selectedPrefab],p=player();if(!prefab)return;pushEditorHistory();const e=clone(prefab);e.id=uniqueEntityId('prefab-'+worldState.selectedPrefab);e.label=(prefab.label||worldState.selectedPrefab)+' '+entities.length;e.position=p?[p.position[0]+1.3,Math.max(.4,p.position[1]),p.position[2]-1.3]:[0,.7,0];e.rotation=0;entities.push(e);studioEditor.selectedId=e.id;emitParticles(e.position,'accent');syncEntitiesIntoWorld();renderStudioEditor();renderWorldBuilder()}",
    "function addWorldTrigger(){const scene=activeWorldScene(),p=player();if(!scene||!p)return;scene.triggers=scene.triggers||[];const id=worldUniqueId('trigger',scene.triggers);scene.triggers.push({id,type:'zone',position:clone(p.position),size:[2,2,2],once:true,action:{type:'message',text:'Trigger '+id+' activado'}});renderWorldBuilder()}",
    "function pointInsideTrigger(pos,t){return Math.abs(pos[0]-t.position[0])<=t.size[0]/2&&Math.abs(pos[1]-t.position[1])<=t.size[1]/2&&Math.abs(pos[2]-t.position[2])<=t.size[2]/2}",
    "function processWorldTriggers(){const p=player(),scene=activeWorldScene();if(!p||!scene)return;for(const t of scene.triggers||[]){if(t.once&&worldState.triggered.has(t.id))continue;if(!pointInsideTrigger(p.position,t))continue;worldState.triggered.add(t.id);if(t.action?.type==='message')ui.status.textContent=t.action.text||'Trigger activado';if(t.action?.type==='scene'&&t.action.target)loadWorldScene(t.action.target)}}",
    "function renderMissions(){const host=editorEl('missionList');if(!host)return;host.replaceChildren();for(const mission of SCENE.world.missions){const a=document.createElement('article');const strong=document.createElement('strong');strong.textContent=mission.title;const small=document.createElement('small');let progress=mission.type==='score'?Math.min(state.score,mission.target):Math.min(SCENE.world.visitedScenes.length,mission.target);mission.status=progress>=mission.target?'completed':'active';small.textContent=progress+' / '+mission.target+' · '+mission.status;a.append(strong,small);host.appendChild(a)}}",
    "function addWorldMission(){const id=worldUniqueId('mission',SCENE.world.missions);SCENE.world.missions.push({id,title:'Recolecta más energía',type:'score',target:Math.max(3,state.score+3),status:'active'});renderMissions()}",
    "function rgbaHex(value){const c=Array.isArray(value)?value:[.02,.03,.06,1];return '#'+c.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('')}",
    "function hexRgba(hex){const raw=String(hex||'#000000').replace('#','');return[parseInt(raw.slice(0,2),16)/255,parseInt(raw.slice(2,4),16)/255,parseInt(raw.slice(4,6),16)/255,1]}",
    "const baseMaterialColors=clone(SCENE.materials);",
    "function applyWorldLighting(){const ambient=Math.max(.2,Math.min(1.4,Number(SCENE.world.lighting.ambient)||1));for(const [name,color] of Object.entries(baseMaterialColors)){if(name.startsWith('gizmo')){SCENE.materials[name]=clone(color);continue}SCENE.materials[name]=color.map((v,i)=>i===3?v:Math.max(0,Math.min(1,v*ambient)))}const sky=SCENE.world.lighting.sky;if(gl&&Array.isArray(sky))gl.clearColor(sky[0],sky[1],sky[2],sky[3]??1)}",
    "function applyCameraEditor(){SCENE.camera.offset=[Number(editorEl('camX').value)||0,Number(editorEl('camY').value)||0,Number(editorEl('camZ').value)||0];SCENE.camera.fov=Math.max(35,Math.min(95,Number(editorEl('camFov').value)||62));renderWorldBuilder()}",
    "function applyLightingEditor(){SCENE.world.lighting.ambient=Number(editorEl('ambientLight').value)||.78;SCENE.world.lighting.sky=hexRgba(editorEl('skyColor').value);applyWorldLighting();renderWorldBuilder()}",
    "function renderWorldBuilder(){renderScenePicker();renderPrefabLibrary();renderMissions();if(editorEl('camX')){editorEl('camX').value=SCENE.camera.offset[0];editorEl('camY').value=SCENE.camera.offset[1];editorEl('camZ').value=SCENE.camera.offset[2];editorEl('camFov').value=SCENE.camera.fov;editorEl('camFovValue').textContent=SCENE.camera.fov+'°';editorEl('ambientLight').value=SCENE.world.lighting.ambient;editorEl('ambientValue').textContent=Number(SCENE.world.lighting.ambient).toFixed(2);editorEl('skyColor').value=rgbaHex(SCENE.world.lighting.sky)}}",
    "function worldPayload(){syncEntitiesIntoWorld();const next=clone(SCENE);next.engine='"+GAME_STUDIO_VERSION+"';next.entities=clone(entities);next.world.activeSceneId=SCENE.world.activeSceneId;return next}",
    "function saveWorldToFactory(){const payload=worldPayload(),status=editorEl('worldSaveStatus');try{window.parent.postMessage({type:'wae-game-studio-world-save',studio:'"+GAME_STUDIO_VERSION+"',world:payload.world,scene:payload},'*');if(status)status.textContent='Guardando mundo en la Fábrica…'}catch(error){if(status)status.textContent='No se pudo guardar el mundo: '+String(error.message||error)}}",
    "addEventListener('message',event=>{const data=event.data;if(!data||data.type!=='wae-game-studio-world-saved')return;const status=editorEl('worldSaveStatus');if(status)status.textContent=data.ok?'Mundo guardado en world.json, scene.json y main.js.':'Error al guardar mundo: '+String(data.message||'persistencia rechazada')})",
    "function worldTick(){if(state.running&&!state.editor)processWorldTriggers();renderMissions();requestAnimationFrame(worldTick)}"
  ].join('\n');
}

function wireV8(js){
  js=js.replace(
    /const SCENE=.*;$/m,
    match=>match
  );
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();gl.clearColor(.015,.025,.055,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);const vp=cameraMatrix();for(const e of entities)drawCube(e,vp);drawEditorGizmo(vp);for(const p of state.particles)drawCube(p,vp)}",
    runtimeV8()+"\nfunction renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];gl.clearColor(sky[0],sky[1],sky[2],sky[3]??1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);const vp=cameraMatrix();for(const e of entities)drawCube(e,vp);drawEditorGizmo(vp);for(const p of state.particles)drawCube(p,vp)}"
  );
  js=js.replace(
    "try{if(initGL()){syncUI();requestAnimationFrame(frame)}}catch(error)",
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick)}}catch(error)"
  );
  js=js.replace(
    "document.querySelector('#clearEditor')?.addEventListener('click',clearEditorEntities);",
    "document.querySelector('#clearEditor')?.addEventListener('click',clearEditorEntities);"
  );
  const hook="canvas.addEventListener('pointerdown',()=>ensureAudio());";
  const listeners=[
    "editorEl('worldSceneSelect')?.addEventListener('change',e=>loadWorldScene(e.target.value));",
    "editorEl('newWorldScene')?.addEventListener('click',createWorldScene);",
    "editorEl('duplicateWorldScene')?.addEventListener('click',duplicateWorldScene);",
    "editorEl('deleteWorldScene')?.addEventListener('click',deleteWorldScene);",
    "editorEl('spawnPrefab')?.addEventListener('click',spawnWorldPrefab);",
    "editorEl('addTrigger')?.addEventListener('click',addWorldTrigger);",
    "editorEl('addMission')?.addEventListener('click',addWorldMission);",
    "editorEl('applyCamera')?.addEventListener('click',applyCameraEditor);",
    "editorEl('applyLighting')?.addEventListener('click',applyLightingEditor);",
    "editorEl('camFov')?.addEventListener('input',e=>{editorEl('camFovValue').textContent=e.target.value+'°'});",
    "editorEl('ambientLight')?.addEventListener('input',e=>{editorEl('ambientValue').textContent=Number(e.target.value).toFixed(2)});",
    "editorEl('saveWorld')?.addEventListener('click',saveWorldToFactory);"
  ].join('');
  js=js.replace(hook,listeners+hook);
  js=js.replace(
    /window\.WAEGameStudio=\{version:'wae-game-studio\/v7'[^\n]*\};/,
    "window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,state,addEntity,resetLevel,selectEntity,duplicateSelected,deleteSelected,nudgeSelected,saveSceneToFactory,scenePayload,loadWorldScene,spawnWorldPrefab,saveWorldToFactory,worldPayload};"
  );
  return js;
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
  const project=createV7Project({request,profile});
  let files=project.files.map(file=>({...file}));
  const map=byName(files);
  const scene=upgradeScene(map.get('scene.json').content);

  let html=map.get('index.html').content
    .replace(/GAME STUDIO V7/g,'GAME STUDIO V8')
    .replace('</section><section class="facts">','</section>'+worldMarkup()+'<section class="facts">');
  let css=map.get('styles.css').content+worldCss();
  let js=map.get('main.js').content
    .replace(/^const SCENE=.*;$/m,'const SCENE='+JSON.stringify(scene)+';');
  js=wireV8(js);

  const manifest=JSON.parse(map.get('wae-product.json').content);
  manifest.studio=GAME_STUDIO_VERSION;
  manifest.world=WORLD_SCHEMA;
  manifest.capabilities=Array.from(new Set([...(manifest.capabilities||[]),
    'multi-scene-worlds','prefab-library','spawn-points','zone-triggers','scene-transitions','mission-system','camera-editor','lighting-editor','world-persistence'
  ]));

  const readme=map.get('README.md').content
    .replace(/wae-game-studio\/v7/g,GAME_STUDIO_VERSION)
    .replace(/Game Studio v7/g,'Game Studio v8')
    +'\n\n## World Builder v8\nMúltiples escenas, prefabs, spawn points, triggers, transición entre mapas, misiones, cámara e iluminación editables y persistencia de world.json/scene.json/main.js.\n';
  const studioDoc='# WAE Game Studio v8 · World Builder\n\nPipeline: brief → mundo → escenas → entidades/prefabs → spawn → triggers → misiones → cámara/iluminación → runtime → persistencia → QA.\n\nworld.json es el contrato portable del mundo. La preview sigue aislada y guarda mediante postMessage validado por la Fábrica.\n';

  files=replaceOrAdd(files,'index.html',html);
  files=replaceOrAdd(files,'styles.css',css);
  files=replaceOrAdd(files,'main.js',js);
  files=replaceOrAdd(files,'scene.json',JSON.stringify(scene,null,2));
  files=replaceOrAdd(files,'world.json',JSON.stringify(scene.world,null,2));
  files=replaceOrAdd(files,'wae-product.json',JSON.stringify(manifest,null,2));
  files=replaceOrAdd(files,'README.md',readme);
  files=replaceOrAdd(files,'GAME-STUDIO.md',studioDoc);

  return{
    plan:'Game Studio v8 construyó un mundo 3D multi-escena con prefabs, spawn points, triggers, misiones, cámara, iluminación y persistencia portable.',
    files
  };
}

export function inspectGameStudioProject(files){
  const map=byName(files);
  const js=map.get('main.js')?.content||'';
  const html=map.get('index.html')?.content||'';
  const sceneRaw=map.get('scene.json')?.content||'';
  const worldRaw=map.get('world.json')?.content||'';
  let scene=null,world=null;
  try{scene=JSON.parse(sceneRaw)}catch{}
  try{world=JSON.parse(worldRaw)}catch{}
  const checks={
    studioScene:Boolean(scene&&scene.engine===GAME_STUDIO_VERSION&&Array.isArray(scene.entities)&&scene.entities.length>=4),
    worldFile:Boolean(world&&world.schema===WORLD_SCHEMA&&Array.isArray(world.scenes)&&world.scenes.length>=2),
    scenes:Boolean(world?.scenes?.every(item=>item.id&&item.name&&Array.isArray(item.entities)&&item.entities.some(e=>e.type==='player')&&item.entities.some(e=>e.type==='floor'))),
    prefabs:Boolean(world?.prefabs&&Object.keys(world.prefabs).length>=3),
    spawnPoints:Boolean(world?.scenes?.every(item=>Array.isArray(item.spawnPoints)&&item.spawnPoints.length>=1)),
    triggers:Boolean(world?.scenes?.every(item=>Array.isArray(item.triggers))&&world.scenes.some(item=>item.triggers.length>=1)),
    missions:Boolean(Array.isArray(world?.missions)&&world.missions.length>=2),
    lighting:Boolean(world?.lighting&&Array.isArray(world.lighting.sky)&&typeof world.lighting.ambient==='number'),
    sceneGraph:/entities|scene/i.test(js)&&/entity/i.test(js),
    physics:/gravity/i.test(js)&&/velocity/i.test(js)&&/aabb|overlaps/i.test(js),
    particles:/particles/i.test(js)&&/emitParticles/i.test(js),
    audio:/AudioContext|webkitAudioContext/i.test(js),
    hierarchy:/entityHierarchy|renderHierarchy/i.test(js+html),
    inspector:/renderInspector|selectedEntity|entityMaterial/i.test(js+html),
    transforms:/posX|scaleX|rotY|nudgeSelected/i.test(js+html),
    worldBuilder:/worldBuilderPanel|renderWorldBuilder|worldSceneSelect/i.test(js+html),
    prefabRuntime:/spawnWorldPrefab|prefabLibrary/i.test(js+html),
    triggerRuntime:/processWorldTriggers|addWorldTrigger/i.test(js+html),
    missionRuntime:/renderMissions|addWorldMission/i.test(js+html),
    cameraEditor:/applyCameraEditor|camFov|camX/i.test(js+html),
    lightingEditor:/applyLightingEditor|ambientLight|skyColor/i.test(js+html),
    transitions:/loadWorldScene|activeSceneId/i.test(js),
    persistence:/wae-game-studio-world-save/i.test(js)&&/window\.parent\.postMessage/i.test(js)&&/saveWorldToFactory/i.test(js),
    input:/keydown/i.test(js)&&/pointerdown/i.test(js)
  };
  const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
  return{pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
