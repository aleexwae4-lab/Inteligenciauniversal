import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractVisibleVisualReply} from '../lib/visual-final.js';
import {forwardVisual} from '../lib/vision-gateway.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const SID='73a6cf13-a11e-4b62-b940-dc11984de895',SECRET='x'.repeat(40);
const image='data:image/jpeg;base64,'+Buffer.from('pixel-test').toString('base64');
const body={session_id:SID,session_secret:SECRET,kind:'image',question:'¿Qué ves?',frames:[{dataUrl:image}]};

test('visual final boundary removes a complete thinking block but rejects leaked or incomplete scratchpad',()=>{
 assert.equal(extractVisibleVisualReply('<thought>Color rojo y azul, esta es mi cadena interna</thought>\n<final>Una mitad roja y otra azul.</final>'),'Una mitad roja y otra azul.');
 assert.equal(extractVisibleVisualReply('<thought>Rojo y azul pero sin cierre'),'');
 assert.equal(extractVisibleVisualReply('<analysis>Rojo y azul'),'');
 assert.equal(extractVisibleVisualReply('<thought>Rojo y azul</thought>'),'');
 assert.equal(extractVisibleVisualReply('No recibí ninguna imagen'),'');
 assert.equal(extractVisibleVisualReply('A la izquierda rojo; a la derecha azul.'),'A la izquierda rojo; a la derecha azul.');
});

test('gateway fails closed on ungrounded success or thinking-only response',async()=>{
 const run=payload=>forwardVisual(body,{},async()=>({ok:true,status:200,json:async()=>payload}));
 await assert.rejects(run({success:true,reply:'Un coche',grounded:false,pixel_transport:'inline_data_uri'}),{code:'visual_gateway_ungrounded'});
 await assert.rejects(run({success:true,reply:'<thought>Zapatos negros',grounded:true,pixel_transport:'inline_data_uri'}),{code:'visual_gateway_ungrounded'});
 await assert.rejects(run({success:true,reply:'Un coche',grounded:true,pixel_transport:'unknown'}),{code:'visual_gateway_ungrounded'});
 const valid=await run({success:true,reply:'<thought>Un boceto privado</thought><final>Se ve un automóvil.</final>',grounded:true,pixel_transport:'inline_data_uri'});
 assert.equal(valid.reply,'Se ve un automóvil.');
 assert.equal(valid.grounded,true);
});

test('edge release gate runs before trace success and synthetic canary checks visible final only',()=>{
 const edge=read('supabase/functions/wae-ai-stream-render-visual/index.ts'),canary=read('scripts/visual-photo-canary-once.mjs');
 const guard=edge.indexOf('const visible=iuVisibleFinal(reply)'),ok=edge.indexOf("status:'ok'",guard),respond=edge.indexOf('reply:visible',ok);
 assert.ok(guard>0&&ok>guard&&respond>ok);
 assert.match(edge,/if\(!visible\)throw Error\('iu_visual_final_not_grounded'\)/);
 assert.match(edge,/grounded:true,pixel_transport:'inline_data_uri'/);
 assert.match(canary,/extractVisibleVisualReply/);
 assert.match(canary,/synthetic_color_verification_failed/);
});
