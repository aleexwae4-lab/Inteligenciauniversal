export const WORLD_INTELLIGENCE_VERSION='universal-world-intelligence/v117';

const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const matches=(text,patterns)=>patterns.some(pattern=>new RegExp('(?:^|\\s)(?:'+pattern+')(?:\\s|$)','i').test(text));

// These packs select a problem-solving method, NOT a claim to possess world data,
// professional licences, instruments or authority over external institutions.
const DOMAINS=Object.freeze([
  {id:'public_health',name:'Salud pública y sistemas sanitarios',terms:['salud publica','pandemia(?:s)?','epidemia(?:s)?','sistema(?:s)? de salud','atencion sanitaria','mortalidad','vacunacion'],roles:['public_health','health_systems','ethics_safety'],outcomes:['acceso a servicios','resultados sanitarios','seguridad del paciente'],critical:true},
  {id:'climate',name:'Clima y adaptación ambiental',terms:['cambio climatico','crisis climatica','calentamiento global','emisiones? de carbono','descarbonizacion','adaptacion climatica','climate change'],roles:['climate_systems','energy_transition','data_evidence'],outcomes:['exposición al riesgo climático','emisiones medidas','resiliencia'],critical:true},
  {id:'water',name:'Agua, saneamiento y cuencas',terms:['agua potable','escasez de agua','crisis hidrica','saneamiento','aguas residuales','cuenca(?:s)?','acceso al agua','water security'],roles:['water_engineering','public_health','infrastructure'],outcomes:['continuidad del suministro','calidad verificada del agua','cobertura de saneamiento'],critical:true},
  {id:'food',name:'Alimentación y sistemas agroalimentarios',terms:['hambre mundial','hambre','hambruna(?:s)?','seguridad alimentaria','desnutricion','sistema(?:s)? alimentario(?:s)?','agricultura sostenible','food security'],roles:['food_systems','supply_chain','public_health'],outcomes:['acceso alimentario','continuidad de abastecimiento','calidad nutricional'],critical:true},
  {id:'energy',name:'Energía, electricidad y transición',terms:['crisis energetica','acceso a la energia','energia limpia','transicion energetica','red(?:es)? electrica(?:s)?','corte(?:s)? de luz','electrificacion','energy poverty'],roles:['energy_transition','infrastructure','economic_systems'],outcomes:['acceso a energía','continuidad y confiabilidad','costo para usuarios'],critical:true},
  {id:'education',name:'Educación y capacidades humanas',terms:['crisis educativa','acceso a la educacion','analfabetismo','brecha educativa','abandono escolar','aprendizaje global','educacion mundial','education access'],roles:['education_systems','social_design','data_evidence'],outcomes:['acceso','aprendizaje medido','retención'],critical:false},
  {id:'poverty',name:'Pobreza, empleo y desigualdad',terms:['pobreza','desigualdad','empleo mundial','desempleo','exclusion social','brecha economica','desarrollo humano','inclusion financiera'],roles:['economic_systems','social_design','ethics_safety'],outcomes:['ingreso real','acceso a servicios','movilidad económica'],critical:true},
  {id:'housing',name:'Vivienda, ciudades e infraestructura',terms:['crisis de vivienda','deficit de vivienda','asentamiento(?:s)? informal(?:es)?','infraestructura mundial','urbanizacion','ciudad(?:es)? sostenible(?:s)?','movilidad urbana','vivienda asequible'],roles:['infrastructure','water_engineering','social_design'],outcomes:['cobertura de servicios','seguridad estructural','costo y accesibilidad'],critical:true},
  {id:'cybersecurity',name:'Seguridad digital y continuidad',terms:['ciberseguridad mundial','ciberataque(?:s)?','ransomware','infraestructura digital critica','seguridad digital global','cibercrimen','brecha de datos','ataques informaticos'],roles:['cyber_resilience','data_evidence','ethics_safety'],outcomes:['resiliencia','incidentes verificados','tiempo de recuperación'],critical:true},
  {id:'disasters',name:'Desastres y respuesta humanitaria',terms:['desastre(?:s)? natural(?:es)?','terremoto(?:s)?','inundacion(?:es)?','emergencia(?:s)? humanitaria(?:s)?','crisis humanitaria','respuesta a desastre(?:s)?','incendio(?:s)? forestal(?:es)?'],roles:['disaster_response','infrastructure','public_health'],outcomes:['personas protegidas','acceso a servicios esenciales','tiempos de respuesta'],critical:true},
  {id:'science',name:'Investigación científica y descubrimientos',terms:['reto(?:s)? cientifico(?:s)?','investigacion mundial','descubrimiento cientifico','avance(?:s)? cientifico(?:s)?','laboratorio(?:s)? global(?:es)?','ciencia abierta','brecha de investigacion'],roles:['research_methodology','data_evidence','ethics_safety'],outcomes:['replicabilidad','evidencia de validación','adopción evaluada'],critical:false},
  {id:'supply_chain',name:'Cadena de suministro y logística global',terms:['cadena(?:s)? de suministro','logistica global','abastecimiento mundial','escasez de insumos','comercio mundial','supply chain','puerto(?:s)? mundial(?:es)?','desabasto'],roles:['supply_chain','economic_systems','infrastructure'],outcomes:['disponibilidad','tiempo de reposición','continuidad operativa'],critical:false},
  {id:'biodiversity',name:'Biodiversidad y ecosistemas',terms:['biodiversidad','deforestacion','extincion de especies','ecosistema(?:s)? amenazado(?:s)?','perdida de habitat','contaminacion oceanica','restauracion ecologica'],roles:['climate_systems','water_engineering','data_evidence'],outcomes:['estado del hábitat','especies monitoreadas','presiones ambientales'],critical:true},
  {id:'displacement',name:'Migración y desplazamiento humano',terms:['desplazamiento forzado','refugiado(?:s)?','migracion mundial','crisis migratoria','desplazado(?:s)?','movilidad humana global'],roles:['social_design','disaster_response','ethics_safety'],outcomes:['protección','acceso a servicios','seguridad y dignidad'],critical:true}
]);

