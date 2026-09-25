import {
  createNativeGameStudioProject as createV6Project,
  supportsNativeGameStudio
} from './game-studio-v6.js';

export const GAME_STUDIO_VERSION='wae-game-studio/v7';
export { supportsNativeGameStudio };

const byName=files=>new Map((files||[]).map(file=>[file.name,file]));
const replaceFile=(files,name,content)=>files.map(file=>file.name===name?{...file,content}:file);

function upgradedScene(raw){
  const scene=JSON.parse(raw);
  scene.engine=GAME_STUDIO_VERSION;
  scene.editor={
    hierarchy:true,
    inspector:true,
    transformGizmo:true,
    persistence:'factory-postmessage',
    version:7
  };
  scene.materials.gizmoX=[1,0.28,0.28,1];
  scene.materials.gizmoY=[0.25,1,0.48,1];
  scene.materials.gizmoZ=[0.32,0.56,1,1];
  for(const entity of scene.entities){
    if(typeof entity.rotation!=='number')entity.rotation=0;
    if(typeof entity.label!=='string')entity.label=entity.id;
  }
  return scene;
}

function editorMarkup(){
  return '<section id="editorPanel" class="editor studio-v7" hidden>'
    +'<div class="studio-head"><div><p class="eyebrow">GAME STUDIO V7</p><h2>Editor visual de escena</h2><p>Selecciona una entidad, transforma, duplica, elimina y guarda los cambios en el proyecto.</p></div>'
    +'<div class="studio-head-actions"><button id="undoScene" type="button">↶ Deshacer</button><button id="saveScene" type="button" class="save-scene">Guardar escena</button></div></div>'
    +'<div class="studio-grid"><aside class="hierarchy"><div class="panel-title">Jerarquía <strong id="entityCount">0</strong></div><div id="entityHierarchy" class="entity-tree" role="listbox" aria-label="Entidades de escena"></div>'
    +'<div class="editor-actions"><button id="addObstacle" type="button">+ Obstáculo</button><button id="addEnergy" type="button">+ Energía</button><button id="duplicateEntity" type="button">Duplicar</button><button id="deleteEntity" type="button">Eliminar</button></div></aside>'
    +'<section class="inspector"><div class="panel-title">Inspector <span id="selectedEntity">Sin selección</span></div>'
    +'<div class="field-row"><label>ID<input id="entityId" readonly></label><label>Tipo<input id="entityType" readonly></label></div>'
    +'<fieldset><legend>Posición</legend><div class="xyz"><label>X<input id="posX" type="number" step="0.1"></label><label>Y<input id="posY" type="number" step="0.1"></label><label>Z<input id="posZ" type="number" step="0.1"></label></div></fieldset>'
    +'<fieldset><legend>Escala</legend><div class="xyz"><label>X<input id="scaleX" type="number" min="0.05" step="0.1"></label><label>Y<input id="scaleY" type="number" min="0.05" step="0.1"></label><label>Z<input id="scaleZ" type="number" min="0.05" step="0.1"></label></div></fieldset>'
    +'<div class="field-row"><label>Rotación Y<input id="rotY" type="number" step="0.1"></label><label>Material<select id="entityMaterial"></select></label></div>'
    +'<div class="field-row"><label>Color material<input id="materialColor" type="color"></label><label>Dinámica<select id="entityDynamic"><option value="false">No</option><option value="true">Sí</option></select></label></div>'
    +'<div class="gizmo-controls" aria-label="Gizmo de transformación"><span>Gizmo</span><button data-nudge="x,-0.25">X−</button><button data-nudge="x,0.25">X+</button><button data-nudge="y,-0.25">Y−</button><button data-nudge="y,0.25">Y+</button><button data-nudge="z,-0.25">Z−</button><button data-nudge="z,0.25">Z+</button></div>'
    +'</section></div><div id="sceneSaveStatus" class="scene-save-status" role="status"></div></section>';
}

