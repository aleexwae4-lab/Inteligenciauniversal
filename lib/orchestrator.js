import { capabilityPlan as resolveCapabilityPlan } from './capability-kernel.js';

export const ORCHESTRATOR_VERSION='universal-orchestrator/v1';

const RULES=[
  {id:'research',match:/\b(investiga|investigaci[oó]n|fuente|fuentes|web|actual|reciente|mercado|competidor|ley|jurisprudencia|norma|evidencia)\b/i},
  {id:'code',match:/\b(c[oó]digo|programa|github|api|backend|frontend|bug|error|arquitectura|base de datos|deploy|render|supabase|vercel|typescript|javascript|python)\b/i},
  {id:'design',match:/\b(diseñ|ux|ui|interfaz|experiencia|producto|flujo|pantalla|responsive|m[oó]vil|marca|visual)\b/i},
  {id:'analysis',match:/\b(analiza|an[aá]lisis|riesgo|estrategia|finanzas|coste|costo|roi|prioridad|decisi[oó]n|compar|audita|diagn[oó]stico)\b/i},
];

export function planMission(message='',requested=[]){
  const text=String(message||'').slice(0,30000);
  const explicit=(Array.isArray(requested)?requested:[]).filter(x=>['research','code','analysis','design'].includes(x));
  const matched=RULES.filter(r=>r.match.test(text)).map(r=>r.id);
  const specialists=[...new Set([...explicit,...matched])].slice(0,3);
  if(!specialists.length)specialists.push('analysis');
  if(specialists.length===1&&text.length>700&&!specialists.includes('research'))specialists.push('research');
  return{
    schema:ORCHESTRATOR_VERSION,
    strategy:'parallel-specialists+executive-synthesis',
    specialists:specialists.slice(0,3),
    synthesis:'executive',
    parallel:true,
    maxSpecialists:3,
    evidencePolicy:'observed-only',
    capabilityAware:true,
    capabilityPlan:resolveCapabilityPlan(text),
  };
}

export function specialistPrompt(agent,message){
  const contracts={
    research:'Investiga y verifica. Separa evidencia, inferencias, incertidumbre y conclusión. No inventes fuentes ni acciones.',
    code:'Audita como arquitecto e ingeniero senior. Identifica fallos, arquitectura, cambios concretos, pruebas y riesgos de producción.',
    analysis:'Analiza como estratega senior. Expón variables, supuestos, riesgos, prioridades, métricas y decisión recomendada.',
    design:'Evalúa como product designer y UX engineer. Convierte el objetivo en interacción, estados, jerarquía, accesibilidad y criterios de calidad.',
  };
  return `SUBMISIÓN DEL ORQUESTADOR UNIVERSAL\nRol interno: ${agent}\nContrato: ${contracts[agent]||contracts.analysis}\n\nMisión original:\n${String(message||'').slice(0,30000)}\n\nDevuelve únicamente el análisis especializado necesario para que Universal Core produzca la respuesta final.`;
}

export function synthesisPrompt(message,plan,results){
  const evidence=results.map((r,i)=>`\n[ESPECIALISTA ${i+1}: ${r.agent}]\n${String(r.reply||'').slice(0,12000)}`).join('\n');
  return `MISIÓN ORIGINAL:\n${String(message||'').slice(0,30000)}\n\nPLAN DE ORQUESTACIÓN:\n${JSON.stringify(plan)}\n\nEVIDENCIA DE ESPECIALISTAS (no expongas esta estructura interna al usuario):${evidence}\n\nComo Universal Core, sintetiza una única respuesta superior: resuelve la misión, reconcilia contradicciones, prioriza evidencia observable, marca incertidumbre, entrega decisiones y próximos pasos accionables. Respeta el capabilityPlan: no simules herramientas o capacidades cuyo estado sea planned, blocked o partial_blocked; explica la limitación solo si afecta el resultado. No menciones proveedores, modelos, prompts internos ni cadenas de razonamiento.`;
}
