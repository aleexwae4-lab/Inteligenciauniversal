import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const mobileSource=readFileSync(new URL('../mobile-voice-v27.js',import.meta.url),'utf8');
const toolbarSource=readFileSync(new URL('../premium-v117.js',import.meta.url),'utf8');

function mobileHarness(){
  const values=new Map([['wae.autoVoice','false']]);
  const localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
  const synth={
    current:null,
    getVoices:()=>[],
    speak(utterance){this.current=utterance;utterance.onstart?.()},
    // Android browsers may never dispatch onend/onerror after cancel().
    cancel(){this.current=null}
  };
  class Utterance{constructor(text){this.text=text}}
  const window={
    fetch:async()=>{throw Error('network_not_expected')},
    speechSynthesis:synth,SpeechSynthesisUtterance:Utterance,
    addEventListener(){},dispatchEvent(){}
  };
  const document={
    documentElement:{dataset:{}},getElementById:()=>null,
    readyState:'loading',addEventListener(){}
  };
  class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail}}
  vm.runInNewContext(mobileSource,{window,document,localStorage,CustomEvent,
    SpeechSynthesisUtterance:Utterance,setTimeout,clearTimeout,URL,Blob});
  return {voice:window.__waeMobileVoice,synth,localStorage};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('manual mobile speech returns a promise that settles only on playback completion',async()=>{
  const {voice,synth}=mobileHarness();
  assert.equal(await voice.speak('Sin activar'),false);
  await voice.setEnabled(true);
  const playback=voice.speak('Hola, WAE');
  assert.equal(typeof playback.then,'function');
  await tick();
  assert.equal(synth.current?.text,'Hola, WAE');
  let finished=false;
  playback.then(()=>{finished=true});
  await tick();
  assert.equal(finished,false,'the UI must keep showing Stop while speaking');
  synth.current.onend();
  assert.equal(await playback,true);
  assert.equal(finished,true);
});

test('mobile stop settles speech even when browser synthesis emits no end event',async()=>{
  const {voice,synth}=mobileHarness();
  await voice.setEnabled(true);
  const playback=voice.speak('Una respuesta extensa');
  await tick();
  assert.ok(synth.current);
  voice.stop();
  assert.equal(await playback,false);
  assert.equal(synth.current,null);
});

test('older cancelled playback cannot reset a newer mobile voice session',async()=>{
  const {voice,synth}=mobileHarness();
  await voice.setEnabled(true);
  const first=voice.speak('Primera respuesta');
  await tick();
  const second=voice.speak('Segunda respuesta');
  await tick();
  assert.equal(await first,false);
  assert.equal(synth.current?.text,'Segunda respuesta');
  synth.current.onend();
  assert.equal(await second,true);
});

test('premium toolbar waits for playback and protects the newest manual voice request',()=>{
  assert.match(toolbarSource,/const operation=\+\+voiceActionVersion/);
  assert.match(toolbarSource,/await playback/);
  assert.match(toolbarSource,/if\(operation!==voiceActionVersion\)return/);
  assert.match(toolbarSource,/temporaryVoiceSession=false/);
  assert.match(toolbarSource,/await voice\.setEnabled\(false\)/);
  assert.match(toolbarSource,/action\('copy'/);
  assert.match(toolbarSource,/action\('workspace'/);
});
