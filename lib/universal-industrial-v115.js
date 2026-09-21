export const UNIVERSAL_INDUSTRIAL_VERSION='universal-engineering-civilization/v115';

const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const match=(text,terms)=>terms.some(term=>new RegExp('(?:^|\\s)'+term+'(?:\\s|$)','i').test(text));

const DOMAINS=Object.freeze([
  {id:'aerospace_aircraft',name:'Aeronáutica y aeronaves',terms:['avion(?:es)?','aeronave(?:s)?','aviacion','aeronautic\\w*','helicopter\\w*','aircraft'],critical:true,roles:['aerospace_systems','structures_materials','safety_quality'],assets:['aeronaves','sistemas de propulsión','aviónica','mantenimiento aeronáutico']},
  {id:'spaceflight',name:'Ingeniería espacial',terms:['cohete(?:s)?','espacial(?:es)?','satelite(?:s)?','spacecraft','rockets?','orbital(?:es)?'],critical:true,roles:['aerospace_systems','control_systems','safety_quality'],assets:['sistemas espaciales','propulsión','telemetría','misiones']},
  {id:'automotive',name:'Automoción y movilidad terrestre',terms:['auto(?:s)?','automovil(?:es)?','carro(?:s)?','coche(?:s)?','vehiculo(?:s)?','camion(?:es)?','automotriz','automotive'],critical:true,roles:['automotive_diagnostics','mechanical_systems','safety_quality'],assets:['vehículos','electrónica','transmisión','sistemas de seguridad']},
  {id:'motorcycles',name:'Motocicletas y micromovilidad',terms:['moto(?:s)?','motocicleta(?:s)?','scooter(?:s)?','motociclismo'],critical:true,roles:['motorcycle_diagnostics','mechanical_systems','safety_quality'],assets:['motocicletas','tren motriz','suspensión','frenos']},
  {id:'marine',name:'Ingeniería naval y marítima',terms:['barco(?:s)?','buque(?:s)?','embarcacion(?:es)?','naval','maritim\\w*','marine','ship(?:s)?'],critical:true,roles:['marine_systems','mechanical_systems','safety_quality'],assets:['embarcaciones','propulsión naval','energía a bordo','sistemas de navegación']},
  {id:'engines',name:'Motores y máquinas térmicas',terms:['motor(?:es)?','turbina(?:s)?','diesel','combustion','powertrain','propulsion'],critical:true,roles:['mechanical_systems','thermal_systems','safety_quality'],assets:['motores','turbinas','sistemas térmicos','mantenimiento']},
  {id:'manufacturing',name:'Manufactura, fábricas e industrias',terms:['fabrica(?:s)?','manufactur\\w*','industria(?:s|l)?','linea(?:s)? de produccion','planta(?:s)? industrial(?:es)?','factory'],critical:true,roles:['industrial_engineering','operations_maintenance','safety_quality'],assets:['líneas de producción','equipos','inventarios','calidad y trazabilidad']},
  {id:'universities',name:'Universidades e instituciones educativas',terms:['universidad(?:es)?','campus','facultad(?:es)?','institucion(?:es)? educativa(?:s)?','education','university'],critical:false,roles:['academic_governance','operations_maintenance','information_systems'],assets:['programas académicos','laboratorios','servicios estudiantiles','gestión institucional']},
  {id:'computing',name:'Computadoras y sistemas informáticos',terms:['computadora(?:s)?','ordenador(?:es)?','pc','servidor(?:es)?','workstation(?:s)?','hardware','computer(?:s)?'],critical:false,roles:['computer_engineering','information_systems','safety_quality'],assets:['hardware','sistemas operativos','redes','soporte técnico']},
  {id:'robotics',name:'Robótica y automatización física',terms:['robot(?:s|ica)?','androide(?:s)?','actuador(?:es)?','manipulador(?:es)?','robotics'],critical:true,roles:['robotics_control','mechanical_systems','safety_quality'],assets:['robots','actuadores','sensores','control y resguardos']},
  {id:'semiconductors',name:'Semiconductores y diseño de chips',terms:['chip(?:s)?','semiconductor(?:es)?','microprocesador(?:es)?','fpga','asic','silicio','microelectronica'],critical:true,roles:['microelectronics','manufacturing_quality','safety_quality'],assets:['circuitos integrados','verificación','proceso fab','cadena de suministro']},
  {id:'technology_plants',name:'Plantas e infraestructura tecnológica',terms:['planta(?:s)? tecnologica(?:s)?','planta(?:s)? electrica(?:s)?','central(?:es)? electrica(?:s)?','data center(?:s)?','centro(?:s)? de datos','subestacion(?:es)?'],critical:true,roles:['industrial_engineering','energy_infrastructure','safety_quality'],assets:['infraestructura','energía','automatización','continuidad']},
  {id:'public_administration',name:'Gobierno y administración pública',terms:['gobierno(?:s)?','municipio(?:s)?','ayuntamiento(?:s)?','ministerio(?:s)?','administracion publica','public sector','government'],critical:false,governance:true,roles:['public_service_design','institutional_governance','security_compliance'],assets:['servicios públicos','presupuestos','operaciones institucionales','transparencia']},
  {id:'society',name:'Sociedades, organizaciones y comunidades',terms:['sociedad(?:es)?','comunidad(?:es)?','cooperativa(?:s)?','asociacion(?:es)?','organizacion(?:es)? civil(?:es)?','ecosistema(?:s)? social(?:es)?'],critical:false,governance:true,roles:['institutional_governance','operations_maintenance','security_compliance'],assets:['gobernanza','servicios comunitarios','recursos','indicadores sociales']}
]);

