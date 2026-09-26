export const UNIVERSAL_EXPERT_ORCHESTRATOR_VERSION='universal-expert-orchestrator/v1';

const clean=(s='',n=900)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const norm=(s='')=>clean(s,1600).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const EXPERTS=[
['forensics','Forense',['forense','criminalistica','evidencia','cadena de custodia','balistica','toxicologia','dactiloscopia','forensic']],
['space','Espacio y aeroespacial',['nasa','spacex','esa','orbita','cohete','satélite','satellite','astronomia','aeroespacial']],
['ev-energy','Movilidad eléctrica y energía',['tesla','vehiculo electrico','vehículo eléctrico','bateria','energía','energia']],
['research','Investigación y academia',['universidad','tesis','paper','investigacion','investigación','biblioteca','literatura científica']],
['government','Gobierno y sector público',['gobierno','gobiernos','administracion publica','administración pública','politica publica','política pública','municipio']],
['legal','Derecho y compliance',['legal','abogado','contrato','litigio','derecho','compliance','regulacion','regulación']],
['finance','Finanzas y contabilidad',['finanzas','contabilidad','auditoria','auditoría','impuestos','economia','economía','banca']],
['enterprise','Empresa e industria',['empresa','industria','manufactura','operaciones','supply chain','logistica','logística','calidad']],
['technology-ai','Tecnología e IA',['software','tecnologia','tecnología','inteligencia artificial','ia','machine learning','llm','agente','rag','cloud']],
['systems','Sistemas operativos y software',['sistema operativo','linux','windows','android','kernel','driver','compilador','debug']],
['engineering','Ingeniería',['ingenieria','ingeniería','civil','mecanica','mecánica','electrica','eléctrica','electronica','electrónica','industrial']],
['hardware','Chips y hardware',['chip','chips','semiconductor','semiconductores','cpu','gpu','asic','fpga','robotica','robótica']],
['aviation','Aviación',['avion','avión','aviones','aeronave','aviacion','aviación','aeronautica','aeronáutica']],
['maritime-rail','Marítimo, océano y ferrocarril',['barco','barcos','oceano','océano','naval','ferrocarril','tren','rail']],
['health-biology','Medicina y biología',['medicina','salud','biologia','biología','genetica','genética','farmacologia','farmacología']],
['history-politics','Historia, política y geografía',['historia','politica','política','geografia','geografía','geopolitica','geopolítica']],
['communications','Comunicación y redacción',['redaccion','redacción','comunicacion','comunicación','periodismo','marketing']],
['music-media','Música y medios',['musica','música','industria musical','discografica','discográfica','audio','cine','television','televisión']],
['real-estate','Bienes raíces y construcción',['bienes raices','bienes raíces','inmobiliaria','inmobiliario','construccion','construcción','propiedad','terreno']],
['global-systems','Sistemas globales',['problemas mundiales','crisis','cambio climatico','cambio climático','agua','pobreza','sostenibilidad','poder']]
];

const universal=['lead','research','engineering','legal','finance','operations','technology','verification','communication','execution'];

export function buildExpertOrchestration(query='',{attachments=[],mode='general'}={}){
 const n=norm(query);
 const hits=EXPERTS.map(([id,name,terms])=>({id,name,score:terms.reduce((s,t)=>s+(n.includes(norm(t))?1:0),0),matchedTerms:terms.filter(t=>n.includes(norm(t))).slice(0,6)}))
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
 const selected=hits.length?hits:[{id:'general',name:'Coordinación general',score:1,matchedTerms:[]}];
 const phases=[
  {id:'scope',name:'Definir objetivo y alcance'},
  {id:'research',name:'Investigar y reunir evidencia'},
  {id:'design',name:'Diseñar arquitectura o solución'},
  {id:'execute',name:'Construir, documentar o ejecutar'},
  {id:'verify',name:'Verificar resultados y riesgos'},
  {id:'deliver',name:'Entregar resultado accionable'}
 ];
 return {version:UNIVERSAL_EXPERT_ORCHESTRATOR_VERSION,mode,experts:selected.map((x,i)=>({...x,priority:i+1})),phases,attachments:Number(Array.isArray(attachments)?attachments.length:0),universalRoles:universal,policy:{expertSelectionIsRouting:true,noPrivateAccessClaims:true,noFabricatedExpertise:true,verificationRequired:true,executionRequiresAvailableTools:true,regulatedDomainsNeedProfessionalReview:true}};
}

export function expertOrchestrationInstruction(plan){
 if(!plan)return '';
 return '\n\nORQUESTADOR DE EXPERTOS UNIVERSAL ('+UNIVERSAL_EXPERT_ORCHESTRATOR_VERSION+'):\n'+JSON.stringify(plan)+'\n- Coordina las disciplinas seleccionadas como perspectivas complementarias, no como personas reales ni acceso privilegiado.\n- Resuelve primero el objetivo del usuario y evita introducir especialistas irrelevantes.\n- Para problemas multidisciplinarios integra las perspectivas en una sola solución coherente.\n- Sigue las fases de alcance, evidencia, diseño, ejecución, verificación y entrega cuando sean pertinentes.\n- No inventes acciones ejecutadas ni acceso a organizaciones privadas.\n- En dominios regulados conserva jurisdicción y revisión profesional.\n';
}

export function publicExpertOrchestration(plan){
 if(!plan)return null;
 return {version:plan.version,mode:plan.mode,experts:plan.experts,phases:plan.phases,attachments:plan.attachments,policy:plan.policy};
}
