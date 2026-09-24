import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifySelfAwarenessV99, buildSelfAwarenessReplyV99, selfAwarenessCapabilitiesV99, SELF_AWARENESS_V99 } from '../lib/self-awareness-v99.js';
import { planLatencyV90 } from '../lib/latency-governor-v90.js';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('v99 recognizes the exact self-awareness questions observed in the mobile clip',()=>{
  assert.equal(classifySelfAwarenessV99({message:'¿Qué tan inteligente eres?'}).kind,'capability');
  assert.equal(classifySelfAwarenessV99({message:'¿Puedes competir contra GPT Astra?'}).kind,'comparison');
  assert.equal(classifySelfAwarenessV99({message:'Quiero saber si eres competente contra GPT Astra'}).kind,'comparison');
  assert.equal(classifySelfAwarenessV99({message:'¿Puedes competir contra Google, Microsoft, GitHub y Vercel?'}).kind,'comparison');
});

test('v99 answers broad platform competition with benchmark-scoped evidence',()=>{
  const reply=buildSelfAwarenessReplyV99({kind:'comparison',stats:{executiveOrchestration:{executiveRoles:22,activeAgentInstances:6}}});
  assert.match(reply,/Google \/ Microsoft/i);
  assert.match(reply,/GitHub/i);
  assert.match(reply,/Vercel/i);
  assert.match(reply,/GPT \/ Gemini/i);
  assert.match(reply,/64 casos emparejados/i);
  assert.match(reply,/No debo afirmar|CERTIFIED|pruebas medibles/i);
  assert.doesNotMatch(reply,/No puedo competir directamente/i);
  assert.doesNotMatch(reply,/busca un nicho/i);
});

test('v99 capability answer describes measurable system capabilities rather than invented IQ',()=>{
  const reply=buildSelfAwarenessReplyV99({kind:'capability',stats:{}});
  assert.match(reply,/no se resume en un “IQ” inventado/i);
  assert.match(reply,/Investigación actual/i);
  assert.match(reply,/Ingeniería/i);
  assert.match(reply,/Orquestación/i);
  assert.match(reply,/P50\/P95\/P99/);
});

test('v99 frontier model facts route to current evidence and benchmark research routes deep',()=>{
  const current=planLatencyV90({message:'¿Qué sabes sobre GPT-6 Astra y cuál es su versión actual?'},{});
  assert.equal(current.signals.competitor_current,true);
  assert.equal(current.profile,'live_current');
  const deep=planLatencyV90({message:'Investiga y compara el benchmark de GPT-6 Astra con Universal Core'},{});
  assert.equal(deep.signals.competitor_current,true);
  assert.equal(deep.profile,'deep_research');
});

test('v99 is wired before generic chat protocol and exposed in public capabilities',async()=>{
  const chat=await read('api/capacity-chat.js');
  const caps=await read('api/capabilities.js');
  const selfIndex=chat.indexOf('if(await selfAwarenessFastPath(req,res,body))return;');
  const modernIndex=chat.indexOf('if(modernFastPath(req,res,body))return;');
  assert.ok(selfIndex>=0&&modernIndex>selfIndex);
  assert.match(chat,/X-WAE-Self-Awareness/);
  assert.match(chat,/self-awareness-v99/);
  assert.match(caps,/selfAwarenessCapabilitiesV99/);
  assert.match(caps,/selfAwareness:/);
});

test('v99 capability contract preserves strict benchmark-scoped claim discipline',()=>{
  const caps=selfAwarenessCapabilitiesV99();
  assert.equal(caps.version,SELF_AWARENESS_V99);
  assert.equal(caps.exactPremiumReference,'openai:gpt-6-astra');
  assert.equal(caps.requiredVerifiedCases,64);
  assert.equal(caps.falseSuperiorityClaimsBlocked,true);
  assert.equal(caps.benchmarkScopedClaimsOnly,true);
});


test('mobile clip: live browser capability questions resolve via observed web configuration',async()=>{
  assert.equal(classifySelfAwarenessV99({message:'¿Tienes navegador en tiempo real?'}).kind,'web');
  assert.equal(classifySelfAwarenessV99({message:'¿Tienes acceso a internet?'}).kind,'web');
  assert.equal(classifySelfAwarenessV99({message:'Busca los repositorios actuales de GitHub'}).eligible,false);
  const names=['TAVILY_API_KEY','BRAVE_SEARCH_API_KEY','GOOGLE_CUSTOM_SEARCH_API_KEY','GOOGLE_CUSTOM_SEARCH_ENGINE_ID'];
  const before=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  try{
    for(const name of names)delete process.env[name];
    const {toolRegistry}=await import('../lib/tools.js');
    assert.equal(toolRegistry().find(item=>item.id==='web_search')?.configured,true);
    const partial=buildSelfAwarenessReplyV99({kind:'web'});
    assert.match(partial,/no tiene configurado un motor de b[uú]squeda general/i);
    assert.match(partial,/DuckDuckGo/i);
    assert.doesNotMatch(partial,/no dispongo de un navegador/i);
    process.env.BRAVE_SEARCH_API_KEY='web-capability-regression';
    const configured=buildSelfAwarenessReplyV99({kind:'web'});
    assert.match(configured,/motor de b[uú]squeda general est[aá] configurado/i);
    assert.match(configured,/no es un navegador gr[aá]fico/i);
    assert.equal(selfAwarenessCapabilitiesV99().availabilityAware,true);
  }finally{
    for(const name of names){
      if(before[name]===undefined)delete process.env[name];
      else process.env[name]=before[name];
    }
  }
});

test('native-first mobile chat and runtime web tool cannot bypass the capability fix',async()=>{
  const native=await read('lib/native-brain-v5.js');
  const runtime=await read('lib/runtime.js');
  assert.match(native,/webAwareness\.eligible&&webAwareness\.kind==='web'/);
  assert.ok(native.indexOf('webAwareness.eligible')<native.indexOf('const mission=planNativeMission'));
  assert.match(runtime,/payload\.web_enabled===true\|\|cognitivePolicy\.autoResearch/);
  assert.match(runtime,/requestedTools:toolsForMission/);
  assert.match(runtime,/cacheEligible=payload\.web_enabled!==true&&!cognitivePolicy\.autoResearch/);
});