const STAGES=Object.freeze([
  ['design', ['disen\\w*','design','concepto','planifica\\w*','proyecta\\w*']],
  ['build',['constru\\w*','fabric\\w*','monta\\w*','crea\\w*','desarrolla\\w*','ensambla\\w*','build']],
  ['diagnose',['diagnos\\w*','fall\\w*','averia\\w*','problema\\w*','inspeccion\\w*','debug','revis\\w*']],
  ['repair',['repar\\w*','arregl\\w*','corrig\\w*','restaur\\w*','fix']],
  ['maintain',['manten\\w*','mantenimiento','calibr\\w*','preventiv\\w*','predictiv\\w*','service']],
  ['operate',['oper\\w*','produccion','control\\w*','optimiza\\w*']],
  ['direct',['dirig\\w*','direccion','gestion\\w*','gobern\\w*','administr\\w*','presupuesto\\w*']]
]);

export function industrialCatalog(){
  return {version:UNIVERSAL_INDUSTRIAL_VERSION,domains:DOMAINS.map(({id,name,critical,governance,assets,roles})=>({id,name,critical,governance:governance===true,assets:[...assets],roles:[...roles]})),stages:STAGES.map(([id])=>id)};
}

export function planIndustrialMission(message='',{attachments=[]}={}){
  const q=normalize(message);
  const domains=DOMAINS.filter(domain=>match(q,domain.terms));
  if(!domains.length)return null;
  const lifecycle=STAGES.filter(([,terms])=>match(q,terms)).map(([id])=>id);
  if(!lifecycle.length)lifecycle.push('diagnose');
  const safetyCritical=domains.some(domain=>domain.critical);
  const institutional=domains.some(domain=>domain.governance);
  const roles=[...new Set(domains.flatMap(domain=>domain.roles))].slice(0,6);
  return {
    version:UNIVERSAL_INDUSTRIAL_VERSION,
    domains:domains.map(({id,name})=>({id,name})),
    lifecycle,
    safetyCritical,
    institutional,
    roles,
    evidencePolicy:'asset-specific-observed-evidence',
    executionPolicy:safetyCritical?'human-approved-authoritative-procedures':'permission-and-evidence-gated',
    attachmentCount:Array.isArray(attachments)?attachments.length:0
  };
}

export function industrialSystemInstruction(plan){
  if(!plan)return '';
  const domains=plan.domains.map(x=>x.name).join(', ');
  const safety=plan.safetyCritical
    ? 'SEGURIDAD CRÍTICA: asesoría y documentación no son inspección ni certificación física. Antes de recomendar intervención práctica en aeronaves, cohetes, vehículos, embarcaciones, equipos energizados, chips/fábricas o robots, exige datos exactos del activo, condiciones de operación, manuales autorizados y evaluación de riesgos. No inventes torques, tolerancias, cableados, secuencias peligrosas, configuraciones de vuelo/propulsión, límites de servicio, normas ni aprobaciones. No declares seguro para operar o volar un equipo sin pruebas y firma del personal competente. Da una alternativa diagnóstica segura y de alto nivel si faltan datos.'
    : 'No inventes políticas, acreditaciones, autorizaciones, datos operativos o accesos institucionales.';
  const governance=plan.institutional
    ? 'GESTIÓN INSTITUCIONAL: aborda prestación de servicios, legalidad, transparencia, control interno, protección de datos, presupuesto y evaluación de resultados de manera neutral; no asumas autoridad ni decisión pública.'
    : '';
  return '\n\nPAQUETE UNIVERSAL DE INGENIERÍA Y CIVILIZACIÓN '+plan.version+
    '\nÁmbitos detectados: '+domains+
    '\nCiclo de vida: '+plan.lifecycle.join(', ')+
    '\nEspecialistas aplicables: '+plan.roles.join(', ')+
    '\nCONTRATO: adapta la respuesta al activo, sector y objetivo específicos. Entrega análisis utilizable: alcance, hipótesis explícitas, información/documentos necesarios, plan de pruebas o construcción, riesgos, criterios de aceptación y responsables. Distingue orientación conceptual, cálculo preliminar, diseño revisado, pruebas verificadas y liberación autorizada. Usa únicamente evidencia y herramientas realmente observadas. El trabajo en CAD/CAE/PLM/BIM, simuladores, instrumentos o equipos físicos sólo se considera realizado si existen resultados de una integración ejecutada; no lo simules. '+safety+' '+governance;
}

export function publicIndustrialPlan(plan){
  if(!plan)return null;
  return {version:plan.version,domains:plan.domains,lifecycle:plan.lifecycle,
    safetyCritical:plan.safetyCritical,institutional:plan.institutional,
    roles:plan.roles,evidencePolicy:plan.evidencePolicy,executionPolicy:plan.executionPolicy};
}
