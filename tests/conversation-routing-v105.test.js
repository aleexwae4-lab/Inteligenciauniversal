import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationRoutingClassV105 } from '../api/capacity-chat-v105.js';

const route=(message,extra={})=>conversationRoutingClassV105({message,mode:'general',provider:'auto',...extra});

test('identity prompts never enter the legacy knowledge stack',()=>{
  assert.equal(route('¿Quién eres?'),'identity');
  assert.equal(route('¿Quién eres tú como inteligencia artificial?'),'identity');
  assert.equal(route('¿Qué eres?'),'identity');
  assert.equal(route('¿Qué es Universal Core?'),'identity');
});

test('greeting plus identity and wellbeing stay conversational',()=>{
  assert.equal(route('Hola, ¿quién eres?'),'conversation');
  assert.equal(route('¿Cómo estás?'),'conversation');
  assert.equal(route('¿Te sientes bien?'),'conversation');
  assert.equal(route('¿Todo bien?'),'conversation');
});

test('capability questions use the modern self-awareness path',()=>{
  assert.equal(route('¿Qué puedes hacer?'),'capabilities');
  assert.equal(route('¿Cuáles son tus capacidades?'),'capabilities');
  assert.equal(route('¿Qué tan inteligente eres?'),'capabilities');
});

test('real factual questions remain on the knowledge/research stack',()=>{
  assert.equal(route('¿Qué es la fotosíntesis?'),'legacy');
  assert.equal(route('¿Quién fue Marie Curie?'),'legacy');
  assert.equal(route('Investiga las novedades de Node.js'),'legacy');
});

test('explicit research, attachments and providers preserve legacy routing',()=>{
  assert.equal(route('¿Quién eres?', {web_enabled:true}),'legacy');
  assert.equal(route('¿Quién eres?', {attachments:[{name:'a.txt',text:'x'}]}),'legacy');
  assert.equal(route('¿Quién eres?', {provider:'gpu_fabric'}),'legacy');
  assert.equal(conversationRoutingClassV105({message:'¿Quién eres?',mode:'research',provider:'auto'}),'legacy');
});
