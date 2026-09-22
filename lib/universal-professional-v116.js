export const PROFESSIONAL_ECONOMICS_VERSION='universal-professional-economics/v116';
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const hits=(text,patterns)=>patterns.some(pattern=>new RegExp('(?:^|\\s)(?:'+pattern+')(?:\\s|$)','i').test(text));
const DOMAINS=Object.freeze([
  {id:'project_delivery',name:'Proyectos y dirección senior',terms:['proyecto(?:s)?','project management','pmo','programa(?:s)? de trabajo','cronograma','ruta critica','gestion de proyectos'],roles:['principal_project_manager','systems_architect'],deliverables:['acta de constitución','WBS','cronograma','matriz de riesgos','criterios de aceptación']},
  {id:'architecture_buildings',name:'Arquitectura y urbanismo',terms:['arquitectur\\w* (?:de edificios|residencial|comercial|civil|de viviendas|de casas|de interiores)','arquitectur\\w*','plano(?:s)? arquitectonic\\w*','edificio(?:s)?','vivienda(?:s)?','urbanismo','inmueble(?:s)?'],roles:['architect_urbanist','construction_engineer'],deliverables:['programa arquitectónico','anteproyecto','especificaciones','estimación preliminar'],highImpact:true},
  {id:'construction',name:'Construcción e infraestructura',terms:['construccion(?:es)?','obra(?:s)? civil(?:es)?','obra(?:s)? publica(?:s)?','cimentacion','estructura(?:s)? de concreto','presupuesto de obra','edificacion(?:es)?'],roles:['construction_engineer','project_controls'],deliverables:['alcance y partidas','presupuesto de obra','ruta crítica','control de calidad'],highImpact:true},
  {id:'business_venture',name:'Negocios, empresas y emprendimiento',terms:['negocio(?:s)?','empresa(?:s)?','emprend\\w*','startup(?:s)?','saas','franquicia(?:s)?','business plan','sociedad mercantil'],roles:['venture_builder','growth_revenue'],deliverables:['validación de mercado','modelo de negocio','operación','unit economics']},
  {id:'investments',name:'Inversiones y gestión de riesgos',terms:['inversion(?:es)?','invertir','inversionista(?:s)?','portafolio','cartera de inversion','etf','acciones bursatiles','bono(?:s)? gubernamentales','rendimiento financiero','rentabilidad de inversion','valoracion de activos'],roles:['investment_analyst','financial_risk'],deliverables:['tesis de inversión','escenarios','liquidez','riesgo y supuestos'],highImpact:true},
  {id:'banking',name:'Bancos y servicios financieros',terms:['banco(?:s)?','bancari\\w*','banca','fintech','credito(?:s)?','prestamo(?:s)?','hipoteca(?:s)?','intermediacion financiera'],roles:['banking_operations','financial_risk'],deliverables:['modelo operativo','riesgo crediticio','controles','requisitos regulatorios'],highImpact:true},
  {id:'laboratories',name:'Laboratorios e investigación aplicada',terms:['laboratorio(?:s)?','laboratori\\w*','centro(?:s)? de investigacion','ensayo(?:s)? clinico(?:s)?','investigacion aplicada','lab(?:s)?'],roles:['laboratory_quality','research_program'],deliverables:['diseño de laboratorio','SOP','trazabilidad','validación y bioseguridad'],highImpact:true},
  {id:'corporate_finance',name:'Finanzas empresariales',terms:['finanzas? corporativ\\w*','finanzas? empresarial\\w*','modelo(?:s)? financiero(?:s)?','flujo de caja','cash flow','ebitda','tesoreria','balance general','estado(?:s)? de resultados','contabilidad','capital de trabajo','presupuesto empresarial'],roles:['corporate_cfo','financial_risk'],deliverables:['P&L proyectado','flujo de caja','presupuesto','sensibilidad'] ,highImpact:true},
  {id:'personal_finance',name:'Finanzas personales y patrimonio',terms:['finanzas? personales','presupuesto familiar','mi dinero','mis deudas','deuda personal','ahorro(?:s)?','fondo de emergencia','gasto(?:s)? personales','patrimonio personal','retiro','jubilacion'],roles:['personal_finance_educator','financial_risk'],deliverables:['flujo personal','presupuesto','prioridades','escenarios de ahorro'],highImpact:true},
  {id:'global_economy',name:'Economía global y mercados',terms:['economia mundial','economia global','economia internacional','macroeconomia','pib','inflacion','tipo de cambio','tasas? de interes','comercio internacional','geopolitica economica','mercado(?:s)? internacionales','banco(?:s)? central(?:es)?'],roles:['global_economist','financial_risk'],deliverables:['marco macroeconómico','indicadores fechados','escenarios','exposición por país'],highImpact:true},
  {id:'revenue_monetization',name:'Ingresos, monetización y rentabilidad',terms:['ganar dinero','hacer dinero','generar ingresos','monetiz\\w*','rentabilidad','utilidades','margen(?:es)? de ganancia','modelo de negocio','nueva(?:s)? fuente(?:s)? de ingreso','hacer rentable','facturacion','aumentar ventas'],roles:['growth_revenue','corporate_cfo'],deliverables:['oferta validable','canales de venta','unit economics','experimentos de adquisición','indicadores']},
  {id:'personal_projects',name:'Proyectos y planificación personal',terms:['proyecto(?:s)? personal(?:es)?','objetivo(?:s)? personal(?:es)?','meta(?:s)? personal(?:es)?','organizar mi vida','plan de vida','plan personal','carrera profesional','plan de carrera'],roles:['principal_project_manager','personal_finance_educator'],deliverables:['objetivo medible','plan de ejecución','recursos','seguimiento']}
]);
const MANDATES=Object.freeze({
  principal_project_manager:'Convierte objetivos en entregables, dependencias, cronograma, responsables, riesgos y criterios de cierre.',
  systems_architect:'Diseña componentes, interfaces, restricciones, trade-offs y verificaciones según el tipo de proyecto.',
  architect_urbanist:'Define necesidades de uso, anteproyecto y coordinación interdisciplinaria; no suplanta firma ni permiso profesional.',
  construction_engineer:'Estructura presupuesto, secuencia y seguridad de obra; cálculo estructural y liberación requieren validación competente.',
  project_controls:'Controla estimaciones, compras, avance físico-financiero, desviaciones, cambios y aceptación.',
  venture_builder:'Valida problema, público objetivo, disposición a pagar, modelo operativo y experimentos comerciales.',
  growth_revenue:'Diseña propuesta de valor, adquisición, conversión, retención, precios y pruebas de ingresos sin prometer ventas.',
  investment_analyst:'Presenta tesis y alternativas, horizonte, liquidez, escenarios y riesgos sin garantizar retornos.',
  financial_risk:'Evalúa pérdidas, sensibilidad, deuda, concentración, supuestos y controles de riesgo.',
  banking_operations:'Mapea servicios, riesgo de crédito, operaciones bancarias y regulación aplicable según jurisdicción.',
  laboratory_quality:'Define instalaciones, SOP, trazabilidad, control de calidad y validaciones; sin certificar ensayos no observados.',
  research_program:'Estructura hipótesis, metodología, evidencia, replicabilidad, revisión y gestión de proyectos científicos.',
  corporate_cfo:'Construye presupuesto, flujo de caja, unit economics, capital de trabajo y decisiones bajo supuestos declarados.',
  personal_finance_educator:'Ayuda a presupuestar, ordenar deudas, priorizar liquidez y comparar escenarios sin asumir cuentas reales.',
  global_economist:'Interpreta indicadores mundiales con periodo, país, fuente y población; distingue hipótesis de dato observado.'
});
const STAGES=Object.freeze([
  ['strategy',['estrateg\\w*','vision','tesis','objetivo(?:s)?','oportunidad(?:es)?']],
  ['research',['investig\\w*','analiz\\w*','mercado','estudio(?:s)?','diagnos\\w*']],
  ['design',['disen\\w*','arquitectur\\w*','planifica\\w*','estructur\\w*']],
  ['finance',['presupuest\\w*','financi\\w*','inversion(?:es)?','cost\\w*','precio(?:s)?','rentab\\w*']],
  ['build',['constru\\w*','crea\\w*','desarroll\\w*','implement\\w*','monta\\w*']],
  ['operate',['oper\\w*','administr\\w*','dirig\\w*','gestion\\w*','ejecut\\w*']],
  ['grow',['escal\\w*','expan\\w*','monetiz\\w*','ventas','ingresos','optimiza\\w*']],
  ['audit',['audit\\w*','verific\\w*','repar\\w*','mejor\\w*','cumplim\\w*']]
]);
export function professionalCatalog(){return{version:PROFESSIONAL_ECONOMICS_VERSION,domainCount:DOMAINS.length,specialistProfileCount:Object.keys(MANDATES).length,domains:DOMAINS.map(({id,name,roles,deliverables,highImpact})=>({id,name,roles:[...roles],deliverables:[...deliverables],highImpact:highImpact===true})),stages:STAGES.map(([id])=>id)};}
export function planProfessionalMission(message='',{attachments=[]}={}){
  const q=norm(message);
  const domains=DOMAINS.filter(d=>hits(q,d.terms));
  if(!domains.length)return null;
  const stages=STAGES.filter(([,p])=>hits(q,p)).map(([id])=>id);
  if(!stages.length)stages.push('strategy');
  return{version:PROFESSIONAL_ECONOMICS_VERSION,domains:domains.map(({id,name})=>({id,name})),stages,roles:[...new Set(domains.flatMap(d=>d.roles))].slice(0,8),deliverables:[...new Set(domains.flatMap(d=>d.deliverables))].slice(0,12),highImpact:domains.some(d=>d.highImpact),financeRelated:domains.some(d=>['investments','banking','corporate_finance','personal_finance','global_economy','revenue_monetization'].includes(d.id)),attachmentCount:Array.isArray(attachments)?attachments.length:0};
}
export function professionalSystemInstruction(plan){
  if(!plan)return'';
  const finance=plan.financeRelated?' FINANZAS: nunca prometas dinero, rendimiento, aprobación crediticia, ventaja garantizada ni certeza predictiva. Distingue ingresos, utilidad, flujo de caja y patrimonio; explicita periodo, moneda, inflación, impuestos, comisiones, deuda y escenarios cuando correspondan. No inventes tasas, activos, balances o cotizaciones; para datos actuales requiere fuente y fecha verificables. No realices transacciones ni actúes como asesor fiduciario personalizado.':'';
  const safety=plan.highImpact?' ALTO IMPACTO: laboratorios, construcción, banca y decisiones patrimoniales pueden exigir normas vigentes, permisos, responsables acreditados, controles de bioseguridad, pruebas y autorizaciones. No declares certificación, obra segura, resultado analítico válido ni cumplimiento sin evidencia.':'';
  return '\n\nUNIVERSAL PROFESSIONAL & ECONOMIC CORE '+plan.version+
    '\nSECTORES: '+plan.domains.map(d=>d.name).join(', ')+
    '\nETAPAS: '+plan.stages.join(', ')+
    '\nESPECIALISTAS: '+plan.roles.map(r=>r+': '+(MANDATES[r]||'análisis especializado')).join('; ')+
    '\nENTREGABLES APROPIADOS: '+plan.deliverables.join(', ')+
    '\nCONTRATO SENIOR: responde a la tarea concreta; cuando corresponda convierte la estrategia en entregable verificable: alcance, arquitectura o modelo operativo, hipótesis, presupuesto, hitos, responsables, riesgos, criterios de aceptación y KPIs. Diferencia dato aportado, cálculo, estimación, investigación pendiente y resultado ejecutado. No inventes que consultaste mercado o normativas, dibujaste planos, elaboraste simulaciones, abriste cuentas bancarias, invertiste, fabricaste ni ejecutaste una operación. Respeta contexto, jurisdicción y autorizaciones. Para proyectos personales adapta el método y evita burocracia innecesaria.'+finance+safety;
}
export function publicProfessionalPlan(plan){if(!plan)return null;return{version:plan.version,domains:plan.domains,stages:plan.stages,roles:plan.roles,deliverables:plan.deliverables,highImpact:plan.highImpact,financeRelated:plan.financeRelated};}
const number=(v,max=1e12)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const money=n=>Math.round((n+Number.EPSILON)*100)/100;
export function projectEconomics(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const {unitPrice,unitVariableCost,fixedCost,volume,initialInvestment,currency,period='mes'}=input;
  if(![unitPrice,unitVariableCost,fixedCost].every(v=>number(v))||!Number.isSafeInteger(volume)||volume<0||volume>1e9)return null;
  if(initialInvestment!==undefined&&!number(initialInvestment))return null;
  if(typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)||typeof period!=='string'||!(/^(mes|año|ano|trimestre|semana|día|dia|proyecto|month|year|quarter|week|day|project)$/i).test(period))return null;
  if(unitPrice*volume>1e12||unitVariableCost*volume>1e12)return null;
  const revenue=money(unitPrice*volume),variableCosts=money(unitVariableCost*volume),operatingProfit=money(revenue-variableCosts-fixedCost);
  const contributionPerUnit=money(unitPrice-unitVariableCost);
  const contributionMarginPct=unitPrice>0?money(100*(unitPrice-unitVariableCost)/unitPrice):null;
  const breakEvenUnits=contributionPerUnit>0?Math.ceil(fixedCost/contributionPerUnit):null;
  const simplePeriodRoiPct=initialInvestment>0?money(100*operatingProfit/initialInvestment):null;
  return{schema:'universal-project-economics/v1',currency,period,inputs:{unitPrice,unitVariableCost,fixedCost,volume,initialInvestment:initialInvestment??null},revenue,variableCosts,fixedCosts:fixedCost,operatingProfit,contributionPerUnit,contributionMarginPct,breakEvenUnits,simplePeriodRoiPct,feasibleUnitEconomics:contributionPerUnit>0,assumptions:['Datos recibidos expresamente; no cotizaciones verificadas','Resultado operativo simplificado, no flujo de caja libre ni utilidad neta','No incluye impuestos, deuda, comisiones, depreciación ni capital de trabajo','ROI simple del periodo; no retorno anualizado ni promesa de rentabilidad']};
}
