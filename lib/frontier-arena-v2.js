import { executeMission } from './runtime.js';

export const FRONTIER_ARENA_V2='frontier-arena/v2';

export const ARENA_CASES=Object.freeze([
 {id:'reasoning-01',domain:'reasoning',prompt:'Resuelve: si 3x+7=28, ¿cuánto vale x? Responde con el resultado y una comprobación breve.',grade:{type:'contains',values:['7']}},
 {id:'logic-01',domain:'reasoning',prompt:'Todos los A son B. Ningún B es C. ¿Puede un A ser C? Explica brevemente.',grade:{type:'containsAny',values:['no','ningún','ninguna']}},
 {id:'structured-01',domain:'structured',prompt:'Devuelve únicamente JSON válido con exactamente las claves "name" y "count", usando name="WAE" y count=3.',grade:{type:'jsonEquals',expected:{name:'WAE',count:3}}},
 {id:'engineering-01',domain:'engineering',prompt:'Identifica dos riesgos de producción en una API Node.js y da una mitigación concreta para cada uno.',grade:{type:'containsAny',values:['timeout','rate','validación','validation','observabilidad','logging','monitoring']}},
 {id:'evidence-01',domain:'evidence',prompt:'Explica por qué no debe afirmarse que un modelo supera a otro sin resultados reproducibles y comparables.',grade:{type:'containsAny',values:['reproducible','reproducible','comparables','benchmark','evidencia']}},
 {id:'spanish-01',domain:'multilingual',prompt:'Explica en español qué es una función hash y menciona una propiedad importante.',grade:{type:'containsAny',values:['hash','determin','colisión','colision']}},
 {id:'continuity-01',domain:'instruction',prompt:'Responde exactamente con una línea que contenga las palabras UNIVERSAL y CORE.',grade:{type:'containsAny',values:['UNIVERSAL','CORE']}},
 {id:'safety-01',domain:'safety',prompt:'Da tres prácticas defensivas para proteger un servidor web frente a ataques comunes.',grade:{type:'containsAny',values:['parche','actualiz','firewall','rate','autentic','backup','registro','logging']}}
]);

function textOf(r){return String(r?.reply??r?.text??r?.content??'');}
function grade(text,rule){
 const t=text.toLowerCase();
 if(rule.type==='contains')return t.includes(String(rule.values[0]).toLowerCase())?1:0;
 if(rule.type==='containsAny')return rule.values.some(v=>t.includes(String(v).toLowerCase()))?1:0;
 if(rule.type==='jsonEquals'){try{const x=JSON.parse(text);return JSON.stringify(x)===JSON.stringify(rule.expected)?1:0}catch{return 0}}
 return null;
}
export async function runFrontierArenaV2({cases=ARENA_CASES,maxCases=8,missionOptions={}}={}){
 const selected=cases.slice(0,Math.max(1,Math.min(maxCases,16)));
 const results=[];
 for(const c of selected){
  const started=Date.now();
  try{
   const runtime=await executeMission({message:c.prompt},missionOptions);
   const reply=textOf(runtime);
   results.push({id:c.id,domain:c.domain,score:grade(reply,c.grade),latencyMs:Date.now()-started,provider:runtime?.provider??null,model:runtime?.model??null,degraded:runtime?.degraded??false,error:null});
  }catch(error){
   results.push({id:c.id,domain:c.domain,score:null,latencyMs:Date.now()-started,provider:null,model:null,degraded:true,error:'execution_failed'});
  }
 }
 const measured=results.filter(x=>Number.isFinite(x.score));
 const domains=[...new Set(selected.map(x=>x.domain))];
 const byDomain=Object.fromEntries(domains.map(d=>{const r=measured.filter(x=>x.domain===d);return[d,{measured:r.length,total:selected.filter(x=>x.domain===d).length,score:r.length?Number((r.reduce((s,x)=>s+x.score,0)/r.length).toFixed(4)):null}] }));
 return {version:FRONTIER_ARENA_V2,totalCases:selected.length,measuredCases:measured.length,score:measured.length?Number((measured.reduce((s,x)=>s+x.score,0)/measured.length).toFixed(4)):null,byDomain,results,policy:{realRuntimeOnly:true,missingIsNotZero:true,noSyntheticScores:true,noGlobalSuperiorityClaim:true}};
}
