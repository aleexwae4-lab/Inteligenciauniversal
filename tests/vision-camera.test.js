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
 assert.match(payload.contents[0].parts[0].text,/No afirmes haber visto todos los fotogramas/);
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
 assert.match(camera,/stopStream\(\);dialog\.close\(\)/);
 assert.match(camera,/fetch\('\/api\/vision'/);
 assert.match(server,/\['\/api\/vision', visionHandler\]/);
 assert.match(html,/camera-v1\.js\?v=1/);
 assert.match(sw,/camera-v1\.js\?v=1/);
});
