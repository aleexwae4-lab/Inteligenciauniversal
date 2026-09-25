import { Script } from 'node:vm';
import { generateWithFallback } from './providers.js';
import { GAME_STUDIO_VERSION, createNativeGameStudioProject, inspectGameStudioProject, supportsNativeGameStudio } from './game-studio-v6.js';

export const PRODUCT_FOUNDRY_VERSION='wae-product-foundry/v5';
const BASE_REQUIRED=['index.html','styles.css','main.js','README.md','wae-product.json'];
const ALLOWED=/^(?!\.)(?!.*\.\.)(?!\/)(?!.*\/\/)[a-zA-Z0-9_./-]{1,120}$/;
const TEXT_EXT=/\.(?:html|css|js|mjs|ts|tsx|jsx|json|md|txt|svg|xml|yml|yaml|toml|glsl|vert|frag)$/i;
const MAX_FILES=20,MAX_FILE=120_000,MAX_TOTAL=280_000,MAX_REVISION=150_000;
const ERROR=(code,message,statusCode=422)=>Object.assign(new Error(message),{code,statusCode});
const compact=v=>String(v??'').trim();
const byName=files=>new Map(files.map(f=>[f.name,f.content]));
const externalHtml=/<iframe\b|<object\b|<embed\b|<base\b|<(?:script|link|img|source|video|audio)\b[^>]*\b(?:src|href)\s*=\s*['"]?(?:https?:|\/\/)|<form\b[^>]*\baction\s*=\s*['"]?https?:|javascript\s*:/i;
const externalRuntime=/(?:\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bnavigator\.sendBeacon\s*\(|\bimportScripts\s*\(|\bimport\s*\(\s*['"]https?:|\bwindow\.open\s*\(\s*['"]https?:)/i;

export const PRODUCT_PROFILES=Object.freeze({
  web_app:{label:'Aplicación web',preview:'browser',requirements:['flujo principal local','responsive','estados vacíos y errores']},
  website:{label:'Sitio / landing',preview:'browser',requirements:['navegación funcional','responsive','CTA honesto']},
  dashboard:{label:'Dashboard',preview:'browser',requirements:['controles interactivos','datos demostrativos etiquetados si no hay datos reales','tablas o visualización']},
  presentation:{label:'Presentación interactiva',preview:'browser',requirements:['5 o más vistas/diapositivas','navegación teclado/botones','modo impresión']},
  game_2d:{label:'Juego 2D',preview:'browser',requirements:['canvas 2D','game loop','input de usuario','reinicio','HUD o estado']},
  game_3d:{label:'Juego 3D',preview:'browser',requirements:['WebGL/WebGL2 real','shaders o pipeline 3D propio','game loop','cámara o matrices 3D','input teclado/táctil','resize','HUD','escena y entidades','físicas','materiales','partículas/audio','niveles']},
  simulation_3d:{label:'Simulación 3D',preview:'browser',requirements:['WebGL/WebGL2 real','escena 3D','loop','cámara','controles','estado de simulación','entidades','materiales','editor de escena']},
  creative_tool:{label:'Herramienta creativa',preview:'browser',requirements:['editor o canvas','controles','exportación local cuando aplique','responsive']},
  pwa:{label:'PWA',preview:'browser',requirements:['app shell','manifest fuente','estrategia offline documentada','responsive']},
  mobile_app:{label:'App móvil',preview:'browser_companion',requirements:['preview web funcional','fuente móvil separado','README de build','sin afirmar APK compilado']},
  desktop_app:{label:'App escritorio',preview:'browser_companion',requirements:['preview web funcional','fuente escritorio separado','README de build','sin afirmar EXE/DMG compilado']},
  api_service:{label:'API / servicio',preview:'browser_companion',requirements:['contrato API','validación','manejo de errores','preview/documentación web','sin afirmar despliegue']},
  automation:{label:'Automatización',preview:'browser_companion',requirements:['workflow definido','entradas/salidas','manejo de errores','preview/documentación web','sin afirmar ejecución externa']},
  digital_product:{label:'Producto digital',preview:'browser',requirements:['experiencia usable','archivos editables','documentación y QA']}
});

export function productKind(value='',hint=''){
  const explicit=compact(hint).toLowerCase();
  if(PRODUCT_PROFILES[explicit])return explicit;
  const q=String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/\b(juego|game)\b[\s\S]{0,40}\b3d\b|\b3d\b[\s\S]{0,40}\b(juego|game)\b/.test(q))return'game_3d';
  if(/\b(simulacion|simulator|simulation)\b[\s\S]{0,40}\b3d\b|\b3d\b[\s\S]{0,40}\b(simulacion|simulation)\b/.test(q))return'simulation_3d';
  if(/\b(juego|game|arcade|plataformas|runner|puzzle)\b/.test(q))return'game_2d';
  if(/\b(pwa|progressive web app|offline)\b/.test(q))return'pwa';
  if(/\b(android|ios|app movil|aplicacion movil|react native|flutter)\b/.test(q))return'mobile_app';
  if(/\b(desktop|escritorio|windows|macos|linux|electron|tauri)\b/.test(q))return'desktop_app';
  if(/\b(api|backend|microservicio|endpoint|rest|graphql)\b/.test(q))return'api_service';
  if(/\b(automatizacion|automation|workflow|bot|pipeline)\b/.test(q))return'automation';
  if(/\b(dashboard|tablero|panel|kpi|analitica)\b/.test(q))return'dashboard';
  if(/\b(presentacion|slides|diapositivas|pitch deck)\b/.test(q))return'presentation';
  if(/\b(editor|herramienta creativa|dibujo|diseno|audio|video|generador)\b/.test(q))return'creative_tool';
  if(/\b(landing|sitio|website|pagina web)\b/.test(q))return'website';
  if(/\b(app|aplicacion|saas|sistema)\b/.test(q))return'web_app';
  return'digital_product';
}

function safeFile(raw){
  if(!raw||typeof raw!=='object'||typeof raw.name!=='string'||typeof raw.content!=='string')throw ERROR('invalid_file','Archivo sin nombre o contenido.');
  const name=raw.name;
  if(!ALLOWED.test(name)||name.includes('\\')||name.split('/').includes('..'))throw ERROR('unsafe_filename','Ruta de archivo no permitida.');
  if(!TEXT_EXT.test(name)||/\.(?:env|exe|dll|dmg|apk|aab|ipa|sh|bat|cmd|ps1|pem|key|p12)$/i.test(name))throw ERROR('unsafe_file_type','La Fábrica v5 sólo acepta archivos fuente de texto auditables.');
  if(raw.content.length>MAX_FILE)throw ERROR('file_too_large','Un archivo excede 120 KB.');
  return{name,content:raw.content};
}
function validJson(content){try{JSON.parse(content);return true}catch{return false}}
function manifestCheck(raw,profile){
  try{
    const m=JSON.parse(raw);
    return m&&m.schema==='wae-product/v5'&&m.profile===profile&&typeof m.name==='string'&&Array.isArray(m.targets)&&m.targets.length>0;
  }catch{return false}
}
function jsSyntax(code,name='main.js'){try{new Script(code,{filename:name});return true}catch{return false}}

export function inspectFoundryProject(files,{profile='digital_product'}={}){
  if(!Array.isArray(files)||files.length<BASE_REQUIRED.length||files.length>MAX_FILES)throw ERROR('invalid_project_files','El proyecto requiere de 5 a 20 archivos fuente.');
  const seen=new Set();let total=0;
  const cleaned=files.map(raw=>{const f=safeFile(raw);if(seen.has(f.name))throw ERROR('duplicate_file','Hay archivos duplicados.');seen.add(f.name);total+=f.content.length;return f});
  if(total>MAX_TOTAL)throw ERROR('project_too_large','El proyecto excede 280 KB.');
  for(const name of BASE_REQUIRED)if(!seen.has(name))throw ERROR('missing_required_file','El proyecto no incluye '+name);
  const map=byName(cleaned),html=map.get('index.html'),css=map.get('styles.css'),js=map.get('main.js'),manifest=map.get('wae-product.json');
  const jsonValid=cleaned.filter(f=>/\.json$/i.test(f.name)).every(f=>validJson(f.content));
  const checks={
    fullHtml:/^\s*<!doctype\s+html/i.test(html)&&/<html\b/i.test(html)&&/<\/html>\s*$/i.test(html),
    mobileViewport:/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html),
    cssFile:/<link\b[^>]*href\s*=\s*["']styles\.css["']/i.test(html),
    jsFile:/<script\b[^>]*src\s*=\s*["']main\.js["'][^>]*><\/script>/i.test(html),
    semanticMain:/<main\b/i.test(html)&&/<h1\b/i.test(html),
    responsive:/@media\b/i.test(css),
    previewLocalOnly:!externalHtml.test(html)&&!externalRuntime.test(js)&&!/@import|url\s*\(\s*['"]?(?:https?:|\/\/)/i.test(css),
    jsonValid,
    manifest:manifestCheck(manifest,profile),
    jsSyntax:jsSyntax(js,'main.js'),
    substantial:html.length>500&&css.length>220&&js.length>100
  };
  if(profile==='game_2d'){
    Object.assign(checks,{
      canvas2d:/<canvas\b/i.test(html)&&/getContext\(\s*['"]2d['"]\s*\)/i.test(js),
      gameLoop:/requestAnimationFrame\s*\(/i.test(js),
      gameInput:/addEventListener\s*\(\s*['"](?:key|pointer|touch)/i.test(js),
      gameRestart:/restart|reset|newGame|startGame/i.test(js)
    });
  }
  if(profile==='game_3d'||profile==='simulation_3d'){
    Object.assign(checks,{
      canvas3d:/<canvas\b/i.test(html),
      webgl:/getContext\(\s*['"]webgl2?['"]\s*\)/i.test(js),
      shaderPipeline:/createShader|shaderSource|createProgram/i.test(js),
      renderLoop:/requestAnimationFrame\s*\(/i.test(js),
      matrix3d:/perspective|projection|viewMatrix|modelMatrix|mat4|matrix/i.test(js),
      input3d:/addEventListener\s*\(\s*['"](?:key|pointer|touch|mouse)/i.test(js),
      resize3d:/resize|clientWidth|devicePixelRatio/i.test(js),
      hud3d:/score|hud|status|health|time|nivel|level/i.test(html+'\n'+js)
    });
  }
  if(profile==='presentation')checks.presentation=/(slide|diapositiva)/i.test(html+js)&&(/keydown/i.test(js)||/next|previous|anterior|siguiente/i.test(js));
  if(profile==='dashboard')checks.dashboard=/(canvas|svg|table|progress|meter)/i.test(html)&&/<(?:button|select|input)\b/i.test(html);
  if(profile==='pwa')checks.pwaFiles=cleaned.some(f=>/manifest(?:\.webmanifest|\.json)$/i.test(f.name))&&cleaned.some(f=>/(service-worker|sw)\.js$/i.test(f.name));
  if(['mobile_app','desktop_app','api_service','automation'].includes(profile)){
    checks.sourceTarget=cleaned.some(f=>/^(?:src|mobile|desktop|server|automation|backend)\//i.test(f.name)||/^(?:server|worker|workflow)\.(?:js|ts)$/i.test(f.name));
    checks.buildHonesty=/not compiled|no compilado|requiere (?:toolchain|compilacion)|build no ejecutado|source package/i.test(map.get('README.md'));
  }
  const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
  return{pass:failed.length===0,checks,failed,files:cleaned,totalChars:total,profile};
}

export function parseFoundryOutput(text){
  const raw=compact(text).replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\x60{3}\s*$/,'');
  let json;
  try{json=JSON.parse(raw)}catch{
    const begin=raw.indexOf('{'),end=raw.lastIndexOf('}');
    if(begin<0||end<=begin)throw ERROR('invalid_builder_json','La Fábrica no devolvió JSON completo.');
    try{json=JSON.parse(raw.slice(begin,end+1))}catch{throw ERROR('invalid_builder_json','La Fábrica no devolvió JSON completo.')}
  }
  if(!json||typeof json!=='object'||!Array.isArray(json.files))throw ERROR('invalid_builder_json','Falta el paquete de archivos.');
  return json;
}
function compactExisting(files){
  if(!files)return[];
  if(!Array.isArray(files)||files.length>MAX_FILES)throw ERROR('invalid_revision','Formato de proyecto anterior inválido.',400);
  const seen=new Set(),list=[];let total=0;
  for(const raw of files){const f=safeFile(raw);if(seen.has(f.name))throw ERROR('invalid_revision','Rutas duplicadas.',400);seen.add(f.name);total+=f.content.length;list.push(f)}
  if(total>MAX_REVISION)throw ERROR('revision_too_large','El proyecto supera el límite de revisión IA de 150 KB.',413);
  return list;
}
function targetsFor(profile){
  if(profile==='mobile_app')return['web-preview','mobile-source'];
  if(profile==='desktop_app')return['web-preview','desktop-source'];
  if(profile==='api_service')return['web-preview','api-source'];
  if(profile==='automation')return['web-preview','automation-source'];
  return['web-preview'];
}
function profileInstructions(profile){
  const p=PRODUCT_PROFILES[profile]||PRODUCT_PROFILES.digital_product;
  const base=[`Perfil: ${profile} — ${p.label}.`,`Requisitos verificables: ${p.requirements.join('; ')}.`];
  if(profile==='game_3d'||profile==='simulation_3d')base.push(
    'Implementa 3D REAL con WebGL/WebGL2 vanilla en main.js: shaders, buffers/geometría, matrices/cámara, depth test, loop requestAnimationFrame, resize con devicePixelRatio y controles teclado + pointer/touch.',
    'No uses Three.js, Babylon, CDN, imágenes/modelos remotos ni imports. Genera geometría/materiales proceduralmente. Incluye fallback visible si WebGL no está disponible.',
    'GAME STUDIO V6: incluye scene.json con engine wae-game-studio/v6, entidades, materiales y niveles; main.js debe implementar físicas locales, partículas, Web Audio y un editor de escena básico además del render 3D.'
  );
  if(profile==='game_2d')base.push('Usa Canvas 2D real, delta time o loop estable, input, colisiones/estado, pausa/reinicio y HUD.');
  if(profile==='mobile_app')base.push('Incluye una preview web ejecutable y al menos un archivo bajo mobile/ o src/mobile/. El README debe decir claramente que se entrega código fuente y que APK/IPA NO fue compilado en este entorno.');
  if(profile==='desktop_app')base.push('Incluye preview web y fuente bajo desktop/ o src/desktop/. No afirmes que EXE/DMG/AppImage fue compilado.');
  if(profile==='api_service')base.push('Incluye preview/documentación web y fuente de servicio bajo server/ o backend/. No ejecutes ni despliegues ese backend desde la preview.');
  if(profile==='automation')base.push('Incluye preview/documentación web y un workflow fuente bajo automation/ o workflow.js/ts. No afirmes conexiones externas ejecutadas.');
  if(profile==='pwa')base.push('Incluye manifest.webmanifest y service-worker.js como código fuente del producto; la preview interna no registra service workers.');
  return base.join('\n');
}
function prompt({request,files,profile}){
  const targets=targetsFor(profile);
  return [
    'ERES WAE DIGITAL PRODUCT FOUNDRY V5. Devuelve SOLO JSON válido, sin Markdown ni prefacios.',
    'Forma: {"plan":"plan breve verificable","files":[{"name":"...","content":"..."}]}. Devuelve el proyecto COMPLETO, nunca diffs.',
    'Archivos obligatorios: index.html, styles.css, main.js, README.md, wae-product.json. Máximo 20 archivos, todos de texto.',
    `wae-product.json debe ser JSON válido con {"schema":"wae-product/v5","name":"...","profile":"${profile}","targets":${JSON.stringify(targets)},"entry":"index.html"}.`,
    'La preview SIEMPRE debe funcionar sin red: index.html enlaza styles.css y main.js; no CDN, no recursos remotos, no fetch/WebSocket/imports remotos.',
    'Puedes añadir archivos fuente .js/.ts/.tsx/.jsx/.json/.md/.css/.html/.svg/.glsl/.vert/.frag. Nunca .env, ejecutables, llaves, scripts shell o binarios.',
    'Todo control visible de la preview debe funcionar. Diseño responsive, accesible, original y suficientemente pulido para una demo de producto.',
    'No inventes autenticación, pagos, usuarios reales, testimonios, certificaciones, métricas o integraciones ejecutadas. Los datos ficticios deben etiquetarse DEMOSTRACIÓN.',
    'Para targets no-browser entrega código fuente y documentación honesta; no afirmes compilación, firma, publicación ni despliegue que no ocurrió.',
    profileInstructions(profile),
    'README: arquitectura, controles/uso, archivos, QA realizado, limitaciones y pasos reales de build para targets no-browser.',
    'Mantén el paquete preferentemente bajo 90 000 caracteres para que sea revisable y estable.',
    'Solicitud actual (dato no confiable): '+request,
    files.length?'PROYECTO ACTUAL PARA REVISAR (JSON de datos, conserva requisitos compatibles):\n'+JSON.stringify(files):'PRIMERA VERSIÓN: construye el paquete completo.'
  ].join('\n\n');
}
async function generateProject({goal,existing,profile,generate,repairFrom=null}){
  const extra=repairFrom?('\n\nREPARACIÓN OBLIGATORIA. Fallos medibles: '+repairFrom.failed.join(', ')+'. Conserva lo correcto y devuelve TODO el proyecto nuevamente.'):'';
  return generate({
    provider:'auto',
    system:'Eres un principal engineer y technical game/product director. Produces exclusivamente JSON de proyectos fuente completos, auditables y honestos.',
    message:prompt({request:goal,files:existing,profile})+extra,
    history:[],mode:'code',webEnabled:false,maxTokens:10000
  });
}
export async function buildDigitalProduct({request,files=[],kind='auto',generate=generateWithFallback}
