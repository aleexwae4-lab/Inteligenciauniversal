import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCoreSelfQuery,coreSelfResponse} from '../lib/core-self-description.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('18:47 clip: Universal Core answers normal identity questions only as WAE OS Enterprise',()=>{
 for(const q of ['Quién eres?', 'Hola quién eres?', 'Qué eres exactamente?']){
  assert.equal(isCoreSelfQuery(q),true,q);
  const answer=coreSelfResponse({question:q});
  assert.match(answer,/Universal Core/);
  assert.match(answer,/WAE OS Enterprise/);
  assert.ok(answer.length<320);
  assert.doesNotMatch(answer,/proveedor(?:es)?|distintos modelos|modelo base|modelo fundacional|OpenAI|ChatGPT|Gemini|Groq/i);
 }
});
test('direct training provenance is truthful without routing details or unproven own foundation training',()=>{
 const answer=coreSelfResponse({question:'Quién te entrenó?'});
 assert.match(answer,/WAE Production/);
 assert.match(answer,/WAE OS Enterprise/);
 assert.match(answer,/no demuestra/);
 assert.match(answer,/desde cero/);
 assert.doesNotMatch(answer,/distintos proveedores|rutas de modelos/);
});
test('Render main model and browser policy enforce product identity without changing operational diagnostics',()=>{
 const runtime=read('lib/runtime.js');
 const client=read('runtime-client.js');
 const answer=coreSelfResponse({providers:[{id:'wae_edge',configured:true}],tools:[],memory:{configured:false}});
 assert.doesNotMatch(answer,/proveedores configurados|proveedores generativos|rutas de modelos/);
 assert.match(runtime,/IDENTIDAD DE PRODUCTO/);
 assert.match(client,/IDENTIDAD WAE/);
 assert.match(client,/si preguntan directamente/i);
 assert.match(runtime,/procedencia, entrenamiento o privacidad/);
});
test('identity release reaches Android while all factory and workspace assets remain',()=>{
 const html=read('index.html'),sw=read('sw.js');
 assert.match(html,/waewebpublic=v126&recovery=v121&edgefix=v123&semantic=v124&brand=v125/);
 assert.match(sw,/waewebpublic=v126&recovery=v121&edgefix=v123&semantic=v124&brand=v125/);
 assert.match(sw,/brand-v125/);
 for(const asset of ['canvas-render-factory-v1.js','factory-agent-render-v3.js','workspace-premium-v1.js'])assert.ok(html.includes(asset));
});
