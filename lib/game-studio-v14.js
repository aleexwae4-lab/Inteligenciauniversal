import {
  createNativeGameStudioProject as createV13Project,
  inspectGameStudioProject as inspectV13Project,
  supportsNativeGameStudio,
  WORLD_SCHEMA,
  NPC_SCHEMA,
  COMBAT_SCHEMA,
  STORY_SCHEMA,
  SAVE_SCHEMA,
  LOGIC_SCHEMA,
  ASSET_SCHEMA,
  ANIMATION_SCHEMA,
  CHARACTER_SCHEMA
} from './game-studio-v13.js';

export const GAME_STUDIO_VERSION='wae-game-studio/v14';
export const CAMERA_SCHEMA='wae-camera/v14';
export const VFX_SCHEMA='wae-vfx/v14';
export const AUDIO_SCHEMA='wae-audio/v14';
export const CINEMATIC_SCHEMA='wae-cinematic/v14';
export {
  supportsNativeGameStudio,WORLD_SCHEMA,NPC_SCHEMA,COMBAT_SCHEMA,STORY_SCHEMA,SAVE_SCHEMA,LOGIC_SCHEMA,
  ASSET_SCHEMA,ANIMATION_SCHEMA,CHARACTER_SCHEMA
};

const clone=value=>JSON.parse(JSON.stringify(value));
const byName=files=>new Map((files||[]).map(file=>[file.name,file]));
const replaceOrAdd=(files,name,content)=>{
  const found=files.some(file=>file.name===name);
  return found?files.map(file=>file.name===name?{...file,content}:file):files.concat([{name,content}]);
};

function cameraDefinition(){
  return {schema:CAMERA_SCHEMA,version:14,mode:'third_person',fov:62,near:.05,far:5000,follow:{target:'player',distance:5.8,height:2.4,smoothing:9},modes:['third_person','orbit','cinematic','first_person'],shake:{enabled:true,decay:7,maxAmplitude:.35},presets:[
    {id:'gameplay',fov:62,distance:5.8,height:2.4},
    {id:'cinematic',fov:48,distance:8.5,height:3.1},
    {id:'close',fov:70,distance:3.4,height:1.8}
  ]};
}
function vfxDefinition(){
  return {schema:VFX_SCHEMA,version:14,sourcePolicy:'native-first',emitters:[
    {id:'impact',type:'burst',particles:18,lifetime:.45,gravity:-3},
    {id:'dust',type:'trail',particles:10,lifetime:.7,gravity:-1.5},
    {id:'crystal-glow',type:'orbital',particles:8,lifetime:1.8,gravity:0}
  ],post:{bloom:false,filmGrain:false,vignette:.12,colorGrade:'neutral'}};
}
function audioDefinition(){
  return {schema:AUDIO_SCHEMA,version:14,sourcePolicy:'native-first',bus:{master:1,music:.8,sfx:1,ui:.9},events:[
    {id:'player_jump',type:'synth',wave:'triangle',duration:.16},
    {id:'player_attack',type:'synth',wave:'square',duration:.12},
    {id:'impact',type:'synth',wave:'noise',duration:.09},
    {id:'ui_confirm',type:'synth',wave:'sine',duration:.07}
  ]};
}
function cinematicDefinition(){
  return {schema:CINEMATIC_SCHEMA,version:14,tracks:[
    {id:'intro',duration:4,loop:false,events:[
      {at:0,type:'camera_preset',value:'cinematic'},
      {at:1.2,type:'camera_shake',value:.12},
      {at:2.5,type:'vfx',value:'crystal-glow'}
    ]},
    {id:'combat-hit',duration:1.2,loop:false,events:[
      {at:0,type:'camera_shake',value:.28},
      {at:.02,type:'audio',value:'impact'},
      {at:.04,type:'vfx',value:'impact'}
    ]}
  ]};
}

