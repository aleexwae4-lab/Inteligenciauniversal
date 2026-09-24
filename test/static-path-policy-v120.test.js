import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { staticPathPolicy } from '../lib/static-path-policy-v120.js';

const ui = 'ui/enterprise/index.html';

test('keeps both UI entry profiles and public assets available', () => {
  assert.deepEqual(staticPathPolicy('/', ui), { allowed: true, path: ui, isAsset: true });
  assert.deepEqual(staticPathPolicy('/index.html', ui), { allowed: true, path: ui, isAsset: true });
  assert.deepEqual(staticPathPolicy('/', 'index.html'),
    { allowed: true, path: 'index.html', isAsset: true });
  for (const asset of ['/ui/premium/surface.css', '/assets/logo.svg', '/premium-v117.js', '/manifest.webmanifest']) {
    assert.equal(staticPathPolicy(asset, ui).allowed, true, asset);
  }
  assert.deepEqual(staticPathPolicy('/workspace', ui),
    { allowed: true, path: 'workspace', isAsset: false });
});

test('denies private files and directories even if they are valid JavaScript or JSON', () => {
  for (const path of [
    '/server.js', '/package.json', '/package-lock.json', '/.env',
    '/.git/config', '/lib/providers.js', '/api/chat.js',
    '/backend-v73/app.js', '/supabase/migrations/001_universal_memory.sql',
    '/node_modules/foo/index.js', '/tests/quality.test.js',
    '/test/ui-profile-isolation-v119.test.js', '/docs/internal.html',
    '/secrets.txt', '/premium-v117.js.map',
  ]) {
    assert.equal(staticPathPolicy(path, ui).allowed, false, path);
  }
});

test('rejects malformed and ambiguous URL paths without throwing', () => {
  for (const path of ['/%', '/%E0%A4%A', '/foo%2fbar.js', '/foo%5cbar.js', '/foo\\bar.js']) {
    assert.deepEqual(staticPathPolicy(path, ui), { allowed: false, status: 400 }, path);
  }
  assert.equal(staticPathPolicy('/foo/../server.js', ui).allowed, false);
  assert.equal(staticPathPolicy('/.env%2elocal', ui).allowed, false);
});

test('server routes unknown API endpoints to JSON 404 before static fallback', () => {
  const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(source, /url\.pathname === '\/api' \|\| url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(source, /error: 'api_route_not_found'/);
  assert.match(source, /if \(policy\.isAsset\) return rejectStatic\(req, res\)/);
  assert.match(source, /staticPathPolicy\(pathname, UI_ENTRY\)/);
});
