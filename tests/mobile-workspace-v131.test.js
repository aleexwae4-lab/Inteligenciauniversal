import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../workspace-mobile-v131.css',import.meta.url),'utf8');
test('mobile HTML Canvas opens preview-first with explicit code/preview controls',()=>{
  assert.match(html,/id="panel-html" data-mobile-view="preview"/);
  assert.match(html,/data-html-view="preview"/);assert.match(html,/data-html-view="code"/);
  assert.match(html,/id="refreshHtmlPreview"/);
  assert.match(app,/function setHtmlMobileView\(view='preview'\)/);
  assert.match(app,/if\(tab==='html'\)\{setHtmlMobileView\('preview'\);updatePreview\(\)\}/);
});
test('mobile layout gives preview full usable workspace height instead of side-by-side overflow',()=>{
  assert.match(html,/#panel-html\.active\{display:grid!important;grid-template-rows:auto minmax\(0,1fr\)!important/);
  assert.match(html,/#panel-html\[data-mobile-view="code"\] \.preview-pane\{display:none!important\}/);
  assert.match(html,/#htmlPreview\{display:block!important;flex:1 1 auto!important;height:100%!important/);
  assert.match(css,/@media\(max-width:899px\)/);
  assert.match(html,/workspace-mobile-v131\.css\?v=131/);
});
