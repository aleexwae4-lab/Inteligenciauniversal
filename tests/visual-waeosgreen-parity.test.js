import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Universal Core uses Waeosgreen-proven Gemma 4 multimodal Developer API with its own session',()=>{
 const source=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 assert.match(source,/provider:'gemini_native'\|'google_gemma'\|'openrouter'/);
 assert.match(source,/\.eq\('provider','google_gemma'\)/);
 assert.match(source,/\.eq\('vision_capable',true\)\.eq\('access_tier','FREE'\)/);
 assert.match(source,/gemma-4-26b-a4b-it/);
 assert.match(source,/generativelanguage\.googleapis\.com\/v1beta\/openai\/chat\/completions/);
 assert.match(source,/authorization:'Bearer '\+key/);
 assert.match(source,/type:'image_url',image_url:\{url:'data:'/);
 assert.match(source,/if\(provider==='google_gemma'\)/);
 assert.match(source,/if\(attempt\)\{const next=await iuSelectFreeVision\(db,\[model\]\)/);
 assert.match(source,/\.eq\('secret_hash',await iuHash\(secret\)\)/);
 assert.doesNotMatch(source,/vertexai\.googleapis\.com/);
 assert.doesNotMatch(source,/https:\/\/waeosgreen\.onrender\.com\/api\/chat\/vision/);
});
test('Waeosgreen video and generic stream remain routed identically',()=>{
 const source=read('supabase/functions/wae-ai-stream-render-visual/index.ts');
 assert.match(source,/if\(s\(b\.action\)==='video_evidence_v131'\)return video/);
 assert.match(source,/return bridge\(req,b,origin,url\)/);
 assert.match(source,/raw_media_saved:false/);
});
