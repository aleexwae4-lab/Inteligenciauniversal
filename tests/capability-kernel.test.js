import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPABILITY_DOMAINS, CAPABILITY_KERNEL_VERSION, capabilityDomain, capabilityPlan, capabilitySnapshot, classifyCapabilityIntent } from '../lib/capability-kernel.js';

test('capability kernel exposes the complete 38-domain map',()=>{
  const snapshot=capabilitySnapshot();
  assert.equal(snapshot.version,CAPABILITY_KERNEL_VERSION);
  assert.equal(snapshot.domainCount,38);
  assert.equal(CAPABILITY_DOMAINS.length,38);
  assert.ok(snapshot.abilityCount>200);
  assert.equal(snapshot.domains[0].index,1);
  assert.equal(snapshot.domains.at(-1).index,38);
});

test('capability map keeps unavailable infrastructure fail-closed',()=>{
  const snapshot=capabilitySnapshot();
  const python=snapshot.domains.find((domain)=>domain.id==='advanced_data_analysis');
  const computer=snapshot.domains.find((domain)=>domain.id==='computer_use');
  assert.equal(python.status,'planned');
  assert.equal(computer.status,'planned');
  assert.ok(python.missing.includes('python_sandbox'));
  assert.ok(computer.missing.includes('computer_use'));
});

test('intent classification maps mixed missions to relevant capability domains',()=>{
  const matched=classifyCapabilityIntent('Investiga información reciente en la web, analiza un CSV con Python y crea un reporte.');
  const ids=matched.map((item)=>item.id);
  assert.ok(ids.includes('web_search'));
  assert.ok(ids.includes('deep_research'));
  assert.ok(ids.includes('file_analysis'));
  assert.ok(ids.includes('advanced_data_analysis'));
  assert.ok(ids.includes('document_generation'));
});

test('capability plan separates executable and unavailable requirements',()=>{
  const plan=capabilityPlan('Revisa este repositorio de GitHub y luego controla mi computadora.');
  assert.equal(plan.schema,'universal-capability-plan/v1');
  assert.ok(plan.matched.some((item)=>item.id==='software_engineering'));
  assert.ok(plan.matched.some((item)=>item.id==='computer_use'));
  assert.ok(plan.planned.some((item)=>item.id==='computer_use'));
  assert.equal(plan.failClosedOnUnavailableTools,true);
});

test('domains are addressable by id and numeric index',()=>{
  assert.equal(capabilityDomain('voice')?.index,10);
  assert.equal(capabilityDomain('10')?.id,'voice');
  assert.equal(capabilityDomain('999'),null);
});
