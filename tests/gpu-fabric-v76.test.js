import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import capacityChatV76 from '../api/capacity-chat-v76.js';
import {gpuFabricConfigured,gpuFabricLanes,gpuFabricSnapshot,generateWithGpuFabric,__resetGpuFabricForTests,GPU_FABRIC_VERSION} from '../lib/gpu-fabric-v76.js';

const KEYS=['WAE_GPU_FABRIC_ENABLED','WAE_GPU_FABRIC_MAX_ATTEMPTS','WAE_GPU_FABRIC_TIMEOUT_MS','NVIDIA_API_KEY','NVIDIA_MODEL','WAE_NVIDIA_MODEL','GROQ_API_KEY','GROQ_MODEL','WAE_GROQ_MODEL','HF_TOKEN','HUGGINGFACE_API_KEY','HF_MODEL','HUGGINGFACE_MODEL','OPENROUTER_API_KEY','OPENROUTER_MODEL','CEREBRAS_API_BASE','CEREBRAS_API_KEY','CEREBRAS_MODEL','TOGETHER_API_BASE','TOGETHER_API_KEY','TOGETHER_MODEL','FIREWORKS_API_BASE','FIREWORKS_API_KEY','FIREWORKS_MODEL','DEEPINFRA_API_BASE','DEEPINFRA_API_KEY','DEEPINFRA_MODEL','SAMBANOVA_API_BASE','SAMBANOVA_API_KEY','SAMBANOVA_MODEL',...Array.from({length:8},(_,i)=>i+1).flatMap(i=>[`WAE_GPU_LANE_${i}_ID`,`WAE_GPU_LANE_${i}_BASE_URL`,`WAE_GPU_LANE_${i}_API_KEY`,`WAE_GPU_LANE_${i}_MODEL`])];

function isolatedEnv(){
  const saved=new Map(KEYS.map(key=>[key,process.env[key]]));
  for(const key of KEYS)delete process.env[key];
  __resetGpuFabricForTests();
  return()=>{for(const[key,value]of saved){if(value===undefined)delete process.env[key];else process.env[key]=value}__resetGpuFabricForTests()};
}
function custom(index,id='test_lane',model='test/model'){
  process.env[`WAE_GPU_LANE_${index}_ID`]=id;
  process.env[`WAE_GPU_LANE_${index}_BASE_URL`]=`https://${id}.example/v1`;
  process.env[`WAE_GPU_LANE_${index}_API_KEY`]=`secret-${id}`;
  process.env[`WAE_GPU_LANE_${index}_MODEL`]=model;
}

test('v76 reports elastic provider capacity without inventing physical GPU ownership or counts',()=>{
  const restore=isolatedEnv();
  try{custom(1,'alpha');const snapshot=gpuFabricSnapshot();assert.equal(snapshot.version,GPU_FABRIC_VERSION);assert.equal(snapshot.configured,true);assert.equal(snapshot.configuredLanes,1);assert.equal(snapshot.capacityClass,'provider-managed-elastic-gpu-fleets');assert.equal(snapshot.physicalGpuOwnership,false);assert.equal(snapshot.verifiedGpuCount,null);assert.match(snapshot.gpuCountClaimPolicy,/Never claim an exact physical GPU count/i)}finally{restore()}
});

test('public GPU snapshots never expose API keys',()=>{
  const restore=isolatedEnv();
  try{custom(1,'private_lane');const serialized=JSON.stringify(gpuFabricSnapshot());assert.doesNotMatch(serialized,/secret-private_lane/);assert.equal(gpuFabricLanes().length,1)}finally{restore()}
});

test('GPU fabric can be explicitly disabled',()=>{
  const restore=isolatedEnv();
  try{custom(1,'disabled_lane');process.env.WAE_GPU_FABRIC_ENABLED='0';assert.equal(gpuFabricConfigured(),false);assert.equal(gpuFabricSnapshot().enabled,false)}finally{restore()}
});