function presentationMarkup(){
  return '<section id="cinematicStudioPanel" class="cinematic-studio"><div class="cinematic-head"><div><p class="eyebrow">GAME STUDIO V14 · CINEMATIC PRESENTATION</p><h2>Cinematic Camera · VFX · Audio</h2><p>Presentación nativa del juego: cámara, efectos, audio procedural y timelines sin proveedores externos.</p></div><div class="cinematic-actions"><button id="cinematicReset" type="button">Reset cámara</button><button id="cinematicSave" type="button" class="save-character">Guardar presentación</button></div></div><div class="cinematic-grid"><div><span>CAMERA</span><strong id="cinematicCameraMode">THIRD PERSON</strong></div><div><span>FOV</span><strong id="cinematicFov">62°</strong></div><div><span>VFX</span><strong id="cinematicVfxCount">3 emitters</strong></div><div><span>AUDIO</span><strong id="cinematicAudioCount">4 events</strong></div><div><span>CINEMATICS</span><strong id="cinematicTrackCount">2 tracks</strong></div></div></section>';
}
function presentationCss(){
  return `#cinematicStudioPanel{margin:18px 0;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:linear-gradient(135deg,rgba(18,22,34,.96),rgba(10,12,20,.92));box-shadow:0 18px 50px rgba(0,0,0,.24)}#cinematicStudioPanel .cinematic-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.cinematic-actions{display:flex;gap:8px;flex-wrap:wrap}.cinematic-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}.cinematic-grid>div{padding:12px;border-radius:12px;background:rgba(255,255,255,.05)}.cinematic-grid span{display:block;font-size:10px;opacity:.6;letter-spacing:.12em}.cinematic-grid strong{display:block;margin-top:5px}@media(max-width:800px){.cinematic-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cinematic-head{flex-direction:column}}`;
}
function wireV14(js){
  const camera=cameraDefinition(),vfx=vfxDefinition(),audio=audioDefinition(),cinematic=cinematicDefinition();
  const runtime=[
    `const CAMERA=${JSON.stringify(camera)};`,
    `const VFX=${JSON.stringify(vfx)};`,
    `const AUDIO=${JSON.stringify(audio)};`,
    `const CINEMATIC=${JSON.stringify(cinematic)};`,
    "const presentationRuntime={mode:CAMERA.mode,fov:CAMERA.fov,shake:0,track:null};",
    "function applyCameraPreset(id){const p=CAMERA.presets.find(x=>x.id===id)||CAMERA.presets[0];presentationRuntime.mode=id==='cinematic'?'cinematic':'third_person';presentationRuntime.fov=p.fov;const el=editorEl('cinematicCameraMode');if(el)el.textContent=presentationRuntime.mode.toUpperCase();const f=editorEl('cinematicFov');if(f)f.textContent=presentationRuntime.fov+'°';}",
    "function triggerPresentation(id){const track=CINEMATIC.tracks.find(x=>x.id===id);if(!track)return;presentationRuntime.track=id;for(const e of track.events){if(e.type==='camera_preset')applyCameraPreset(e.value);if(e.type==='camera_shake')presentationRuntime.shake=Math.max(presentationRuntime.shake,Number(e.value)||0);if(e.type==='audio')playNativeAudio?.(e.value);if(e.type==='vfx')emitParticles?.(e.value);}}",
    "function savePresentationStudio(){window.parent.postMessage({type:'wae-game-studio-presentation-save',studio:'wae-game-studio/v14',camera:CAMERA,vfx:VFX,audio:AUDIO,cinematic:CINEMATIC},'*')}",
    "function resetPresentationCamera(){applyCameraPreset('gameplay');presentationRuntime.shake=0;presentationRuntime.track=null;}",
    "function renderPresentationStudio(){const a=editorEl('cinematicVfxCount');if(a)a.textContent=VFX.emitters.length+' emitters';const b=editorEl('cinematicAudioCount');if(b)b.textContent=AUDIO.events.length+' events';const c=editorEl('cinematicTrackCount');if(c)c.textContent=CINEMATIC.tracks.length+' tracks';}",
    "editorEl('cinematicReset')?.addEventListener('click',resetPresentationCamera);editorEl('cinematicSave')?.addEventListener('click',savePresentationStudio);renderPresentationStudio();"
  ].join('\n');
  js=runtime+'\n'+js;
  js=js.replace('</section><section class="facts">',presentationMarkup()+'</section><section class="facts">');
  js=js.replace("window.WAEGameStudio={", "window.WAEGameStudio={");
  js=js.replace(/window\.WAEGameStudio=\{version:'wae-game-studio\/v13'[\s\S]*?\};/, "window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,logic:LOGIC,npcs:NPCS,combat:COMBAT,story:STORY,saveConfig:SAVE_CONFIG,assets:ASSETS,animations:ANIMATIONS,character:CHARACTER,camera:CAMERA,vfx:VFX,audio:AUDIO,cinematic:CINEMATIC,state,loadWorldScene,emitLogicEvent,interactNearestNpc,startQuest,completeQuest,startStoryDialogue,saveGame,loadGame,snapshotGame,saveCharacterStudio,triggerPresentation};");
  return js;
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
  const project=createV13Project({request,profile});
  const map=byName(project.files);
  const camera=cameraDefinition(),vfx=vfxDefinition(),audio=audioDefinition(),cinematic=cinematicDefinition();
  let files=project.files.map(file=>({...file}));
  let html=map.get('index.html').content.replace(/GAME STUDIO V13[^<]*/g,'GAME STUDIO V14 · CINEMATIC PRESENTATION');
  html=html.replace('</section><section class="facts">',presentationMarkup()+'</section><section class="facts">');
  let js=wireV14(map.get('main.js').content);
  const manifest=JSON.parse(map.get('wae-product.json').content);
  manifest.studio=GAME_STUDIO_VERSION;
  manifest.camera=CAMERA_SCHEMA;manifest.vfx=VFX_SCHEMA;manifest.audio=AUDIO_SCHEMA;manifest.cinematic=CINEMATIC_SCHEMA;
  manifest.capabilities=Array.from(new Set([...(manifest.capabilities||[]),'cinematic-camera','camera-presets','camera-shake','procedural-vfx','native-audio-events','cinematic-timelines','presentation-pipeline']));
  const readme=map.get('README.md').content.replaceAll('wae-game-studio/v13',GAME_STUDIO_VERSION)+'\n\n## Cinematic Presentation Pipeline v14\nIntegra cámara cinematográfica, VFX procedural, eventos de audio nativo y timelines. No requiere CDN ni proveedor externo.\n';
  const doc='# WAE Game Studio v14 · Cinematic Presentation\n\nCamera → VFX → Audio → Timeline → Presentation → QA.\n';
  files=replaceOrAdd(files,'index.html',html);files=replaceOrAdd(files,'styles.css',map.get('styles.css').content+presentationCss());files=replaceOrAdd(files,'main.js',js);
  files=replaceOrAdd(files,'camera.json',JSON.stringify(camera,null,2));files=replaceOrAdd(files,'vfx.json',JSON.stringify(vfx,null,2));files=replaceOrAdd(files,'audio.json',JSON.stringify(audio,null,2));files=replaceOrAdd(files,'cinematic.json',JSON.stringify(cinematic,null,2));files=replaceOrAdd(files,'wae-product.json',JSON.stringify(manifest,null,2));files=replaceOrAdd(files,'README.md',readme);files=replaceOrAdd(files,'GAME-STUDIO.md',doc);
  return {plan:'Game Studio v14 añade Cinematic Camera, VFX, Audio y Timeline nativos para presentación premium del juego.',files};
}

