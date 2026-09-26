export const GOVERNMENT_CAPABILITIES_VERSION='government-capabilities/v1';

const CAPABILITIES=[
 {id:'data_analysis',name:'Análisis de datos',status:'ready',deliverables:['perfilado CSV','detección de nulos y estructura','resúmenes y comparaciones','KPIs y escenarios con datos proporcionados'],requires:['archivo o datos'],externalAction:false},
 {id:'public_policy',name:'Política pública',status:'ready',deliverables:['marcos de análisis','matrices de impacto','escenarios','indicadores','informes basados en evidencia'],requires:['objetivo y supuestos; fuentes cuando se requieran datos actuales'],externalAction:false},
 {id:'process_automation',name:'Automatización de procesos',status:'conditional',deliverables:['diseño de workflow','reglas','SLA','especificación técnica','automatizaciones de código cuando el entorno lo permita'],requires:['sistema objetivo e integración autorizada para ejecutar cambios'],externalAction:true},
 {id:'cybersecurity',name:'Ciberseguridad defensiva',status:'ready',deliverables:['análisis de logs aportados','inventario de riesgos','hardening','controles','playbooks de respuesta'],requires:['logs, arquitectura o configuración proporcionada'],externalAction:false},
 {id:'citizen_services',name:'Servicios al ciudadano',status:'ready',deliverables:['FAQ','árboles de decisión','guiones de atención','asistentes conversacionales','clasificación de solicitudes'],requires:['normativa y contenido oficial cuando la respuesta deba ser vigente'],externalAction:false},
 {id:'crisis_management',name:'Gestión de crisis',status:'ready',deliverables:['matrices de escenarios','simulaciones deterministas','priorización de recursos','checklists','planes de continuidad'],requires:['supuestos, parámetros y datos disponibles'],externalAction:false},
 {id:'transparency',name:'Transparencia y rendición de cuentas',status:'ready',deliverables:['estructuras de datos públicos','indicadores','dashboards especificados','metodologías de auditoría y trazabilidad'],requires:['datos públicos o archivos proporcionados'],externalAction:false}
];

export function governmentCapabilityPlan(message=''){
 const q=String(message||'').toLowerCase();
 const matched=/\b(gobierno|gubernamental|municipio|municipal|estado|secretar[ií]a|dependencia|servidor p[uú]blico|ciudadano|pol[ií]tica p[uú]blica|servicio p[uú]blico|transparencia|crisis|protecci[oó]n civil|ciberseguridad)\b/.test(q);
 return {version:GOVERNMENT_CAPABILITIES_VERSION,matched,capabilities:CAPABILITIES.map(x=>({...x,deliverables:[...x.deliverables],requires:[...x.requires]})),executionRule:'No declarar una acción externa como ejecutada sin una herramienta autorizada y evidencia verificable.'};
}

export function governmentSystemInstruction(plan){
 if(!plan?.matched)return '';
 const rows=plan.capabilities.map(c=>'- '+c.name+': '+c.status+'. Entregables reales: '+c.deliverables.join('; ')+'. Requiere: '+c.requires.join('; ')).join('\n');
 return '\n\nCAPACIDADES GUBERNAMENTALES VERIFICADAS ('+GOVERNMENT_CAPABILITIES_VERSION+'):\n'+rows+'\nNo prometas acceso a sistemas gubernamentales, publicación, trámites, notificaciones, modificación de expedientes ni ejecución de políticas si no existe una integración autorizada. Cuando la capacidad sea ready, produce el entregable en este turno con los datos disponibles. Si falta un insumo, pide únicamente el mínimo necesario. Para información normativa o actual, investiga y cita evidencia vigente cuando sea posible.';
}

export function governmentCapabilities(){return{version:GOVERNMENT_CAPABILITIES_VERSION,count:CAPABILITIES.length,rules:CAPABILITIES.map(c=>({id:c.id,name:c.name,status:c.status}))};}