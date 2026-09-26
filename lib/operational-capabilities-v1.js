export const OPERATIONAL_CAPABILITIES_VERSION='operational-capabilities/v1';

const RULES=[
  {id:'property_administration',name:'Administración operativa de inmuebles y centros comerciales',status:'ready',can:['organizar operaciones','crear planes de trabajo','priorizar incidencias','definir KPIs','crear procedimientos','coordinar responsables y dependencias'],cannot:['acceder a sistemas privados de Plaza Andares sin una conexión autorizada','confirmar que una orden externa fue ejecutada sin recibo verificable']},
  {id:'tenant_management',name:'Gestión de inquilinos',status:'ready',can:['estructurar expedientes','crear matrices de contratos y obligaciones','preparar comunicaciones','analizar cobros y vencimientos con datos proporcionados'],cannot:['consultar contratos o saldos reales que no hayan sido conectados o aportados']},
  {id:'maintenance_operations',name:'Mantenimiento y operaciones',status:'ready',can:['crear órdenes de trabajo','priorizar averías','definir SLA','checklists de mantenimiento','planes de limpieza y seguridad','matrices de responsables'],cannot:['abrir una orden en el sistema de mantenimiento externo sin integración autorizada']},
  {id:'finance_operations',name:'Finanzas operativas',status:'ready',can:['presupuestos','escenarios','costos','proyecciones deterministas con cifras recibidas','KPIs financieros'],cannot:['inventar ingresos, gastos, saldos o facturas']},
  {id:'marketing_operations',name:'Marketing y promoción',status:'ready',can:['campañas','calendarios','segmentación','briefs','copys','KPIs y experimentos'],cannot:['publicar campañas o gastar presupuesto publicitario sin una herramienta autorizada']},
  {id:'incident_management',name:'Gestión de incidencias',status:'ready',can:['clasificar incidentes','evaluar prioridad','crear protocolo de respuesta','checklists','informes y seguimiento'],cannot:['afirmar que seguridad, mantenimiento o proveedores fueron notificados sin evidencia']},
  {id:'external_actions',name:'Acciones sobre sistemas externos',status:'conditional',can:['ejecutar cuando exista una herramienta/conector autorizado y su recibo confirme la operación'],cannot:['simular clics, envíos, cambios o accesos']},
];

export function operationalCapabilityPlan(message=''){
  const q=String(message||'').toLowerCase();
  const match=/\b(administr|inquilin|arrend|plaza|centro comercial|mantenimiento|operaci[oó]n|limpieza|seguridad|cobro|renta|contrato|marketing|promoci[oó]n|presupuesto|incidencia|aver[ií]a|proveedor|sla|kpi)\b/.test(q);
  return {version:OPERATIONAL_CAPABILITIES_VERSION,matched:match,rules:RULES.map(x=>({...x,can:[...x.can],cannot:[...x.cannot]})),executionPrinciple:'Una acción externa solo se declara ejecutada cuando existe evidencia de herramienta o recibo verificable.'};
}

export function operationalSystemInstruction(plan){
  if(!plan?.matched)return '';
  const rows=plan.rules.map(r=>'- '+r.name+': estado '+r.status+'. Puede realizar: '+r.can.join('; ')+'. No puede afirmar: '+r.cannot.join('; ')).join('\n');
  return '\n\nCAPACIDADES OPERATIVAS VERIFICADAS ('+OPERATIONAL_CAPABILITIES_VERSION+'):\n'+rows+'\nRegla estricta: si el usuario pide administrar una organización, inmueble o centro comercial, no devuelvas un menú genérico de preguntas. Empieza por el trabajo que sí puedes ejecutar con la información disponible; pide solo el dato imprescindible para una acción que realmente lo necesite. Separa entregables generados aquí de acciones externas todavía no ejecutadas.';
}

export function operationalCapabilities(){return{version:OPERATIONAL_CAPABILITIES_VERSION,count:RULES.length,rules:RULES.map(r=>({id:r.id,name:r.name,status:r.status}))};}