import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyUniversalKnowledge, searchUniversalKnowledge, universalKnowledgeCapabilities, UNIVERSAL_KNOWLEDGE_MESH_VERSION } from '../lib/universal-knowledge-mesh-v89.js';
import capacityChatV89, { CAPACITY_CHAT_V89 } from '../api/capacity-chat-v89.js';
import { listKnowledgeSources, getKnowledgeSource } from '../lib/knowledge/source-registry-v1.js';

const json=body=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});

test('v89 declares federated open-world knowledge without claiming omniscience or base-model training',()=>{
  const caps=universalKnowledgeCapabilities();
  assert.equal(caps.version,UNIVERSAL_KNOWLEDGE_MESH_VERSION);
  assert.equal(caps.architecture,'federated-open-world-retrieval');
  assert.equal(caps.omniscience,false);
  assert.equal(caps.baseModelTraining,false);
  assert.equal(caps.policies.verifyBeforeAccept,true);
  assert.equal(caps.policies.unknownAllowed,true);
  assert.ok(caps.sourcePacks.encyclopedic.sources.includes('wikidata'));
  assert.ok(caps.sourcePacks.biomedical.sources.includes('pubmed'));
  assert.ok(caps.sourcePacks.public_data.sources.includes('world_bank'));
  assert.ok(caps.sourcePacks.software.sources.includes('npm_registry'));
});

test('universal classifier routes factual domains and bypasses transformations',()=>{
  const bio=classifyUniversalKnowledge({message:'¿Quién fue Marie Curie y cuándo nació?'});
  assert.equal(bio.eligible,true);assert.ok(bio.packs.includes('encyclopedic'));
  const med=classifyUniversalKnowledge({message:'Investiga evidencia médica sobre hipertensión'});
  assert.equal(med.eligible,true);assert.ok(med.packs.includes('biomedical'));assert.ok(med.packs.includes('scholarly'));
  const econ=classifyUniversalKnowledge({message:'¿Cuál es el PIB actual de México?'});
  assert.ok(econ.packs.includes('public_data'));assert.ok(econ.packs.includes('live'));
  const code=classifyUniversalKnowledge({message:'¿Qué paquete npm sirve para parsear YAML?'});
  assert.ok(code.packs.includes('software'));
  const rewrite=classifyUniversalKnowledge({message:'Corrige la ortografía de este texto: hola mundo'});
  assert.equal(rewrite.eligible,false);assert.equal(rewrite.transform,true);
});

test('v89 registry expands source coverage while keeping rights metadata fail-closed',()=>{
  const sources=listKnowledgeSources();
  assert.equal(sources.length,16);
  assert.equal(getKnowledgeSource('world_bank').trust_score,0.99);
  assert.equal(getKnowledgeSource('world_bank').license.model_training_permission,false);
  assert.equal(getKnowledgeSource('npm_registry').license.ingestion_permission,'metadata_only');
  assert.equal(getKnowledgeSource('pypi').license.model_training_permission,false);
});

test('World Bank public-data pack contributes official observations to universal retrieval',async()=>{
  const fetchImpl=async url=>{
    const parsed=new URL(url);
    if(parsed.hostname==='www.wikidata.org')return json({search:[{id:'Q96',label:'México',description:'country in North America',concepturi:'https://www.wikidata.org/wiki/Q96'}]});
    if(parsed.hostname==='api.worldbank.org'&&parsed.pathname==='/v2/country')return json([{page:1,pages:1},[{id:'MEX',iso2Code:'MX',name:'Mexico',region:{id:'LCN'}}]]);
    if(parsed.hostname==='api.worldbank.org'&&/\/country\/MEX\/indicator\/NY\.GDP\.MKTP\.CD/.test(parsed.pathname))return json([{page:1,pages:1},[{country:{id:'MX',value:'Mexico'},countryiso3code:'MEX',date:'2025',value:1900000000000,unit:'',indicator:{id:'NY.GDP.MKTP.CD',value:'GDP (current US$)'}}]]);
    throw new Error(`unexpected ${parsed.hostname}${parsed.pathname}`);
  };
  const result=await searchUniversalKnowledge('¿Cuál es el PIB de México?',{sources:['wikidata'],fetchImpl,includeGlobalIndex:false,limit:8});
  assert.equal(result.version,UNIVERSAL_KNOWLEDGE_MESH_VERSION);
  assert.ok(result.sources_selected.includes('world_bank'));
  const wb=result.records.find(row=>row.source?.id==='world_bank');
  assert.ok(wb);assert.match(wb.title,/GDP/);assert.match(wb.abstract,/2025/);
  assert.ok(result.citations.some(c=>c.source==='world_bank'));
});

test('software pack searches npm metadata without treating package content as universally licensed',async()=>{
  const fetchImpl=async url=>{
    const parsed=new URL(url);
    if(parsed.hostname==='www.wikidata.org')return json({search:[]});
    if(parsed.hostname==='registry.npmjs.org')return json({objects:[{package:{name:'yaml',version:'2.8.1',description:'YAML parser and serializer',keywords:['yaml','parser'],date:'2026-01-01T00:00:00Z',links:{npm:'https://www.npmjs.com/package/yaml'}},score:{final:0.9}}]});
    throw new Error(`unexpected ${parsed.hostname}${parsed.pathname}`);
  };
  const result=await searchUniversalKnowledge('¿Qué paquete npm sirve para parsear YAML?',{sources:['wikidata'],fetchImpl,includeGlobalIndex:false,limit:8});
  const npm=result.records.find(row=>row.source?.id==='npm_registry');
  assert.ok(npm);assert.equal(npm.raw_metadata.version,'2.8.1');
  assert.match(npm.license.license,/independently licensed/i);
  assert.ok(result.sources_selected.includes('npm_registry'));
});

test('v89 advances the live chain while preserving v88 fusion, v87 planning and v86 factuality',()=>{
  assert.equal(typeof capacityChatV89,'function');assert.equal(CAPACITY_CHAT_V89,'capacity-chat/v89-universal-knowledge-mesh');
  const v60=fs.readFileSync(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const v89=fs.readFileSync(new URL('../api/capacity-chat-v89.js',import.meta.url),'utf8');
  const v88=fs.readFileSync(new URL('../api/capacity-chat-v88.js',import.meta.url),'utf8');
  const fusion=fs.readFileSync(new URL('../lib/knowledge-fusion-v88.js',import.meta.url),'utf8');
  assert.match(v60,/capacity-chat-v89\.js/);
  assert.match(v89,/capacity-chat-v88\.js/);
  assert.match(v89,/universal_knowledge:true/);
  assert.match(v88,/knowledge-fusion-v88/);
  assert.match(fusion,/searchUniversalKnowledge/);
  assert.match(fusion,/factualityDecision/);
});
