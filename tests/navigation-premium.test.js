import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatProject} from '../lib/preferences.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('projects have separate bounded context and no fabricated data',()=>{
 assert.match(formatProject({instructions:'habla español',knowledge:'vender software'}),/habla español/);
 assert.match(formatProject({instructions:'a'.repeat(9000),knowledge:'b'.repeat(9000)}),/a{3000}/);
 assert.equal(formatProject(null),'');
});
test('conversation and project module is wired to actual app events and remote history',()=>{
 const nav=read('navigation-premium-v1.js'),app=read('app.js'),edge=read('runtime-client.js'),html=read('index.html');
 assert.match(app,/WAENavigation\?\.newConversation/);
 assert.match(app,/wae:messages-changed/);
 assert.match(app,/project:window\.WAENavigation/);
 assert.match(nav,/markRemoteConversation|setRemoteConversations/);
 assert.match(edge,/WAENavigation\.setRemoteConversations/);
 assert.match(html,/navigation-premium-v1\.js\?v=6/);
});
