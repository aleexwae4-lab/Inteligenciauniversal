import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('premium action layer is loaded after current shell without replacing the interface',()=>{
  const html=read('index.html');
  assert.match(html,/premium-v5\.js\?v=43/);
  assert.match(html,/productivity-v59\.js\?v=59/);
  assert.match(html,/premium-v117\.css\?v=117/);
  assert.match(html,/premium-v117\.js\?v=117/);
  assert.ok(html.indexOf('premium-v117.js?v=117')>html.indexOf('premium-v5.js?v=43'));
});

test('empty chat has no injected fake assistant message and old fake greeting is filtered',()=>{
  const app=read('app.js');
  assert.doesNotMatch(app,/state\.messages=\[\{role:'assistant',text:'\*\*Sistema listo/);
  assert.match(app,/text\.trim\(\)==='\*\*Sistema listo\./);
});

test('every finished assistant answer has working user actions and no synthetic citations',()=>{
  const js=read('premium-v117.js');
  for(const token of ['data-uc117','copyText(responseText(node))','toggleAutoVoice','listen(node,responseText(node))','openWorkspaceFrom(node)','window.__waeVoice||window.__waeMobileVoice','wae:voice-state','MutationObserver']){
    assert.ok(js.includes(token),'missing '+token);
  }
  assert.match(js,/node\.matches\('\.turn\.assistant'\)&&row\.classList\.contains\('actions'\)/);
  assert.doesNotMatch(js,/Fuentes verificadas|fuentes inventadas/);
  assert.doesNotMatch(js,/eval\(|new Function\(/);
});

test('badge and rich table layout remain compact and responsive',()=>{
  const css=read('premium-v117.css');
  const js=read('premium-v117.js');
  assert.match(css,/\.runtime-bar\.uc117-compact/);
  assert.match(css,/max-width:calc\(100vw - 24px\)/);
  assert.match(css,/overflow-x:auto!important/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(js,/Universal Core<\/strong>/);
  assert.doesNotMatch(js,/Supabase Live|>LIVE</);
});

test('new assets ship in service-worker shell update',()=>{
  const sw=read('sw.js');
  assert.match(sw,/wae-universal-v36-premium-actions-v117/);
  assert.match(sw,/'\.\/premium-v117\.css','\.\/premium-v117\.js'/);
});

test('premium action layer parses as valid JavaScript',()=>{
  const file=fileURLToPath(new URL('../premium-v117.js',import.meta.url));
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