const ROLES=Object.freeze({
  public_health:'Epidemiología y salud poblacional: indicadores denominados, comparabilidad y validación por profesionales.',
  health_systems:'Servicios clínicos y gestión sanitaria: acceso, capacidad, calidad y seguridad sin tratamiento individual inventado.',
  ethics_safety:'Ética y protección: consentimiento, privacidad, derechos, equidad, seguridad y revisión humana.',
  climate_systems:'Modelos climáticos y ambientales: hipótesis, medidas, adaptación y límites de inferencia.',
  energy_transition:'Sistemas energéticos: suministro, eficiencia, confiabilidad, accesibilidad y viabilidad.',
  data_evidence:'Evidencia y métodos: procedencia, fecha, población, sesgos, triangulación y reproducibilidad.',
  water_engineering:'Agua y saneamiento: cobertura, calidad comprobada, infraestructura y operación segura.',
  infrastructure:'Ingeniería e infraestructura: requisitos, dependencias, mantenimiento, riesgos y criterios de recepción.',
  food_systems:'Sistemas de alimentos: producción, acceso, nutrición, pérdidas y resistencia del abastecimiento.',
  supply_chain:'Logística: abastecimiento, inventarios críticos, dependencias y recuperación de suministro.',
  education_systems:'Educación: acceso, aprendizaje medido, formación, retención y adecuación local.',
  social_design:'Diseño social participativo: necesidades expresadas por población, acceso y evaluación distributiva.',
  economic_systems:'Economía aplicada: costos, incentivos, financiación, efectos secundarios y sensibilidad.',
  cyber_resilience:'Ciberresiliencia defensiva: detección, contención, continuidad y recuperación autorizadas.',
  disaster_response:'Respuesta a emergencias: prioridades humanitarias, seguridad, coordinación y validación local.',
  research_methodology:'Investigación: pregunta falsable, metodología, ensayos éticos y replicabilidad.'
});

const PHASES=Object.freeze([
  {id:'define',deliverable:'Problema acotado, población, territorio, horizonte y criterios de éxito'},
  {id:'baseline',deliverable:'Línea base con fuente, fecha, unidades, incertidumbre y lagunas'},
  {id:'systems_map',deliverable:'Causas, bucles de retroalimentación, dependencias y actores'},
  {id:'options',deliverable:'Opciones con mecanismo causal, costo, restricciones y efectos adversos'},
  {id:'pilot',deliverable:'Piloto acotado con responsables, controles, criterios de suspensión y consentimiento'},
  {id:'scale',deliverable:'Condiciones de replicación, financiación, capacidad local y escalado gradual'},
  {id:'verify',deliverable:'Medición de resultados frente a línea base y auditoría independiente'}
]);

export function worldCatalog(){
  return{version:WORLD_INTELLIGENCE_VERSION,domainCount:DOMAINS.length,specialistProfileCount:Object.keys(ROLES).length,
    domains:DOMAINS.map(({id,name,roles,outcomes,critical})=>({id,name,roles:[...roles],outcomes:[...outcomes],critical:critical===true})),
    phases:PHASES.map(({id,deliverable})=>({id,deliverable}))};
}

