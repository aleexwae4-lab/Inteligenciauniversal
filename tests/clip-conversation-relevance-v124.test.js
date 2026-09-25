import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCoreSelfQuery,coreSelfResponse} from '../lib/core-self-description.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('17:44 clip: operating-system and identity prompts answer about Universal Core, not generic OpenAI model',()=>{
 const os='¿Eres un sistema operativo?';
 assert.equal(isCoreSelfQuery(os),true);
 assert.equal(isCoreSelfQuery('¿Quién te entrenó?'),true);
 const answer=coreSelfResponse({question:os});
 assert.match(answer,/Universal Core/);
 assert.match(answer,/WAE OS Enterprise/);
 assert.match(answer,/Windows, Linux o Android/);
 assert.doesNotMatch(answer,/soy un modelo de lenguaje desarrollado por OpenAI/i);
 const who=coreSelfResponse({question:'Quién eres'});
 assert.ok(who.length<450);
 assert.doesNotMatch(who,/aeronaves|fuente de alimentación|inversiones y finanzas/i);
 const training=coreSelfResponse({question:'Quién te entrenó'});
 assert.match(training,/WAE OS Enterprise/);
 assert.match(training,/WAE OS Enterprise/);\n assert.doesNotMatch(training,/distintos proveedores|OpenAI|Groq|Gemma/i);
});

test('17:44 clip: engineering conversation is interpreted as software capacity, not PC power supply',()=>{
 const runtime=read('lib/runtime.js');
 assert.match(runtime,/softwareDeploymentQuestion=/);
 assert.match(runtime,/mis sistemas/);
 assert.match(runtime,/sin GPU propia/);
 assert.match(runtime,/fuente de alimentación de PC/);
 assert.match(runtime,/deploymentGuidance/);
});

test('local Render identity and Android cache agree on version',()=>{
 const client=read('runtime-client.js');
 const html=read('index.html');
 const sw=read('sw.js');
 assert.match(client,/eres \(\?:un\|el\) sistema operativo/);
 assert.match(client,/quien te entreno/);
 assert.match(html,/waewebpublic=v126&recovery=v121&edgefix=v123&semantic=v124/);
 assert.match(sw,/waewebpublic=v126&recovery=v121&edgefix=v123&semantic=v124/);
 assert.match(sw,/semantic-v124/);
 for(const marker of ['canvas-render-factory-v1.js','factory-agent-render-v3.js','workspace-premium-v1.js'])assert.ok(html.includes(marker));
});

test('18:47 clip: ordinary product identity stays WAE-native and does not expose implementation vendors',()=>{
 const who=coreSelfResponse({question:'Quién eres'});
 assert.match(who,/inteligencia artificial de WAE OS Enterprise/i);
 assert.doesNotMatch(who,/proveedor|modelo base|OpenAI|Groq|Gemma/i);
 const capabilities=coreSelfResponse({providers:[{id:'internal_route',configured:true}],tools:[],memory:{configured:false},question:'Qué puedes hacer'});
 assert.doesNotMatch(capabilities,/proveedores configurados|modelo base|OpenAI|Groq|Gemma/i);
});
