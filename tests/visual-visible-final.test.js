import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function boundary(){
 const source=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 const start=source.indexOf('function iuVisibleFinal(raw:string){');
 const end=source.indexOf('\nasync function iuVisual(',start);
 assert.ok(start>=0&&end>start,'isolated Universal Core visible boundary must exist');
 const code=source.slice(start,end).replace('raw:string','raw');
 return vm.runInNewContext(code+';iuVisibleFinal',{s:value=>String(value??'')});
}
test('WAE visual strips thought/analysis blocks before returning a visual answer',()=>{
 const visible=boundary();
 assert.equal(visible('<thought>red blue</thought>Se observa rojo a la izquierda y azul a la derecha.'),
  'Se observa rojo a la izquierda y azul a la derecha.');
 assert.equal(visible('<analysis>azul rojo</analysis>Veo una superficie.'),
  'Veo una superficie.');
 assert.equal(visible('<think>red blue</think>'),'');
 assert.equal(visible('<thought>red blue'),'','unterminated hidden content must fail closed');
 assert.equal(visible('Role: internal reasoning'),'');
 assert.equal(visible('No veo imagen adjunta'),'');
});
test('all three visual providers only release a cleaned nonempty final response',()=>{
 const src=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 assert.equal(src.match(/reply=iuVisibleFinal\(reply\);/g)?.length,3);
 assert.match(src,/if\(!reply\)throw Error\('iu_visual_no_visible_final'\)/);
 assert.match(src,/if\(s\(b.action\)==='video_evidence_v131'\)return video/);
 assert.match(src,/\.eq\('secret_hash',await iuHash\(secret\)\)/);
 const canary=read('scripts/visual-photo-canary-once.mjs');
 assert.match(canary,/visual_visible_boundary_failed/);
 assert.match(canary,/synthetic_color_verification_failed/);
});