export function inspectGameStudioProject(files){
  const base=inspectV13Project(files),map=byName(files),js=map.get('main.js')?.content||'',html=map.get('index.html')?.content||'';
  const parse=name=>{try{return JSON.parse(map.get(name)?.content||'')}catch{return null}};
  const camera=parse('camera.json'),vfx=parse('vfx.json'),audio=parse('audio.json'),cinematic=parse('cinematic.json');
  const checks={...base.checks,
    cameraFile:camera?.schema===CAMERA_SCHEMA&&Array.isArray(camera.presets)&&camera.presets.length>=3,
    vfxFile:vfx?.schema===VFX_SCHEMA&&Array.isArray(vfx.emitters)&&vfx.emitters.length>=3,
    audioFile:audio?.schema===AUDIO_SCHEMA&&Array.isArray(audio.events)&&audio.events.length>=4,
    cinematicFile:cinematic?.schema===CINEMATIC_SCHEMA&&Array.isArray(cinematic.tracks)&&cinematic.tracks.length>=2,
    cinematicRuntime:/presentationRuntime|triggerPresentation|resetPresentationCamera/.test(js),
    presentationBuilder:/cinematicStudioPanel|cinematicCameraMode/.test(html+js),
    presentationPersistence:/wae-game-studio-presentation-save/.test(js),
    nativePresentation:/const CAMERA=|const VFX=|const AUDIO=|const CINEMATIC=/.test(js),
    presentationManifest:/cinematic-camera|procedural-vfx|native-audio-events|cinematic-timelines/.test(JSON.stringify(parse('wae-product.json')||{}))
  };
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
  return {pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
