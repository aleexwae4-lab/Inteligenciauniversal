import test from 'node:test';
import assert from 'node:assert/strict';
import { universalRoutingClassV106, inferredUniversalModeV106, hardenedUniversalMessageV106 } from '../api/capacity-chat-v106.js';

const route=(message,extra={})=>universalRoutingClassV106({message,mode:'general',provider:'auto',...extra});
const mode=(message,extra={})=>inferredUniversalModeV106({message,mode:'general',provider:'auto',...extra});

test('general reasoning and stable knowledge use Universal Core runtime',()=>{
  assert.equal(route('¿Qué es la fotosíntesis?'),'universal');
  assert.equal(route('Explícame arquitectura hexagonal con un ejemplo.'),'universal');
  assert.equal(route('Crea una estrategia de producto para un SaaS B2B.'),'universal');
});

test('engineering repair commands are promoted to code mode instead of FAST/general',()=>{
  const prompt='Revisa el router. Repara, endurece y certifica la arquitectura de producción.';
  assert.equal(route(prompt),'universal');
  assert.equal(mode(prompt),'code');
  assert.equal(mode('Repara el runtime y el middleware'),'code');
});

test('analysis commands are promoted to analysis mode and short commands cannot collapse to FAST',()=>{
  assert.equal(mode('Audita la estrategia, riesgos y causa raíz del problema'),'analysis');
  assert.equal(mode('Optimiza este proceso y evalúa los trade-offs'),'analysis');
  const body={message:'Audita estrategia',mode:'general',provider:'auto'};
  assert.equal(inferredUniversalModeV106(body),'analysis');
  assert.match(hardenedUniversalMessageV106(body),/^Analiza con profundidad:/);
});

test('explicit code analysis and design modes stay on the modern Universal Core runtime',()=>{
  assert.equal(universalRoutingClassV106({message:'Refactoriza este módulo',mode:'code',provider:'auto'}),'universal');
  assert.equal(universalRoutingClassV106({message:'Analiza estos trade-offs',mode:'analysis',provider:'auto'}),'universal');
  assert.equal(universalRoutingClassV106({message:'Diseña el flujo de onboarding',mode:'design',provider:'auto'}),'universal');
  assert.equal(universalRoutingClassV106({message:'Investiga el mercado',mode:'research',provider:'auto'}),'legacy');
  assert.equal(universalRoutingClassV106({message:'Dirige el comité ejecutivo',mode:'executive',provider:'auto'}),'legacy');
});

test('current research and explicit evidence stay on verified legacy stack',()=>{
  assert.equal(route('Investiga las novedades actuales de Node.js'),'legacy');
  assert.equal(route('Verifica con fuentes el precio actual de Bitcoin'),'legacy');
  assert.equal(route('¿Qué cambió hoy en la regulación?'),'legacy');
});

test('high-impact advisory requests stay verified',()=>{
  assert.equal(route('Recomienda una dosis médica para este tratamiento'),'legacy');
  assert.equal(route('Analiza el riesgo legal penal y diseña la defensa'),'legacy');
});

test('explicit web, attachments, providers and specialist orchestration preserve legacy capabilities',()=>{
  assert.equal(route('Analiza esto',{web_enabled:true}),'legacy');
  assert.equal(route('Analiza esto',{attachments:[{name:'a.txt',text:'x'}]}),'legacy');
  assert.equal(route('Analiza esto',{provider:'openai'}),'legacy');
  assert.equal(route('Analiza esto',{multiagent:true}),'legacy');
  assert.equal(route('Analiza esto',{specialists:['software_architect']}),'legacy');
});

test('identity and casual conversation stay on modern direct paths',()=>{
  assert.equal(route('¿Quién eres?'),'identity');
  assert.equal(route('Hola'),'conversation');
  assert.equal(route('¿Qué puedes hacer?'),'capabilities');
});
