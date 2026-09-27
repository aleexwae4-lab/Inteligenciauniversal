/**
 * WAE Universal Core — Astra Competitive Contract v1
 * Evidence-first evaluation surface. It never claims superiority without executed evidence.
 */
export const ASTRA_COMPETITIVE_VERSION = 'astra-competitive-v1';
const DIMENSIONS = Object.freeze([
 { id:'reasoning', label:'Razonamiento', weight:0.20 },
 { id:'coding', label:'Ingeniería de software', weight:0.20 },
 { id:'research', label:'Investigación y grounding', weight:0.15 },
 { id:'agentic', label:'Trabajo de largo horizonte', weight:0.20 },
 { id:'multimodal', label:'Multimodalidad', weight:0.10 },
 { id:'verification', label:'Verificación y autocorrección', weight:0.10 },
 { id:'latency', label:'Latencia/eficiencia', weight:0.05 }
]);
const TESTS = Object.freeze([
 { id:'reasoning-01', dimension:'reasoning', title:'Problema compuesto con restricciones', acceptance:['respuesta correcta','restricciones satisfechas','incertidumbre explícita'] },
 { id:'coding-01', dimension:'coding', title:'Implementación + tests + regresión', acceptance:['código ejecutable','tests ejecutados','sin regresiones'] },
 { id:'research-01', dimension:'research', title:'Investigación con fuentes primarias', acceptance:['fuentes verificables','fecha de consulta','hechos separados de inferencias'] },
 { id:'agentic-01', dimension:'agentic', title:'Misión multi-etapa con recuperación', acceptance:['plan','ejecución por etapas','checkpoint','recovery','evidencia final'] },
 { id:'multimodal-01', dimension:'multimodal', title:'Evidencia cruzada texto+imagen+archivo', acceptance:['extracción','correlación','conflictos detectados'] },
 { id:'verification-01', dimension:'verification', title:'Autocrítica adversarial', acceptance:['challenger','criterios','reparación','retest'] },
 { id:'latency-01', dimension:'latency', title:'Ruta rápida sin degradar calidad', acceptance:['p95 medido','timeout controlado','fallback verificable'] }
]);
export function competitiveContract(){
 return {version:ASTRA_COMPETITIVE_VERSION,objective:'Medir Universal Core contra sistemas frontier mediante pruebas reproducibles; no inferir superioridad desde demos.',dimensions:DIMENSIONS,tests:TESTS,scoring:{scale:'0-100 por dimensión',weightedOverall:'sum(score * weight)',gate:'Una afirmación de superioridad requiere ejecución comparable, mismo input, herramientas equivalentes y evidencia persistida.'},requiredEvidence:['run_id','timestamp','input_hash','model_or_runtime','toolchain','raw_output_hash','tests','metrics','failure_modes'],comparisonPolicy:{fair:'same_prompt_same_tools_same_acceptance',noCherryPicking:true,noUnsupportedClaims:true,reportUncertainty:true},endpoints:{run:'/api/benchmark/astra-competitive',capabilities:'/api/capabilities?benchmark=astra-competitive'}};
}
export function scoreCompetitiveRun(results={}){
 const scores={};
 for(const d of DIMENSIONS){const value=Number(results[d.id]);scores[d.id]=Number.isFinite(value)?Math.max(0,Math.min(100,value)):null;}
 const usable=DIMENSIONS.filter(d=>scores[d.id]!==null);
 const weighted=usable.reduce((sum,d)=>sum+scores[d.id]*d.weight,0);
 const weight=usable.reduce((sum,d)=>sum+d.weight,0);
 return {scores,weightedOverall:weight?Number((weighted/weight).toFixed(2)):null,coverage:Number((weight*100).toFixed(1)),complete:usable.length===DIMENSIONS.length};
}