function editorCss(){
  return [
    '.studio-v7{display:block!important;padding:14px 16px}.studio-v7[hidden]{display:none!important}',
    '.studio-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:12px}.studio-head h2{margin:.2rem 0}.studio-head p{margin:.2rem 0;color:#a9c9bd}.studio-head-actions{display:flex;gap:8px;flex-wrap:wrap}.save-scene{background:#174b38;border-color:#42d79f}',
    '.studio-grid{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(320px,1.4fr);gap:12px}.hierarchy,.inspector{border:1px solid #21483a;border-radius:15px;background:#06110d;padding:12px;min-width:0}.panel-title{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:#86b7a5;margin-bottom:10px}',
    '.entity-tree{display:grid;gap:5px;max-height:300px;overflow:auto}.entity-tree button{display:flex;justify-content:space-between;text-align:left;width:100%;padding:8px 10px;background:#0b1b15}.entity-tree button[aria-selected="true"]{border-color:#57e5b0;background:#123127}.entity-tree small{opacity:.65}',
    '.studio-v7 .editor-actions{display:grid;grid-template-columns:repeat(2,1fr);margin-top:10px}.inspector fieldset{border:1px solid #1f4537;border-radius:12px;margin:8px 0;padding:9px}.inspector legend{font-size:.72rem;color:#8cb6a7;padding:0 6px}.xyz,.field-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.field-row{grid-template-columns:repeat(2,1fr);margin:8px 0}.inspector label{display:grid;gap:5px;font-size:.72rem;color:#9fc0b4}.inspector input,.inspector select{width:100%;min-width:0;background:#04100c;border:1px solid #244a3c;border-radius:9px;color:#effff9;padding:8px}.inspector input[type="color"]{padding:2px;height:38px}',
    '.gizmo-controls{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}.gizmo-controls span{font-size:.7rem;color:#82ad9d;margin-right:4px}.gizmo-controls button{padding:7px 9px}.scene-save-status{min-height:1.2em;margin-top:9px;color:#80cfae;font-size:.76rem}',
    '@media(max-width:760px){.studio-head{align-items:stretch;flex-direction:column}.studio-grid{grid-template-columns:1fr}.entity-tree{max-height:190px}.xyz{grid-template-columns:repeat(3,minmax(0,1fr))}.field-row{grid-template-columns:1fr 1fr}}'
  ].join('');
}

