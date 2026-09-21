import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('tapping mode card actually selects provider mode and visibly confirms it without opening mobile keyboard',()=>{
 const script=read('app.js');
 const start=script.indexOf('const modeDescriptions='),end=script.indexOf('function resetConversation()',start);
 assert.ok(start>=0&&end>start);
 const section=script.slice(start,end);
 const fields=new Map(),events=[],stored={},cards=['research','code','analysis','design'].map(mode=>({
  dataset:{mode},classes:new Set(),attrs:{},classList:{toggle(){throw Error('set up below')}},
  setAttribute(key,value){this.attrs[key]=value}
 }));
 for(const card of cards)card.classList={toggle(name,enabled){if(enabled)card.classes.add(name);else card.classes.delete(name)}};
 let focusCount=0;
 const pill={classSet:new Set(),attrs:{},classList:{toggle(name,enabled){if(enabled)pill.classSet.add(name);else pill.classSet.delete(name)}},setAttribute(key,value){pill.attrs[key]=value},after(item){fields.set('#waeModeHelp',item)},append(item){fields.set('#waeModeClear',item)}};
 const input={focus(){focusCount++}};
 fields.set('#modePill',pill);fields.set('#messageInput',input);fields.set('#composer',{});
 const fakeDocument={createElement:()=>({attrs:{},setAttribute(key,value){this.attrs[key]=value},addEventListener(key,handler){this['on'+key]=handler}})};
 const state={mode:'general'},modeLabels={general:'General',research:'Investigar',code:'Programar',analysis:'Analizar',design:'Diseñar'};
 const ctx={state,modeLabels,document:fakeDocument,window:{dispatchEvent:e=>events.push(e.detail)},CustomEvent:class{constructor(_name,data){this.detail=data.detail}},localStorage:{setItem:(k,v)=>stored[k]=v},console,$:name=>fields.get(name),$$:()=>cards, Object};
 vm.runInNewContext(section+';setMode("research");',ctx);
 assert.equal(state.mode,'research');
 assert.equal(stored['wae.mode'],'research');
 assert.equal(pill.textContent,'✓ Investigar activo');
 assert.equal(pill.classSet.has('wae-mode-visible'),true);
 assert.match(fields.get('#waeModeHelp').textContent,/fuentes pertinentes/);
 assert.match(input.placeholder,/investigar/);
 assert.equal(cards[0].attrs['aria-pressed'],'true');
 assert.equal(cards[1].attrs['aria-pressed'],'false');
 assert.equal(focusCount,0,'mode click should not pop the Android keyboard');
 assert.equal(fields.get('#waeModeClear').textContent,'×');
 assert.match(fields.get('#waeModeClear').attrs['aria-label'],/Desactivar Investigar/);
 vm.runInNewContext('setMode("code")',ctx);
 assert.equal(state.mode,'code');
 assert.match(fields.get('#waeModeHelp').textContent,/código/);
 assert.equal(cards[1].attrs['aria-pressed'],'true');
 vm.runInNewContext('setMode("general")',ctx);
 assert.equal(fields.get('#waeModeHelp').hidden,true);
 assert.equal(pill.classSet.has('wae-mode-visible'),false);
 assert.equal(events.length,3);
 vm.runInNewContext('setMode("analysis")',ctx);
 fields.get('#waeModeClear').onclick({stopPropagation(){}});
 assert.equal(state.mode,'general');
 assert.equal(stored['wae.mode'],'general');
 assert.equal(focusCount,0);
});

test('every shown composer control has an actual action and legacy fake handlers are gone',()=>{
 const app=read('app.js'),polish=read('polish-v2.js'),voice=read('premium-render-v1.js'),runtime=read('runtime-client.js');
 assert.match(polish,/clip\.addEventListener\('click',\(\)=>window\.WAEModes\?\.select\('research'\)\)/);
 assert.match(polish,/window\.WAEVoice\.stop\(\)/);
 assert.match(polish,/doc\.addEventListener\('click',\(\)=>\$\('#workspaceBtn'\)\?\.click\(\)\)/);
 assert.match(app,/#attachBtn'\)\.addEventListener\('click'/);
 assert.match(runtime,/async function readAttachments\(files\)/);
 assert.match(voice,/window\.WAEVoice=\{stop:/);
 assert.doesNotMatch(app,/toast\('Voz lista'\)/);
 assert.doesNotMatch(polish,/Salida de voz lista para conectar a TTS/);
 assert.doesNotMatch(polish,/clip\.addEventListener\('click',\(\)=>\$\('#fileInput'\)/);
});

test('active mode badge survives the existing mobile polish styling and cache ships corrected controls',()=>{
 const html=read('index.html'),css=read('mode-feedback-v1.css'),sw=read('sw.js');
 assert.match(html,/mode-feedback-v1\.css\?v=1/);
 assert.match(css,/\.v2-mode-hidden/); // checked below separately if selector embeds hidden class
 assert.match(css,/\.wae-mode-visible/);
 assert.match(css,/display:inline-flex!important/);
 assert.match(sw,/wae-universal-render-answer-experience-v35/);
 assert.match(sw,/canvas-render-factory-v1\.js\?v=1/);
 assert.match(sw,/mode-feedback-v1\.css\?v=1/);
 assert.match(html,/premium-render-v1\.js\?v=11/);
});