test('ranked failover moves from a rate-limited lane to the next healthy GPU lane',async()=>{
  const restore=isolatedEnv(),originalFetch=global.fetch;
  try{
    custom(1,'lane_one','model-one');custom(2,'lane_two','model-two');process.env.WAE_GPU_FABRIC_MAX_ATTEMPTS='2';let calls=0;
    global.fetch=async url=>{calls++;if(String(url).includes('lane_one.example'))return new Response(JSON.stringify({error:{message:'rate limited'}}),{status:429,headers:{'content-type':'application/json'}});return new Response(JSON.stringify({id:'ok-2',choices:[{message:{content:'respuesta generativa válida'}}],usage:{total_tokens:12}}),{status:200,headers:{'content-type':'application/json'}})};
    const result=await generateWithGpuFabric({system:'Sistema',message:'Pregunta',history:[]});
    assert.equal(result.provider,'gpu_fabric');assert.equal(result.gpuLane,'lane_two');assert.match(result.model,/lane_two:model-two/);assert.equal(result.text,'respuesta generativa válida');assert.equal(result.failures.length,1);assert.equal(result.failures[0].class,'rate_limit');assert.equal(calls,2);assert.equal(gpuFabricSnapshot().lanes.find(x=>x.id==='lane_one').circuit,'OPEN');
  }finally{global.fetch=originalFetch;restore()}
});

test('v76 remains directly callable while the live chain advances through v87, v86, v84, v83, v81, v77 and v63 control',async()=>{
  assert.equal(typeof capacityChatV76,'function');
  const alias=await readFile(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const plannerWrapper=await readFile(new URL('../api/capacity-chat-v87.js',import.meta.url),'utf8');
  const factualityWrapper=await readFile(new URL('../api/capacity-chat-v86.js',import.meta.url),'utf8');
  const resilienceWrapper=await readFile(new URL('../api/capacity-chat-v84.js',import.meta.url),'utf8');
  const factualWrapper=await readFile(new URL('../api/capacity-chat-v83.js',import.meta.url),'utf8');
  const recoveryWrapper=await readFile(new URL('../api/capacity-chat-v82.js',import.meta.url),'utf8');
  const healthWrapper=await readFile(new URL('../api/capacity-chat-v81.js',import.meta.url),'utf8');
  const legacyWrapper=await readFile(new URL('../api/capacity-chat-v76.js',import.meta.url),'utf8');
  const liveWrapper=await readFile(new URL('../api/capacity-chat-v77.js',import.meta.url),'utf8');
  assert.match(alias,/capacity-chat-v87\.js/);assert.match(plannerWrapper,/capacity-chat-v86\.js/);assert.match(plannerWrapper,/planUniversalIntelligence/);assert.match(factualityWrapper,/capacity-chat-v84\.js/);assert.match(factualityWrapper,/factualityDecision/);assert.match(factualityWrapper,/applyAnswerIntelligence/);assert.match(resilienceWrapper,/capacity-chat-v83\.js/);assert.match(resilienceWrapper,/callIaGratisChat/);assert.match(factualWrapper,/capacity-chat-v81\.js/);assert.match(factualWrapper,/runFocusedFactualAnswer/);assert.match(recoveryWrapper,/capacity-chat-v81\.js/);assert.match(recoveryWrapper,/runKnowledgeAnswer/);assert.match(healthWrapper,/capacity-chat-v77\.js/);assert.match(healthWrapper,/chooseOperationalProvider/);assert.match(healthWrapper,/terminalControlFailure/);assert.match(legacyWrapper,/capacityChatV63/);assert.match(legacyWrapper,/GPU_FABRIC_VERSION/);assert.match(liveWrapper,/capacityChatV63/);assert.match(liveWrapper,/GPU_SCHEDULER_VERSION/);assert.match(liveWrapper,/sensitiveRequest/);assert.match(liveWrapper,/requiresGroundedData/);assert.match(liveWrapper,/originAllowed/);assert.match(liveWrapper,/allowRequest/);assert.match(liveWrapper,/WAE_GPU_ALLOW_ATTACHMENTS/);assert.match(liveWrapper,/WAE_GPU_ALLOW_UNGROUNDED_RESEARCH/);
});