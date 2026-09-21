import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('server exposes an isolated UI profile without forking intelligence routes',()=>{
  const src=fs.readFileSync('server.js','utf8');
  assert.match(src,/WAE_UI_PROFILE/);
  assert.match(src,/X-WAE-UI-Profile/);
  assert.match(src,/applyUiProfile/);
  assert.match(src,/apiRoutes = new Map/);
});

test('premium and enterprise shells have independent CSS ownership',()=>{
  const css=fs.readFileSync('premium-v117.css','utf8');
  assert.match(css,/body\.wae-ui-premium \.chat-heading/);
  assert.match(css,/body\.wae-ui-premium \.capability-grid/);
  assert.match(css,/body\.wae-ui-enterprise \.chat-heading/);
});