export function planWorldMission(message='',{attachments=[]}={}){
  const q=normalize(message);
  const domains=DOMAINS.filter(d=>matches(q,d.terms));
  const globalIntent=matches(q,['problema(?:s)? (?:de )?(?:nivel )?mundial(?:es)?','problema(?:s)? (?:de )?(?:alcance|escala) global','reto(?:s)? global(?:es)?','desafio(?:s)? mundial(?:es)?','crisis global','problema(?:s)? de la humanidad','problema(?:s)? del mundo','resolver (?:el|los|un|una)? ?(?:problema(?:s)?|reto(?:s)?|crisis) mundial(?:es)?','world problem(?:s)?','global challenge(?:s)?']);
  const worldLevel=/(?:^|\s)(?:mundial(?:es)?|global(?:es)?|humanidad)(?:\s|$)/.test(q) && /(?:^|\s)(?:problema(?:s)?|reto(?:s)?|desafio(?:s)?|crisis|resolver|solucion(?:es)?)(?:\s|$)/.test(q);
  if(!domains.length&&!globalIntent&&!worldLevel)return null;
  const broad=domains.length===0;
  const roles=[...new Set((broad?['data_evidence','economic_systems','ethics_safety']:domains.flatMap(d=>d.roles)).concat('data_evidence','ethics_safety'))].slice(0,9);
  const outcomes=[...new Set(domains.flatMap(d=>d.outcomes))];
  return{
    version:WORLD_INTELLIGENCE_VERSION,
    domains:broad?[{id:'cross_sector',name:'Problemas multidisciplinares de alcance mundial'}]:domains.map(d=>({id:d.id,name:d.name})),
    crossSector:domains.length>1||broad,
    critical:broad||domains.some(d=>d.critical),
    roles,
    outcomes,
    phases:PHASES.map(({id,deliverable})=>({id,deliverable})),
    evidenceStatus:'not_verified_by_classifier',
    dataRequired:['territorio y población','línea base y periodo','recursos y capacidad','fuentes primarias verificables'],
    attachmentCount:Array.isArray(attachments)?attachments.length:0
  };
}

export function worldSystemInstruction(plan){
  if(!plan)return '';
  const roleGuidance=plan.roles.map(role=>role+': '+ROLES[role]).join('; ');
  const impact=plan.critical?' ALTO IMPACTO: salud, suministros críticos, energía, entorno, desastres y derechos humanos exigen comprobación profesional y autorización local antes de intervenciones materiales; no inventes protocolos, certificaciones ni resultados.':'';
  return '\n\nUNIVERSAL WORLD PROBLEM INTELLIGENCE '+plan.version+
    '\nÁMBITOS DETECTADOS: '+plan.domains.map(d=>d.name).join(', ')+
    '\nEQUIPO DE ANÁLISIS: '+roleGuidance+
    '\nMÉTODO REAL: '+plan.phases.map(p=>p.id+'='+p.deliverable).join('; ')+
    '\nINDICADORES A DEFINIR SEGÚN CONTEXTO: '+(plan.outcomes.join(', ')||'efectos positivos y negativos con unidades, fechas y poblaciones definidas')+
    '\nCONTRATO DE RESULTADOS: Ayuda a resolver la pregunta específica, no sustituyas una respuesta concreta por una plantilla. Cuando el problema lo amerite, identifica escala mundial vs país vs municipio, población afectada, causalidad plausible, dependencias, responsables y herramientas disponibles. Distingue propuestas, evidencia verificada, suposiciones, datos faltantes, operaciones ejecutadas y resultados medidos. Plantea opciones y sus trade-offs sin fabricar un ranking de actores o decisiones políticas; para asuntos públicos mantén neutralidad y derechos. Prioriza pilotos medibles y reversibles antes de extrapolar; comprueba efectos secundarios, equidad, resiliencia, costo y acceso. Exige atribución y fecha para toda cifra actual, norma, programa o afirmación factual no trivial; nunca inventes estudios, fuentes, acuerdos institucionales, autorizaciones, mejoras mundiales, reducciones de muertes ni ganancias. Si no hay fuentes actuales, ofrece un método y preguntas verificables, NO una cifra fingida. No afirmes que resolviste materialmente el problema, entrenaste un modelo nuevo o contactaste organizaciones. La decisión y ejecución corresponden a humanos e instituciones autorizadas.'+impact;
}

export function publicWorldPlan(plan){
  if(!plan)return null;
  return{version:plan.version,domains:plan.domains,crossSector:plan.crossSector,critical:plan.critical,
    roles:plan.roles,phases:plan.phases,outcomes:plan.outcomes,evidenceStatus:plan.evidenceStatus,dataRequired:plan.dataRequired};
}
