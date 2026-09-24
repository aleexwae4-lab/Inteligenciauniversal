import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
const app=read('app.js');
const native=read('lib/native-brain-v5.js');

test('v121: both UI profiles wire the visible Workspace and settings control',()=>{
  for(const file of ['index.html','ui/enterprise/index.html']){
    const html=read(file);
    assert.match(html,/id="profileBtn"[^>]+aria-label="Abrir configuración"/);
    assert.match(html,/id="workspaceBtn"[^>]+aria-label="Abrir Workspace: documento y Canvas HTML"/);
    assert.match(html,/class="workspace-btn-label">Workspace/);
    assert.match(html,/id="coreStatusLabel"/);
    assert.match(html,/id="memoryStatus"/);
    assert.doesNotMatch(html,/18% utilizada|4 capacidades activas|Universal Core · online/);
  }
  assert.match(app,/\$\('#profileBtn'\)\?\.addEventListener\('click',openSettings\)/);
});

test('v121: generator does not disguise a failed answer as successful assistant content',()=>{
  assert.match(app,/d\.success===false/);
  assert.match(app,/d\.recoverable===true/);
  assert.match(app,/d\.answer_assurance\?\.finalSafeFallback===true/);
  assert.match(app,/throw e/);
  assert.match(app,/showTurnFailure\(m,error\)/);
  assert.match(app,/retryText:message/);
  assert.doesNotMatch(app,/return '\*\*Reconectando el núcleo de inteligencia/);
});

test('v121: real elapsed-time progress, status and availability-aware menu',()=>{
  assert.match(app,/Date\.now\(\)-started\)\/1000/);
  assert.match(app,/function hideTyping\(\)\{if\(typingTimer\)/);
  assert.match(app,/generativeReady===true/);
  assert.match(app,/health\.memory\?\.configured/);
  assert.doesNotMatch(app,/módulo preparado/);
});

test('v121: native quality comparison requires an actual research candidate',()=>{
  assert.match(native,/const betterThanResearch=!!researchCandidate/);
  assert.match(native,/if\(acceptableQuality\(repaired\.quality,\{intent,message\}\)\|\|betterThanResearch\)/);
  assert.doesNotMatch(native,/repaired\.quality\.score>=\(researchCandidate\?\.quality\?\.score\|\|0\)/);
  assert.match(native,/reason:'deadline_budget'/);
  assert.match(native,/\),repairBudget,'NATIVE_QUALITY_REPAIR'\)/);
});
