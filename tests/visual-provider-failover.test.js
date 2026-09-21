import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('IU visual engine tries an alternate live-catalog-certified free model on 429 or upstream 5xx',()=>{
 const source=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 assert.match(source,/async function iuSelectFreeVision\(db:any,excluded:string\[\]=\[\]\)/);
 assert.match(source,/!excluded\.includes\(geminiModel\)/);
 assert.match(source,/!excluded\.includes\(id\)/);
 assert.match(source,/for\(let attempt=0;attempt<2;attempt\+\+\)/);
 assert.match(source,/openrouter\|gemini\)_http_/);
 assert.match(source,/iuSelectFreeVision\(db,\[current\.model\]\)/);
 assert.match(source,/if\(replacement\)\{current=replacement/);
 assert.match(source,/if\(!reply\)throw Error\('iu_visual_empty_response'\)/);
 assert.match(source,/if\(pricing\.prompt===undefined\|\|pricing\.completion===undefined\)return false/);
 assert.match(source,/Number\(value\)===0/);
 assert.match(source,/inputs\.includes\('image'\)/);
 assert.match(source,/if\(Number\(usage\.cost\|\|0\)>0\)throw Error\('provider_billing_guard_violation'\)/);
});
test('shared WAE v131 video and Waeosgreen handler are preserved',()=>{
 const source=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 assert.match(source,/if\(s\(b\.action\)==='video_evidence_v131'\)return video/);
 assert.match(source,/return bridge\(req,b,origin,url,service\)/);
 assert.match(source,/\.eq\('secret_hash',await iuHash\(secret\)\)/);
 assert.match(source,/raw_media_saved:false/);
});
