import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const voice=fs.readFileSync('voice-client.js','utf8'),html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('premium-v5.css','utf8'),sw=fs.readFileSync('sw.js','utf8');
test('voice has cloud TTS plus audible browser fallback',()=>{assert.match(voice,/wae-natural-voice-v60/);assert.match(voice,/speechSynthesis/);assert.match(voice,/browser-fallback/);assert.match(voice,/pointerdown/);assert.match(voice,/VOICE_ENABLED,'true'/)});
test('premium v5 is loaded and responsive',()=>{assert.match(html,/premium-v5\.css/);assert.match(css,/@media\(max-width:899px\)/);assert.match(css,/v5-has-messages|v2-has-messages/);assert.match(css,/prefers-reduced-motion/)});
test('service worker invalidates stale voice and UI assets',()=>{assert.match(sw,/v14-premium-recovery/);assert.match(sw,/premium-v5\.css/);assert.match(sw,/voice-client\.js/)});