function runtimeV7(){
  return [
    "const studioEditor={selectedId:'',history:[]};",
    "const editorEl=id=>document.getElementById(id);",
    "const selectedEntityObject=()=>entities.find(entity=>entity.id===studioEditor.selectedId)||null;",
    "function pushEditorHistory(){studioEditor.history.push({entities:clone(entities),materials:clone(SCENE.materials),selectedId:studioEditor.selectedId});studioEditor.history=studioEditor.history.slice(-20)}",
    "function materialHex(value){const c=Array.isArray(value)?value:[.5,.5,.5,1];return '#'+c.slice(0,3).map(v=>Math.max(0,Math.min(255,Math.round(Number(v)*255))).toString(16).padStart(2,'0')).join('')}",
    "function hexMaterial(hex){const raw=String(hex||'#808080').replace('#','');return[parseInt(raw.slice(0,2),16)/255,parseInt(raw.slice(2,4),16)/255,parseInt(raw.slice(4,6),16)/255,1]}",
    "function uniqueEntityId(base){const seed=String(base||'entity').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,34)||'entity';let n=1,id=seed+'-'+n;while(entities.some(e=>e.id===id)){n++;id=seed+'-'+n}return id}",
    "function selectEntity(id){studioEditor.selectedId=entities.some(e=>e.id===id)?id:'';renderStudioEditor()}",
    "function renderHierarchy(){const host=editorEl('entityHierarchy');if(!host)return;host.replaceChildren();for(const entity of entities){const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(entity.id===studioEditor.selectedId));const label=document.createElement('span');label.textContent=entity.label||entity.id;const type=document.createElement('small');type.textContent=entity.type;b.append(label,type);b.addEventListener('click',()=>selectEntity(entity.id));host.appendChild(b)}}",
    "function fillMaterials(entity){const select=editorEl('entityMaterial');if(!select)return;select.replaceChildren();for(const name of Object.keys(SCENE.materials)){if(name.startsWith('gizmo'))continue;const o=document.createElement('option');o.value=name;o.textContent=name;select.appendChild(o)}select.value=entity?.material||''}",
    "function renderInspector(){const e=selectedEntityObject(),ids=['posX','posY','posZ','scaleX','scaleY','scaleZ','rotY','entityMaterial','materialColor','entityDynamic','duplicateEntity','deleteEntity'];for(const id of ids){const el=editorEl(id);if(el)el.disabled=!e}editorEl('selectedEntity').textContent=e?(e.label||e.id):'Sin selección';editorEl('entityId').value=e?.id||'';editorEl('entityType').value=e?.type||'';if(!e){fillMaterials(null);return}editorEl('posX').value=e.position[0];editorEl('posY').value=e.position[1];editorEl('posZ').value=e.position[2];editorEl('scaleX').value=e.scale[0];editorEl('scaleY').value=e.scale[1];editorEl('scaleZ').value=e.scale[2];editorEl('rotY').value=Number(e.rotation||0).toFixed(2);fillMaterials(e);editorEl('materialColor').value=materialHex(SCENE.materials[e.material]);editorEl('entityDynamic').value=String(Boolean(e.dynamic))}",
    "function renderStudioEditor(){if(editorEl('entityCount'))editorEl('entityCount').textContent=String(entities.length);renderHierarchy();renderInspector()}",
    "function updateSelectedTransform(){const e=selectedEntityObject();if(!e)return;pushEditorHistory();e.position=[Number(editorEl('posX').value)||0,Number(editorEl('posY').value)||0,Number(editorEl('posZ').value)||0];e.scale=[Math.max(.05,Number(editorEl('scaleX').value)||.05),Math.max(.05,Number(editorEl('scaleY').value)||.05),Math.max(.05,Number(editorEl('scaleZ').value)||.05)];e.rotation=Number(editorEl('rotY').value)||0;e.material=editorEl('entityMaterial').value||e.material;e.dynamic=editorEl('entityDynamic').value==='true';renderStudioEditor()}",
    "function nudgeSelected(axis,delta){const e=selectedEntityObject();if(!e)return;pushEditorHistory();const idx={x:0,y:1,z:2}[axis];e.position[idx]=Math.round((e.position[idx]+Number(delta))*100)/100;renderStudioEditor()}",
    "function duplicateSelected(){const e=selectedEntityObject();if(!e)return;pushEditorHistory();const copy=clone(e);copy.id=uniqueEntityId(e.id+'-copy');copy.label=(e.label||e.id)+' copia';copy.position=[e.position[0]+.7,e.position[1],e.position[2]+.7];entities.push(copy);studioEditor.selectedId=copy.id;renderStudioEditor()}",
    "function deleteSelected(){const e=selectedEntityObject();if(!e||e.type==='player'||e.type==='floor'){ui.status.textContent='Jugador y suelo están protegidos.';return}pushEditorHistory();entities=entities.filter(item=>item.id!==e.id);studioEditor.selectedId=entities.find(item=>item.type==='obstacle'||item.type==='collectible')?.id||'';renderStudioEditor()}",
    "function undoSceneEdit(){const prev=studioEditor.history.pop();if(!prev)return;entities=clone(prev.entities);SCENE.materials=clone(prev.materials);studioEditor.selectedId=prev.selectedId;renderStudioEditor()}",
    "function setSelectedMaterialColor(hex){const e=selectedEntityObject();if(!e||!SCENE.materials[e.material])return;pushEditorHistory();SCENE.materials[e.material]=hexMaterial(hex);renderStudioEditor()}",
    "function drawEditorGizmo(vp){if(!state.editor)return;const e=selectedEntityObject();if(!e)return;const p=e.position,s=.9;drawCube({position:[p[0]+s,p[1],p[2]],scale:[.65,.035,.035],material:'gizmoX'},vp);drawCube({position:[p[0],p[1]+s,p[2]],scale:[.035,.65,.035],material:'gizmoY'},vp);drawCube({position:[p[0],p[1],p[2]+s],scale:[.035,.035,.65],material:'gizmoZ'},vp)}",
    "function scenePayload(){const next=clone(SCENE);next.engine='"+GAME_STUDIO_VERSION+"';next.entities=clone(entities);return next}",
    "function saveSceneToFactory(){const payload=scenePayload();const status=editorEl('sceneSaveStatus');try{window.parent.postMessage({type:'wae-game-studio-scene-save',studio:'"+GAME_STUDIO_VERSION+"',scene:payload},'*');if(status)status.textContent='Guardando escena en la Fábrica…'}catch(error){if(status)status.textContent='No se pudo guardar la escena: '+String(error.message||error)}}",
    "addEventListener('message',event=>{const data=event.data;if(!data||data.type!=='wae-game-studio-scene-saved')return;const status=editorEl('sceneSaveStatus');if(status)status.textContent=data.ok?'Escena guardada en scene.json y main.js.':'Error al guardar: '+String(data.message||'persistencia rechazada')})"
  ].join('\n');
}

