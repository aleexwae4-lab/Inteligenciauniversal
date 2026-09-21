import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Premium and Enterprise keep independent HTML and CSS entrypoints', async () => {
  const premium = await read('index.html');
  const enterprise = await read('ui/enterprise/index.html');
  assert.match(premium, /data-wae-ui="premium"/);
  assert.match(enterprise, /data-wae-ui="enterprise"/);
  assert.match(premium, /ui\/premium\/surface\.css\?v=119/);
  assert.match(enterprise, /ui\/enterprise\/surface\.css\?v=119/);
  assert.doesNotMatch(premium, /ui\/enterprise\/surface\.css/);
  assert.doesNotMatch(enterprise, /ui\/premium\/surface\.css/);
  assert.match(premium, /premium-v117\.js/);
  assert.match(enterprise, /premium-v117\.js/);
});

test('Render chooses entrypoint per profile while sharing intelligence handlers', async () => {
  const s = await read('server.js');
  assert.match(s, /process\.env\.WAE_UI_PROFILE/);
  assert.match(s, /const UI_ENTRY = UI_PROFILE === 'premium'/);
  assert.match(s, /decoded === '\/' \|\| decoded === '\/index\.html' \? UI_ENTRY/);
  assert.match(s, /filePath = join\(ROOT, UI_ENTRY\)/);
  assert.match(s, /UI_PROFILE !== 'premium' && isMobileRequest\(req, url\)/);
  assert.match(s, /const handler = apiRoutes\.get\(url\.pathname\)/);
  assert.match(s, /\['\/api\/chat', chatHandler\]/);
});

test('Each edition owns its extension CSS, not the other edition\'s', async () => {
  for (const variant of ['premium', 'enterprise']) {
    const css = await read('ui/' + variant + '/surface.css');
    assert.match(css, new RegExp('data-wae-ui="' + variant + '"'));
    assert.doesNotMatch(css, new RegExp('data-wae-ui="' + (variant === 'premium' ? 'enterprise' : 'premium') + '"'));
  }
});
