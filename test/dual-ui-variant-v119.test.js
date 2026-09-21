import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('Premium and Enterprise keep separate HTML entrypoints and UI styles', async () => {
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

test('Render presentation selector cannot change the shared API routes', async () => {
  const server = await read('server.js');
  assert.match(server, /process\.env\.WAE_UI_VARIANT === 'premium' \? 'premium' : 'enterprise'/);
  assert.match(server, /'ui\/enterprise\/index\.html'/);
  assert.match(server, /decoded === '\/' \|\| decoded === '\/index\.html' \? UI_ENTRY/);
  assert.match(server, /filePath = join\(ROOT, UI_ENTRY\)/);
  assert.match(server, /UI_VARIANT === 'enterprise' && isMobileRequest\(req, url\)/);
  assert.match(server, /X-WAE-UI-Variant/);
  assert.match(server, /const handler = apiRoutes\.get\(url\.pathname\)/);
  assert.match(server, /\['\/api\/chat', chatHandler\]/);
});

test('Each edition has a standalone UI surface without importing the other one', async () => {
  for (const variant of ['premium', 'enterprise']) {
    const css = await read('ui/' + variant + '/surface.css');
    assert.match(css, new RegExp('data-wae-ui="' + variant + '"'));
    assert.doesNotMatch(css, new RegExp('data-wae-ui="' + (variant === 'premium' ? 'enterprise' : 'premium') + '"'));
  }
});
