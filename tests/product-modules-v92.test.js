import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('product modules expose complete project lifecycle and recent navigation',async()=>{
  const source=await read('product-modules-v92.js');
  assert.match(source,/create_project/);
  assert.match(source,/list_projects/);
  assert.match(source,/get_project/);
  assert.match(source,/update_project/);
  assert.match(source,/delete_project/);
  assert.match(source,/restore_project/);
  assert.match(source,/archive_project/);
  assert.match(source,/openRecent/);
  assert.match(source,/iu\.recentProjects/);
});

test('product modules include settings controls for chat behavior and voice',async()=>{
  const source=await read('product-modules-v92.js');
  assert.match(source,/customInstructions/);
  assert.match(source,/projectInstructions/);
  assert.match(source,/webEnabled/);
  assert.match(source,/voiceEnabled/);
  assert.match(source,/voiceRate/);
  assert.match(source,/voicePitch/);
  assert.match(source,/voiceLang/);
  assert.match(source,/speechSynthesis\.getVoices\(\)/);
  assert.match(source,/iu\.settings/);
});

test('product modules implement attachments and dedupe before chat submission',async()=>{
  const source=await read('product-modules-v92.js');
  assert.match(source,/readAttachment/);
  assert.match(source,/dedupeAttachments/);
  assert.match(source,/MAX_ATTACHMENTS/);
  assert.match(source,/MAX_ATTACHMENT_BYTES/);
  assert.match(source,/attachments:dedupeAttachments/);
});

test('product modules support web search toggle and persist user preference',async()=>{
  const source=await read('product-modules-v92.js');
  assert.match(source,/web_enabled/);
  assert.match(source,/webEnabled/);
  assert.match(source,/iu\.settings/);
});

test('product modules are scoped to augment the existing shell instead of replacing it',async()=>{
  const source=await read('product-modules-v92.js');
  assert.match(source,/querySelector\('#messages'\)/);
  assert.match(source,/querySelector\('#composer'\)/);
  assert.match(source,/querySelector\('#messageInput'\)/);
  assert.doesNotMatch(source,/document\.body\.innerHTML\s*=/);
});

test('product CSS styles modules without taking over the existing app shell',async()=>{
  const source=await read('product-modules-v92.css');
  assert.match(source,/\.wae-product-drawer/);
  assert.match(source,/\.wae-project-chip/);
  assert.match(source,/\.wae-settings-grid/);
  assert.doesNotMatch(source,/body\s*\{[^}]*position\s*:\s*fixed/s);
});

test('canonical UI still exposes the original workspace, sidebar and composer',async()=>{
  const source=await read('index.html');
  assert.match(source,/id="sidebar"/);
  assert.match(source,/id="messages"/);
  assert.match(source,/id="composer"/);
  assert.match(source,/id="messageInput"/);
  assert.match(source,/id="workspaceBtn"/);
});

test('runtime client transports product project context without changing canonical chat endpoint',async()=>{
  const source=await read('runtime-client.js');
  assert.match(source,/projectId/);
  assert.match(source,/projectName/);
  assert.match(source,/projectInstructions/);
  assert.match(source,/customInstructions/);
  assert.match(source,/attachments:dedupeAttachments/);
  assert.match(source,/url\.pathname==='\/api\/chat'/);
});

test('voice client exposes configurable language rate and pitch',async()=>{
  const source=await read('voice-client.js');
  assert.match(source,/speechSynthesis\.getVoices\(\)/);
  assert.match(source,/voiceRate/);
  assert.match(source,/voicePitch/);
  assert.match(source,/min="0\.60" max="1\.60"/);
  assert.match(source,/min="0\.50" max="1\.50"/);
  assert.match(source,/localStorage\.getItem\('wae\.autoVoice'\)!=='false'/);
  assert.match(source,/customInstructions/);
  assert.match(source,/projectInstructions/);
  assert.match(source,/attachments:dedupeAttachments/);
  assert.match(source,/url\.pathname==='\/api\/chat'/);
});

test('premium shell loads v92 JS and CSS without replacing the existing interface',async()=>{
  const source=await read('premium-v5.js');
  assert.match(source,/product-modules-v92\.css\?v=92/);
  assert.match(source,/product-modules-v92\.js\?v=92/);
  assert.match(source,/loadGptExperience\(\);loadProductModules\(\);loadFeedbackHistory\(\);observe\(\)/);
});

test('parallel specialist council has a v92 private-context path',async()=>{
  const [handler,council]=await Promise.all([read('api/capacity-chat-v91.js'),read('lib/specialist-council-v92.js')]);
  assert.match(handler,/runSpecialistCouncilV92/);
  assert.match(handler,/parallel-specialist-council-v92-context/);
  assert.match(council,/userContextSystemInstructionV92/);
  assert.match(council,/EVIDENCIA SUMINISTRADA POR EL USUARIO/);
  assert.match(council,/slice\(0,5\)/);
});
