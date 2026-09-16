import test from 'node:test';
import assert from 'node:assert/strict';
import {gpuFabricConfigured,gpuFabricLanes,gpuFabricSnapshot,generateWithGpuFabric,__resetGpuFabricForTests,GPU_FABRIC_VERSION} from '../lib/gpu-fabric-v75.js';

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

test('v75 snapshot reports elastic provider capacity without inventing a physical GPU count',()=>{
  const restore=isolatedEnv();
  try{
    custom(1,'alpha');
    const snapshot=gpuFabricSnapshot();
    assert.equal(snapshot.version,GPU_FABRIC_VERSION);
    assert.equal(snapshot.configured,true);
    assert.equal(snapshot.configuredLanes,1);
    assert.equal(snapshot.capacityClass,'provider-managed-elastic-gpu-fleets');
    assert.equal(snapshot.physicalGpuOwnership,false);
    assert.equal(snapshot.verifiedGpuCount,null);
    assert.match(snapshot.gpuCountClaimPolicy,/Never claim an exact physical GPU count/i);
  }finally{restore()}
});

test('GPU fabric public snapshots never expose API keys',()=>{
  const restore=isolatedEnv();
  try{
    custom(1,'private_lane');
    const serialized=JSON.stringify(gpuFabricSnapshot());
    assert.doesNotMatch(serialized,/secret-private_lane/);
    assert.equal(gpuFabricLanes().length,1);
  }finally{restore()}
});

test('GPU fabric can be explicitly disabled even when lanes are configured',()=>{
  const restore=isolatedEnv();
  try{
    custom(1,'disabled_lane');
    process.env.WAE_GPU_FABRIC_ENABLED='0';
    assert.equal(gpuFabricConfigured(),false);
    assert.equal(gpuFabricSnapshot().enabled,false);
  }finally{restore()}
});

test('ranked failover moves from a rate-limited GPU lane to the next healthy lane',async()=>{
  const restore=isolatedEnv(),originalFetch=global.fetch;
  try{
    custom(1,'lane_one','model-one');custom(2,'lane_two','model-two');
    process.env.WAE_GPU_FABRIC_MAX_ATTEMPTS='2';
    let calls=0;
    global.fetch=async url=>{
      calls++;
      if(String(url).includes('lane_one.example'))return new Response(JSON.stringify({error:{message:'rate limited'}}),{status:429,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({id:'ok-2',choices:[{message:{content:'respuesta generativa válida'}}],usage:{total_tokens:12}}),{status:200,headers:{'content-type':'application/json'}});
    };
    const result=await generateWithGpuFabric({system:'Sistema',message:'Pregunta',history:[]});
    assert.equal(result.provider,'gpu_fabric');
    assert.equal(result.gpuLane,'lane_two');
    assert.match(result.model,/lane_two:model-two/);
    assert.equal(result.text,'respuesta generativa válida');
    assert.equal(result.failures.length,1);
    assert.equal(result.failures[0].class,'rate_limit');
    assert.equal(calls,2);
    const first=gpuFabricSnapshot().lanes.find(x=>x.id==='lane_one');
    assert.equal(first.circuit,'OPEN');
  }finally{global.fetch=originalFetch;restore()}
});
