import test from 'node:test';
import assert from 'node:assert/strict';
import { getToolDefinition, inspectText, profileCsv, resolveTool, toolFabricSnapshot, validateToolInput, TOOL_FABRIC_VERSION } from '../lib/tool-fabric.js';
import { executeCapability } from '../lib/execution-plane.js';

test('tool fabric is default-deny and exposes immutable contracts',()=>{
  const snapshot=toolFabricSnapshot();
  assert.equal(snapshot.version,TOOL_FABRIC_VERSION);
  assert.equal(snapshot.policy.failClosed,true);
  assert.equal(snapshot.policy.defaultDeny,true);
  assert.equal(snapshot.policy.mutationsEnabled,false);
  assert.equal(snapshot.policy.clientApprovalTrusted,false);
  assert.equal(snapshot.policy.externalProcessingDeclared,true);
  assert.equal(snapshot.policy.perCallBudgetEnforced,true);
  assert.equal(snapshot.toolCount,15);
  assert.equal(snapshot.blockedToolCount,3);
  assert.ok(snapshot.tools.every((tool)=>tool.contractHash.length===64));
});

test('GitHub repository intelligence is registered as read-only evaluation, not execution',()=>{
  const tool=getToolDefinition('github.repository_evaluate');
  assert.ok(tool);
  assert.equal(tool.provider,'github');
  assert.deepEqual(tool.actions,['evaluate_repository']);
  assert.equal(tool.sideEffect,'read');
  assert.equal(tool.riskLevel,'low');
  assert.equal(tool.approval,'none');
  assert.ok(tool.tags.includes('supply-chain'));
  assert.ok(tool.contractHash.length===64);
});

test('ia.gratis extensions declare external processing and bounded token costs',()=>{
  const ids=['ia_gratis.search','ia_gratis.summarize','ia_gratis.translate','ia_gratis.humanize','ia_gratis.detect'];
  for(const id of ids){
    const tool=getToolDefinition(id);
    assert.ok(tool);
    assert.equal(tool.provider,'ia_gratis');
    assert.equal(tool.externalProcessing,true);
    assert.equal(tool.riskLevel,'low');
    assert.equal(tool.approval,'none');
    assert.ok(Number(tool.tokenCost)>0&&Number(tool.tokenCost)<=50);
    assert.ok(tool.contractHash.length===64);
  }
  assert.equal(resolveTool('web_search','ai_search')?.id,'ia_gratis.search');
  assert.equal(resolveTool('conversation_reasoning','summarize')?.id,'ia_gratis.summarize');
  assert.equal(resolveTool('conversation_reasoning','translate')?.id,'ia_gratis.translate');
  assert.equal(resolveTool('conversation_reasoning','humanize')?.id,'ia_gratis.humanize');
  assert.equal(resolveTool('conversation_reasoning','detect_ai_text')?.id,'ia_gratis.detect');
});

test('sensitive tools are discoverable but never enabled',()=>{
  for(const id of ['computer.control','browser.cloud','terminal.exec']){
    const tool=getToolDefinition(id);
    assert.ok(tool);
    assert.equal(tool.provider,'disabled');
    assert.equal(tool.configured,false);
    assert.equal(tool.enabled,false);
    assert.notEqual(tool.approval,'none');
  }
});

test('tool input contracts reject missing and oversized inputs',()=>{
  assert.deepEqual(validateToolInput('text.inspect',{}),{ok:false,error:'tool_input_required',field:'content'});
  assert.deepEqual(validateToolInput('github.repository_evaluate',{}),{ok:false,error:'tool_input_required',field:'repository'});
  assert.deepEqual(validateToolInput('ia_gratis.translate',{}),{ok:false,error:'tool_input_required',field:'text'});
  const oversized='x'.repeat(120001);
  const invalid=validateToolInput('text.inspect',{content:oversized});
  assert.equal(invalid.ok,false);
  assert.equal(invalid.error,'tool_input_too_large');
  assert.equal(invalid.field,'content');
});

test('local text inspection produces deterministic evidence without host execution',()=>{
  const result=inspectText({name:'sample.txt',content:'uno dos\ntres'});
  assert.equal(result.name,'sample.txt');
  assert.equal(result.characters,12);
  assert.equal(result.lines,2);
  assert.equal(result.words,3);
  assert.equal(result.sha256.length,64);
  assert.equal(result.preview,'uno dos\ntres');
});

test('local CSV profiler handles quoted cells and null counts',()=>{
  const result=profileCsv({content:'name,city,score\n"Wae, Alex",Zapopan,10\nAna,,9'});
  assert.equal(result.rows,2);
  assert.equal(result.columns,3);
  assert.deepEqual(result.headers,['name','city','score']);
  assert.equal(result.sample[0].name,'Wae, Alex');
  assert.equal(result.nullCounts.city,1);
});

test('file and data capability routing selects only explicit safe local primitives',()=>{
  assert.equal(resolveTool('file_analysis','inspect_text')?.id,'text.inspect');
  assert.equal(resolveTool('advanced_data_analysis','profile_csv')?.id,'data.csv_profile');
  assert.equal(resolveTool('software_engineering','evaluate_repository')?.id,'github.repository_evaluate');
  assert.equal(resolveTool('computer_use','click')?.enabled,false);
});

test('execution plane can execute local text inspection and returns cryptographic tool identity',async()=>{
  const result=await executeCapability({
    capability:'file_analysis',
    action:'inspect_text',
    task:'Inspecta el contenido entregado',
    input:{name:'notes.txt',content:'Universal Core v38'},
    userKey:'u-local',
    sessionId:'s-local',
    persistReceipt:async()=>({persisted:false,reason:'test'}),
  });
  assert.equal(result.success,true);
  assert.equal(result.tool.id,'text.inspect');
  assert.equal(result.tool.contractHash.length,64);
  assert.equal(result.result.words,3);
  assert.equal(result.receipt.side_effect,'none');
});

test('execution plane blocks local file analysis when content is missing',async()=>{
  const result=await executeCapability({
    capability:'file_analysis',
    action:'inspect_text',
    task:'Analiza el archivo',
    input:{},
    persistReceipt:async()=>({persisted:false,reason:'test'}),
  });
  assert.equal(result.success,false);
  assert.equal(result.status,'blocked');
  assert.equal(result.error,'tool_input_required');
});