function wireRuntime(js){
  js=js.replace(/^const SCENE=.*;$/m,match=>match);
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();gl.clearColor(.015,.025,.055,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);const vp=cameraMatrix();for(const e of entities)drawCube(e,vp);for(const p of state.particles)drawCube(p,vp)}",
    runtimeV7()+"\nfunction renderScene(){if(!gl)return;resize();gl.clearColor(.015,.025,.055,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,0,0);const vp=cameraMatrix();for(const e of entities)drawCube(e,vp);drawEditorGizmo(vp);for(const p of state.particles)drawCube(p,vp)}"
  );
  js=js.replace(
    "function toggleEditor(){state.editor=!state.editor;ui.editor.hidden=!state.editor;document.querySelector('#editorToggle').setAttribute('aria-pressed',String(state.editor));syncUI()}",
    "function toggleEditor(){state.editor=!state.editor;ui.editor.hidden=!state.editor;document.querySelector('#editorToggle').setAttribute('aria-pressed',String(state.editor));if(state.editor&&!studioEditor.selectedId)studioEditor.selectedId=entities.find(e=>e.type==='obstacle'||e.type==='collectible')?.id||entities[0]?.id||'';renderStudioEditor();syncUI()}"
  );
  js=js.replace(
    "document.querySelector('#clearEditor').addEventListener('click',clearEditorEntities);",
    "document.querySelector('#clearEditor')?.addEventListener('click',clearEditorEntities);document.querySelector('#duplicateEntity').addEventListener('click',duplicateSelected);document.querySelector('#deleteEntity').addEventListener('click',deleteSelected);document.querySelector('#undoScene').addEventListener('click',undoSceneEdit);document.querySelector('#saveScene').addEventListener('click',saveSceneToFactory);['posX','posY','posZ','scaleX','scaleY','scaleZ','rotY','entityMaterial','entityDynamic'].forEach(id=>document.querySelector('#'+id).addEventListener('change',updateSelectedTransform));document.querySelector('#materialColor').addEventListener('change',e=>setSelectedMaterialColor(e.target.value));document.querySelectorAll('[data-nudge]').forEach(btn=>btn.addEventListener('click',()=>{const [axis,delta]=btn.dataset.nudge.split(',');nudgeSelected(axis,Number(delta))}));"
  );
  js=js.replace(
    /window\.WAEGameStudio=\{version:'wae-game-studio\/v6'[^\n]*\};/,
    "window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,state,addEntity,resetLevel,selectEntity,duplicateSelected,deleteSelected,nudgeSelected,saveSceneToFactory,scenePayload};"
  );
  return js;
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
  let project=createV6Project({request,profile});
  let files=project.files.map(file=>({...file}));
  const map=byName(files);
  const scene=upgradedScene(map.get('scene.json').content);

  let html=map.get('index.html').content
    .replace(/GAME STUDIO V6/g,'GAME STUDIO V7')
    .replace(/<section id="editorPanel"[\s\S]*?<\/section><section class="facts">/,editorMarkup()+'<section class="facts">');

  let css=map.get('styles.css').content+editorCss();
  let js=map.get('main.js').content
    .replace(/^const SCENE=.*;$/m,'const SCENE='+JSON.stringify(scene)+';');
  js=wireRuntime(js);

  const manifest=JSON.parse(map.get('wae-product.json').content);
  manifest.studio=GAME_STUDIO_VERSION;
  manifest.capabilities=[
    'scene-graph','entities','physics-aabb','materials','particles','web-audio','levels','scene-editor','keyboard-touch',
    'scene-hierarchy','entity-inspector','transform-xyz','transform-gizmo','duplicate-delete','material-editor','scene-undo','scene-persistence'
  ];

  const readme=map.get('README.md').content
    .replace(/wae-game-studio\/v6/g,GAME_STUDIO_VERSION)
    .replace(/Game Studio v6/g,'Game Studio v7')
    +'\n\n## Editor visual v7\nLa preview incluye jerarquía, inspector, posición/escala/rotación, gizmo XYZ, duplicar/eliminar, materiales y undo. Guardar escena envía un mensaje seguro a la Fábrica para persistir scene.json y la escena embebida en main.js.\n';

  const studioDoc='# WAE Game Studio v7\n\nPipeline: brief → escena → jerarquía → inspector → transformación → materiales → físicas → runtime → persistencia → QA.\n\nEl editor visual opera dentro de la preview aislada. La persistencia del proyecto se realiza mediante postMessage validado por la Fábrica; no requiere allow-same-origin.\n';

  files=replaceFile(files,'index.html',html);
  files=replaceFile(files,'styles.css',css);
  files=replaceFile(files,'main.js',js);
  files=replaceFile(files,'scene.json',JSON.stringify(scene,null,2));
  files=replaceFile(files,'wae-product.json',JSON.stringify(manifest,null,2));
  files=replaceFile(files,'README.md',readme);
  files=replaceFile(files,'GAME-STUDIO.md',studioDoc);

  return{
    plan:'Game Studio v7 construyó un producto 3D con editor visual persistente, jerarquía, inspector, gizmos XYZ, materiales y runtime jugable.',
    files
  };
}

