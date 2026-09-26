export const UNIVERSAL_MISSION_DIRECTOR_VERSION='universal-mission-director/v1';

const clean=(s='',n=900)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const norm=(s='')=>clean(s,1800).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const has=(q,rx)=>rx.test(q);
const DOMAIN_RULES=[
 ['forensics',/forense|criminalistica|evidencia|laboratorio/],
 ['space',/nasa|spacex|espacio|cohete|orbita|satellite/],
 ['ev-energy',/tesla|vehiculo electrico|bateria|energia/],
 ['research',/universidad|investigacion|paper|cientifico|biblioteca/],
 ['government',/gobierno|ministerio|secretaria|municipio|politica publica/],
 ['legal',/legal|abogado|contrato|demanda|derecho/],
 ['finance',/finanzas|contabilidad|banco|inversion|dinero|economia/],
 ['enterprise',/empresa|negocio|administracion|marketing|operaciones/],
 ['technology-ai',/ia|inteligencia artificial|software|tecnologia|algoritmo/],
 ['systems',/sistema operativo|arquitectura|infraestructura|devops/],
 ['engineering',/ingenieria|mecanica|civil|electrica|quimica/],
 ['hardware',/chip|semiconductor|robotica|procesador/],
 ['aviation',/avion|aviacion|aeronautica/],
 ['maritime-rail',/barco|maritimo|oceano|ferrocarril|tren/],
 ['health-biology',/medicina|salud|biologia|genetica/],
 ['history-politics',/historia|politica|geografia/],
 ['communications',/comunicacion|redaccion|periodismo/],
 ['music-media',/musica|audio|video|cine/],
 ['real-estate',/bienes raices|inmobiliario|propiedad/],
 ['global-systems',/problema mundial|geopolitica|global|crisis/]
];
const PHASES=['scope','research','design','execute','verify','deliver'];
export function buildMissionDirector(message='',orchestration=null){
 const q=norm(message);
 const domains=DOMAIN_RULES.filter(([,rx])=>has(q,rx)).map(([d])=>d).slice(0,8);
 const selected=domains.length?domains:(orchestration?.expertDomains||[]).slice(0,4);
 const complex=q.length>180||selected.length>=2||/construye|desarrolla|crea|implementa|audita|resuelve|administra|dirige|investiga|planifica/.test(q);
 const steps=complex?PHASES.map((phase,i)=>({id:'mission-'+(i+1),phase,status:i===0?'active':'planned',objective:{scope:'definir objetivo, restricciones, alcance y criterios de éxito',research:'reunir evidencia y fuentes pertinentes',design:'convertir requisitos en arquitectura o plan ejecutable',execute:'usar herramientas disponibles y registrar resultados',verify:'comprobar resultados, errores, evidencia y límites',deliver:'entregar resultado, trazabilidad y próximos pasos'}[phase]})):[{id:'mission-1',phase:'deliver',status:'active',objective:'resolver directamente la solicitud'}];
 return {version:UNIVERSAL_MISSION_DIRECTOR_VERSION,mission:{objective:clean(message,1200),complex},domains:selected,phases:steps,roles:['lead','research','engineering','operations','verification','execution'],policy:{phasesArePlanningSignals:true,executionRequiresTools:true,noInventedExecution:true,verificationRequiredForClaims:true,regulatedDomainsNeedReview:true,politicalNeutrality:true}};
}
export function missionDirectorInstruction(plan){
 if(!plan)return '';
 return '\n\nDIRECTOR UNIVERSAL DE MISIONES ('+UNIVERSAL_MISSION_DIRECTOR_VERSION+'):\n'+JSON.stringify(plan)+'\n- Usa las fases para ordenar trabajos complejos; no finjas que una fase fue ejecutada solo porque fue planificada.\n- Investiga antes de afirmar hechos actuales cuando corresponda.\n- Ejecuta solo acciones para las que exista una herramienta o capacidad disponible.\n- Verifica resultados y errores antes de declararlos completados.\n- Conserva evidencia, procedencia, incertidumbre y límites.\n- En dominios regulados, distingue asistencia del ejercicio profesional autorizado.\n';
}
export function publicMissionDirector(plan){
 if(!plan)return null;
 return {version:plan.version,mission:plan.mission,domains:plan.domains,phases:plan.phases,roles:plan.roles,policy:plan.policy};
}
