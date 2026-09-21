import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateVisualRequest,visionConfigured,analyzeVisual} from '../lib/vision.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const sample='data:image/jpeg;base64,'+Buffer.from('sample photo payload').toString('base64');

test('validates camera frames, blocks excess media and never interprets text-only attachments as vision',()=>{
 const p=validateVisualRequest({kind:'video',frames:[{dataUrl:sample,timeSec:3}],question:'¿Qué ocurre?'});
 assert.equal(p.kind,'video');
 assert.equal(p.frames[0].timeSec,3);
 assert.equal(p.frames[0].mime_type,'image/jpeg');
 assert.throws(()=>validateVisualRequest({frames:Array(5).fill(sample),question:'Analiza'}),/1 a 4/);
 assert.throws(()=>validateVisualRequest({frames:['data:text/html;base64,PHNjcmlwdD4='],question:'Analiza'}),/compatible/);
 assert.throws(()=>validateVisualRequest({frames:['data:image/jpeg;base64,'+'a'.repeat(360001)],question:'Analiza'}),/grande/);
});

test('visual inference is opt-in and unavailable never makes a provider call',async()=>{
 assert.equal(visionConfigured({GEMINI_API_KEY:'existing-key'}),false);
 assert.equal(visionConfigured({WAE_VISION_ENABLED:'true'}),false);
 assert.equal(visionConfigured({WAE_VISION_ENABLED:'true',GEMINI_API_KEY:'existing-key'}),true);
 let called=0;
 await assert.rejects(analyzeVisual({frames:[sample],question:'Analiza'},{},async()=>{called++;return{}}),{code:'vision_not_configured'});
 assert.equal(called,0);
});

test('enabled visual provider receives real image parts and video is described only as sampled frames',async()=>{
 let payload;
 const fetcher=async(_url,options)=>{
  payload=JSON.parse(options.body);
  assert.ok(options.headers['x-goog-api-key']);
  return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Se observa un objeto en dos fotogramas.'}]}}]})};
 };
 const result=await analyzeVisual({kind:'video',frames:[{dataUrl:sample,timeSec:0},{dataUrl:sample,timeSec:3}],question:'¿Qué se ve?'},{WAE_VISION_ENABLED:'true',GEMINI_API_KEY:'test-key',GEMINI_VISION_MODEL:'test-vision'},fetcher);
 assert.equal(result.analyzedFrames,2);
 assert.equal(result.videoScope,'sampled_frames_only');
 assert.match(payload.contents[0].parts[0].text,/no el audiovisual íntegro/);
 assert.equal(payload.contents[0].parts.filter(p=>p.inline_data).length,2);
});

test('camera controls genuinely connect to pending capture, API route and x mode clearing',()=>{
 const camera=read('camera-v1.js'),app=read('app.js'),server=read('server.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(app,/clear\.textContent='×'/);
 assert.match(app,/setMode\('general'\)/);
 assert.match(app,/window\.WAECamera\.analyze\(message\)/);
 assert.match(camera,/getUserMedia/);
 assert.match(camera,/facingMode:\{ideal:side\}/);
 assert.match(camera,/new MediaRecorder/);
 assert.match(camera,/recordTimer=setTimeout\(stopRecording,MAX_RECORD_MS\)/);
 assert.match(camera,/const MAX_FRAMES=12/);
 assert.match(camera,/WAEVideoScanV2\?\.prepare\(samples\)/);
 assert.match(camera,/WAEVideoScanV2\.prepareFile\(file\)/);
 assert.match(camera,/stopStream\(\);dialog\.close\(\)/);
 assert.match(camera,/WAEVisualRuntime\.analyze/);
 assert.match(server,/\['\/api\/vision', visionHandler\]/);
 assert.match(html,/camera-v1\.js\?v=3/);
 assert.match(sw,/camera-v1\.js\?v=3/);
 assert.match(html,/video-scan-v2\.js\?v=1/);
});

test('WAE local video scan preserves timestamps and never transports the original recording',()=>{
 const scan=read('video-scan-v2.js'),camera=read('camera-v1.js');
 assert.match(scan,/MAX_SAMPLES=12,FRAMES_PER_SHEET=4,MAX_SHEETS=3/);
 assert.match(scan,/function frameDelta/);
 assert.match(scan,/function signature/);
 assert.match(scan,/async function prepareFile\(file\)/);
 assert.match(scan,/URL\.revokeObjectURL\(source\)/);
 assert.match(scan,/audioTranscribed:false/);
 assert.match(scan,/originalUploaded:false/);
 assert.match(camera,/videoScope:kind==='video'\?'sampled_frames_only'/);
 assert.match(camera,/El original y el audio no se envían a la IA/);
 const source=read('lib/vision.js');
 assert.match(source,/Reconstruye el orden visible y los cambios entre tiempos/);
 assert.match(source,/No inventes costos, identidades ni métricas/);
});

test('shared multimodal action requires the IU session and preserves WAE OS video handler',()=>{
 const edge=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 const original=read('supabase/functions/wae-ai-stream-render-visual/BASELINE-v131.ts');
 const client=read('runtime-client.js'),camera=read('camera-v1.js');
 assert.ok(client.includes('functions/v1/wae-ai-stream'));
 assert.ok(client.includes("action:'iu_visual_v1'"));
 assert.ok(client.includes('...sessionPayload(),question,kind,frames,mode'));
 assert.ok(camera.includes('WAEVisualRuntime.analyze'));
 assert.ok(edge.includes(".eq('secret_hash',await iuHash(secret))"));
 assert.ok(edge.includes(".eq('access_tier','FREE')"));
 assert.ok(edge.includes(".eq('kind',IU_TRACE)"));
 assert.ok(edge.includes('origin!==IU_RENDER'));
 assert.ok(edge.includes("if(s(b.action)==='iu_visual_v1')return iuVisual"));
 assert.ok(edge.includes("if(s(b.action)==='video_evidence_v131')return video"));
 assert.ok(original.includes("if(s(b.action)==='video_evidence_v131')return video"));
 assert.ok(!original.includes('iu_visual_v1'));
 assert.ok(edge.includes('raw_media_saved:false'));
 assert.ok(edge.includes("videoScope:kind==='video'?'sampled_frames_only'"));
});
