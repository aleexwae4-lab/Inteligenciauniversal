import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {isCoreSelfQuery,coreSelfResponse} from '../lib/core-self-description.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function browserSelf(){
 const src=read('runtime-client.js');
 const start=src.indexOf('  const selfQuery=value=>');
 const end=src.indexOf('  // Relevant product context',start);
 assert.ok(start>=0&&end>start);
 const ctx={};
 vm.runInNewContext(src.slice(start,end)+'\nthis.selfQuery=selfQuery;',ctx);
 return ctx.selfQuery;
}

test('19:39 clip: follow-up capability question uses verified WAE capability registry instead of generic model filler',()=>{
 const q='Que más sabes hacer ?';
 assert.equal(isCoreSelfQuery(q),true);
 assert.equal(browserSelf()(q),true);
 const answer=coreSelfResponse({question:q,providers:[],tools:[],memory:{configured:false}});
 assert.match(answer,/Software y producto/);
 assert.match(answer,/Legal y profesional/);
 assert.match(answer,/Industria y sistemas/);
 assert.match(answer,/solo debo afirmar que ejecuté una acción externa/i);
 assert.doesNotMatch(answer,/ejecutar tareas repetitivas dentro de WAE OS Enterprise/i);
});

test('19:39 clip: Render fallback never persists its own system prompt as the user message',()=>{
 const src=read('lib/providers.js');
 const start=src.indexOf('async function waeUniversalEdgeResponse');
 const end=src.indexOf('function gatewayConfigured',start);
 const body=src.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(body,/message:String\(message\|\|''\)\.slice\(0,24000\)/);
 assert.match(body,/internal_context:internalContext/);
 assert.doesNotMatch(body,/message:enrichedMessage/);
 assert.doesNotMatch(body,/Instrucciones del runtime \(no son parte de la solicitud del usuario\)/);
});

test('v127 refreshes Android runtime while Canvas, Factory and Workspace remain',()=>{
 const html=read('index.html'),sw=read('sw.js');
 assert.match(html,/identity=v126&capabilities=v127/);
 assert.match(sw,/identity=v126&capabilities=v127/);
 assert.match(sw,/capabilities-v127/);
 for(const asset of ['canvas-render-factory-v1.js','factory-agent-render-v3.js','workspace-premium-v1.js'])assert.ok(html.includes(asset));
});