export function inspectGameStudioProject(files){
  const map=byName(files);
  const js=map.get('main.js')?.content||'';
  const html=map.get('index.html')?.content||'';
  const sceneRaw=map.get('scene.json')?.content||'';
  let scene=null;try{scene=JSON.parse(sceneRaw)}catch{}
  const checks={
    studioScene:Boolean(scene&&scene.engine===GAME_STUDIO_VERSION&&Array.isArray(scene.entities)&&scene.entities.length>=4),
    levels:Boolean(scene&&Array.isArray(scene.levels)&&scene.levels.length>=1),
    materials:Boolean(scene&&scene.materials&&Object.keys(scene.materials).length>=6),
    sceneGraph:/entities|scene/i.test(js)&&/entity/i.test(js),
    physics:/gravity/i.test(js)&&/velocity/i.test(js)&&/aabb|overlaps/i.test(js),
    particles:/particles/i.test(js)&&/emitParticles/i.test(js),
    audio:/AudioContext|webkitAudioContext/i.test(js),
    editor:/editorPanel|toggleEditor|addEntity/i.test(js)&&/Editor visual de escena/i.test(html),
    hierarchy:/entityHierarchy|renderHierarchy/i.test(js+html),
    inspector:/renderInspector|selectedEntity|entityMaterial/i.test(js+html),
    transforms:/posX|scaleX|rotY|nudgeSelected/i.test(js+html),
    gizmo:/drawEditorGizmo|gizmoX|gizmoY|gizmoZ/i.test(js+sceneRaw),
    entityCrud:/duplicateSelected|deleteSelected/i.test(js),
    materialEditor:/materialColor|setSelectedMaterialColor/i.test(js+html),
    undo:/undoSceneEdit|undoScene/i.test(js+html),
    persistence:/wae-game-studio-scene-save/i.test(js)&&/window\.parent\.postMessage/i.test(js)&&/saveSceneToFactory/i.test(js),
    camera:/lookAt|cameraMatrix|perspective/i.test(js),
    input:/keydown/i.test(js)&&/pointerdown/i.test(js),
    levelRuntime:/levelIndex|resetLevel|goal/i.test(js)
  };
  const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
  return{pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
