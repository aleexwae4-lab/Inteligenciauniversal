import { searchKnowledge, understandKnowledgeQuery, deduplicateKnowledgeRecords, rerankKnowledgeRecords, citationForRecord } from './knowledge/fabric-v1.js';
import { sanitizeRetrievedText } from './knowledge/retrieval-security-v1.js';

export const UNIVERSAL_KNOWLEDGE_MESH_VERSION='universal-knowledge-mesh/v89';
export const UNIVERSAL_KNOWLEDGE_CONTRACT='universal-knowledge/v1';

const text=(value,max=4000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>text(value,6000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ\s]/gi,' ').replace(/\s+/g,' ').trim();
const arr=value=>Array.isArray(value)?value:[];
const clamp=(value,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):fallback));
const now=()=>new Date().toISOString();

const TRANSFORM_RX=/\b(reescribe|reescribir|corrige|corregir|ortografia|traduce|traducir|resume este|resumir este|redacta|redactar|escribe un|crea un poema|haz un poema|caption|correo|email|mensaje para|cambia el tono)\b/i;
const FACTUAL_RX=/\b(que es|que son|quien|quienes|cuando|donde|cual es|cuales son|cuanto|cuantos|define|definicion|explica|historia de|biografia|autor de|fundador|nacio|murio|capital de|poblacion|estadistica|dato|datos|evidencia|fuentes|investiga|investigacion|estudio|paper|articulo|libro|obra|ley|jurisprudencia|reglamento|norma|economia|pib|inflacion|desempleo|software|paquete|libreria|framework|version actual)\b/i;
const CURRENT_RX=/\b(hoy|actual|actualmente|ultima|ultimo|ultimas|ultimos|latest|current|reciente|recientes|esta semana|este mes|2026)\b/i;
const RESEARCH_RX=/\b(investiga|investigacion|fuentes|evidencia|paper|papers|articulo cientifico|estudio|bibliografia|estado del arte|verifica|comprueba|research)\b/i;

const DOMAIN_RULES=[
  ['medicine',/\b(medic\w*|salud\w*|clinic\w*|farmac\w*|tratamiento\w*|enfermedad\w*|diagnost\w*|paciente\w*|cancer\w*|cardio\w*|neurolog\w*|epidemi\w*|biomed\w*)\b/i],
  ['science',/\b(cienc\w*|cientific\w*|fisic\w*|quimic\w*|biolog\w*|genetic\w*|astronom\w*|matematic\w*|estadistic\w*|paper\w*|estudio\w*|doi|arxiv|pubmed)\b/i],
  ['economics',/\b(econom\w*|pib|gdp|inflacion\w*|desempleo\w*|poblacion\w*|ingreso\w*|deuda\w*|pobreza\w*|desarrollo\w*|world bank|banco mundial)\b/i],
  ['software',/\b(software|github|npm|node|javascript|typescript|python|pypi|paquete\w*|libreria\w*|framework\w*|sdk|api|repositorio\w*|version\w*)\b/i],
  ['law',/\b(ley\w*|legal\w*|juridic\w*|jurisprudencia\w*|codigo\w*|reglamento\w*|constitucion\w*|tribunal\w*|sentencia\w*|delito\w*|fiscal\w*|norma oficial)\b/i],
  ['books',/\b(libro\w*|books?|novela\w*|obra literaria|isbn|autor\w*|escritor\w*|biblioteca\w*|gutenberg|open library)\b/i],
  ['history',/\b(histori\w*|guerra\w*|siglo\w*|imperio\w*|revolucion\w*|antigu\w*|biografia\w*)\b/i],
  ['geography',/\b(pais\w*|ciudad\w*|capital\w*|geograf\w*|territorio\w*|continente\w*|rio\w*|montana\w*|oceano\w*|poblacion de)\b/i],
  ['business',/\b(empresa\w*|mercado\w*|industria\w*|negocio\w*|startup\w*|fintech\w*|saas|ingreso\w*|competidor\w*)\b/i],
  ['general',/.*/]
];

const SOURCE_PACKS=Object.freeze({
  encyclopedic:{sources:['wikidata','wikipedia'],purpose:'entities, definitions, history, geography and stable general facts'},
  scholarly:{sources:['openalex','crossref','arxiv','zenodo'],purpose:'research literature and scholarly metadata'},
  biomedical:{sources:['pubmed','europe_pmc','openalex','crossref'],purpose:'biomedical evidence and literature'},
  books:{sources:['open_library','wikidata','wikipedia'],purpose:'books, authors and bibliographic knowledge'},
  public_data:{sources:['world_bank'],purpose:'official development and economic indicators'},
  software:{sources:['npm_registry','pypi','github'],purpose:'software package and repository metadata'},
  live:{sources:['searxng','gdelt'],purpose:'fresh web/current events through the live-data layer'},
});

const WB_INDICATORS=Object.freeze([
  {id:'NY.GDP.MKTP.CD',name:'GDP (current US$)',rx:/\b(pib|gdp|producto interno bruto)\b/i},
  {id:'NY.GDP.PCAP.CD',name:'GDP per capita (current US$)',rx:/\b(pib per capita|gdp per capita|ingreso per capita)\b/i,priority:2},
  {id:'SP.POP.TOTL',name:'Population, total',rx:/\b(poblacion|population|habitantes)\b/i},
  {id:'FP.CPI.TOTL.ZG',name:'Inflation, consumer prices (annual %)',rx:/\b(inflacion|inflation|ipc|cpi)\b/i},
  {id:'SL.UEM.TOTL.ZS',name:'Unemployment, total (% of total labor force)',rx:/\b(desempleo|unemployment)\b/i},
  {id:'SP.DYN.LE00.IN',name:'Life expectancy at birth, total (years)',rx:/\b(esperanza de vida|life expectancy)\b/i},
]);

function domainsFor(message=''){
  const q=norm(message);const domains=[];
  for(const [id,rx] of DOMAIN_RULES){if(id==='general')continue;if(rx.test(q))domains.push(id)}
  return domains.length?[...new Set(domains)]:['general'];
}

export function classifyUniversalKnowledge(body={}){
  const message=text(body.message||body.task||body.prompt||body.query||'',6000);
  const q=norm(message);
  const transform=TRANSFORM_RX.test(q);
  const domains=domainsFor(message);
  const current=CURRENT_RX.test(q);
  const research=RESEARCH_RX.test(q)||String(body.mode||'').toLowerCase()==='research';
  const factual=FACTUAL_RX.test(q)||research||body.knowledge===true||body.universal_knowledge===true;
  const eligible=Boolean(message)&&body.knowledge!==false&&!transform&&factual;
  const packs=new Set(['encyclopedic']);
  if(domains.some(x=>['science'].includes(x))||research)packs.add('scholarly');
  if(domains.includes('medicine'))packs.add('biomedical');
  if(domains.includes('books'))packs.add('books');
  if(domains.includes('economics'))packs.add('public_data');
  if(domains.includes('software'))packs.add('software');
  if(current||domains.includes('law')||domains.includes('business'))packs.add('live');
  return{version:UNIVERSAL_KNOWLEDGE_MESH_VERSION,eligible,query:message,domains,current,research,transform,packs:[...packs],method:'retrieval+fusion+verification',omniscience_claim:false,base_model_training:false};
}

function licenseMeta(license='metadata-only',extra={}){return{license,license_class:'metadata_or_public_data',copyright_status:'mixed',ingestion_permission:'transient_metadata',storage_permission:false,embedding_permission:false,redistribution_permission:false,model_training_permission:false,confidence:'policy',...extra}}

function externalRecord({source,id,title,abstract,url,date=null,type='data_record',topics=[],authority=.9,license,raw={}}){
  const clean=sanitizeRetrievedText(abstract||'',3500);
  return{
    id:`${source}:${text(id,500)}`,type,title:text(title,800),abstract:clean.text||undefined,authors:[],publicationDate:date||undefined,language:undefined,
    identifiers:{},topics:arr(topics).map(x=>text(x,160)).filter(Boolean).slice(0,20),
    source:{id:source,canonical_url:url,retrieved_at:now(),connector_version:UNIVERSAL_KNOWLEDGE_MESH_VERSION},
    license:license||licenseMeta(),citations:[],
    quality:{source_authority:authority,peer_review_status:'not_applicable',publication_type:type,citation_count:null,publication_date:date,retraction_status:'not_applicable',author_identity:'not_applicable',institution:null,primary_vs_secondary_source:'primary',cross_source_confirmation:0,license_confidence:(license||{}).confidence||'policy'},
    provenance:{source,source_record_id:text(id,500),canonical_url:url,retrieved_at:now(),prompt_injection_detected:clean.injection_detected===true},raw_metadata:raw
  };
}

async function getJson(url,{fetchImpl=fetch,timeoutMs=6500,headers={}}={}){
  const response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'WAE-Universal-Core/89',...headers},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Object.assign(new Error(`universal_source_http_${response.status}`),{status:response.status});
  return response.json();
}

function chooseWbIndicator(query=''){
  const q=norm(query);const matches=WB_INDICATORS.filter(item=>item.rx.test(q));
  if(!matches.length)return null;
  if(/\b(per capita)\b/.test(q))return matches.find(x=>x.id==='NY.GDP.PCAP.CD')||matches[0];
  return matches.sort((a,b)=>(b.priority||0)-(a.priority||0))[0];
}

async function resolveWorldBankCountry(query,fetchImpl){
  const data=await getJson('https://api.worldbank.org/v2/country?format=json&per_page=400',{fetchImpl,timeoutMs:6500});
  const rows=arr(data?.[1]);const q=` ${norm(query)} `;
  const candidates=rows.filter(row=>row?.region?.id!=='NA').map(row=>({id:String(row.id||''),iso2:String(row.iso2Code||''),name:String(row.name||''),score:0}));
  for(const row of candidates){
    const name=norm(row.name),iso2=norm(row.iso2),id=norm(row.id);
    if(name&&q.includes(` ${name} `))row.score=Math.max(row.score,100+name.length);
    if(iso2&&new RegExp(`\\b${iso2}\\b`,'i').test(norm(query)))row.score=Math.max(row.score,50);
    if(id&&new RegExp(`\\b${id}\\b`,'i').test(norm(query)))row.score=Math.max(row.score,60);
  }
  return candidates.sort((a,b)=>b.score-a.score)[0]?.score?candidates.sort((a,b)=>b.score-a.score)[0]:null;
}

async function worldBankSearch(query,{fetchImpl=fetch,limit=5}={}){
  const indicator=chooseWbIndicator(query);if(!indicator)return[];
  let country;
  try{country=await resolveWorldBankCountry(query,fetchImpl)}catch{return[]}
  if(!country)return[];
  const url=new URL(`https://api.worldbank.org/v2/country/${encodeURIComponent(country.id)}/indicator/${indicator.id}`);
  url.searchParams.set('format','json');url.searchParams.set('mrv',String(clamp(limit,1,8,5)));url.searchParams.set('per_page','8');
  const data=await getJson(url,{fetchImpl,timeoutMs:6500});const rows=arr(data?.[1]).filter(row=>row?.value!==null&&row?.value!==undefined);
  if(!rows.length)return[];
  const summary=rows.map(row=>`${row.date}: ${row.value}`).join('; ');
  const latest=rows[0];
  return[externalRecord({source:'world_bank',id:`${country.id}:${indicator.id}`,title:`${indicator.name} — ${country.name}`,abstract:`World Bank indicator ${indicator.id}. Latest returned observations: ${summary}.`,url:`https://data.worldbank.org/indicator/${indicator.id}?locations=${country.iso2}`,date:latest?.date?String(latest.date):null,type:'official_statistics',topics:['economics','public_data',indicator.id],authority:.99,license:licenseMeta('CC BY 4.0 default for World Bank-produced open datasets; per-dataset exceptions may apply',{license_class:'cc-by-4.0-or-dataset-specific',redistribution_permission:true,confidence:'policy'}),raw:{indicator:indicator.id,country:country.id,observations:rows.map(row=>({date:row.date,value:row.value,unit:row.unit||null}))}})];
}

async function npmSearch(query,{fetchImpl=fetch,limit=5}={}){
  const url=new URL('https://registry.npmjs.org/-/v1/search');url.searchParams.set('text',text(query,300));url.searchParams.set('size',String(clamp(limit,1,8,5)));
  const data=await getJson(url,{fetchImpl,timeoutMs:5500});
  return arr(data?.objects).map(item=>{
    const pkg=item?.package||{};const name=text(pkg.name,240);if(!name)return null;
    const description=[pkg.description,`Version: ${pkg.version||'unknown'}`,arr(pkg.keywords).length?`Keywords: ${arr(pkg.keywords).slice(0,10).join(', ')}`:''].filter(Boolean).join('. ');
    return externalRecord({source:'npm_registry',id:name,title:`npm package: ${name}`,abstract:description,url:`https://www.npmjs.com/package/${encodeURIComponent(name)}`,date:pkg.date||item?.updated||null,type:'software_package_metadata',topics:['software','javascript','npm',...arr(pkg.keywords).slice(0,8)],authority:.88,license:licenseMeta('Registry metadata; package code/content is independently licensed',{license_class:'per-package',confidence:'policy'}),raw:{version:pkg.version||null,links:pkg.links||{},publisher:pkg.publisher||null,score:item?.score||null}});
  }).filter(Boolean);
}

function pypiCandidate(query=''){
  const raw=String(query||'');
  const quoted=raw.match(/(?:pypi|paquete python|python package)\s*[`"']?([A-Za-z0-9_.-]{2,80})[`"']?/i)?.[1];
  if(quoted&&!/^(para|que|the|a|an|de|un|una)$/i.test(quoted))return quoted;
  const code=raw.match(/`([A-Za-z0-9_.-]{2,80})`/)?.[1];
  return code||null;
}

async function pypiLookup(query,{fetchImpl=fetch}={}){
  const candidate=pypiCandidate(query);if(!candidate)return[];
  try{
    const data=await getJson(`https://pypi.org/pypi/${encodeURIComponent(candidate)}/json`,{fetchImpl,timeoutMs:5500});const info=data?.info||{};
    if(!info.name)return[];
    return[externalRecord({source:'pypi',id:info.name,title:`PyPI project: ${info.name}`,abstract:[info.summary,`Version: ${info.version||'unknown'}`,info.requires_python?`Requires Python: ${info.requires_python}`:''].filter(Boolean).join('. '),url:info.project_url||`https://pypi.org/project/${encodeURIComponent(info.name)}/`,date:null,type:'software_package_metadata',topics:['software','python','pypi',...arr(info.keywords?String(info.keywords).split(/[ ,]+/):[]).slice(0,8)],authority:.88,license:licenseMeta('Project metadata; distribution files and code use per-project licenses',{license_class:'per-project',confidence:'policy'}),raw:{version:info.version||null,license_expression:info.license_expression||info.license||null,project_urls:info.project_urls||{}}})];
  }catch{return[]}
}

export function universalKnowledgeCapabilities(){
  return{
    version:UNIVERSAL_KNOWLEDGE_MESH_VERSION,contract:UNIVERSAL_KNOWLEDGE_CONTRACT,
    architecture:'federated-open-world-retrieval',coverage:'broad-domain-dynamic',omniscience:false,baseModelTraining:false,
    policies:{verifyBeforeAccept:true,materialFactsNeedEvidence:true,freshnessAware:true,licenseAware:true,promptInjectionIsolation:true,unknownAllowed:true,contradictionsMustBeDisclosed:true},
    sourcePacks:SOURCE_PACKS,
  };
}

export async function searchUniversalKnowledge(query,options={}){
  const started=Date.now();const classification=classifyUniversalKnowledge({message:query,mode:options.mode,knowledge:true});
  const fetchImpl=options.fetchImpl||fetch;
  const basePromise=searchKnowledge(query,{...options,maxSources:clamp(options.maxSources,2,8,6),perSource:clamp(options.perSource,1,8,5),limit:clamp(options.limit,4,30,16)});
  const extras=[];const extraIds=[];
  if(classification.packs.includes('public_data')){extras.push(worldBankSearch(query,{fetchImpl,limit:5}));extraIds.push('world_bank')}
  if(classification.packs.includes('software')){extras.push(npmSearch(query,{fetchImpl,limit:5}));extraIds.push('npm_registry');extras.push(pypiLookup(query,{fetchImpl}));extraIds.push('pypi')}
  const [base,extraSettled]=await Promise.all([basePromise,Promise.allSettled(extras)]);
  const extraRecords=[];const extraStatus=[];
  extraSettled.forEach((result,index)=>{
    const id=extraIds[index];
    if(result.status==='fulfilled'){extraRecords.push(...result.value);extraStatus.push({source_id:id,status:'healthy',count:result.value.length})}
    else extraStatus.push({source_id:id,status:'degraded',count:0,error:text(result.reason?.message||result.reason,180)});
  });
  const understanding=understandKnowledgeQuery(query,{...options,mode:classification.research?'research':options.mode});
  const combined=deduplicateKnowledgeRecords([...arr(base?.records),...extraRecords]);
  const ranked=rerankKnowledgeRecords(combined,understanding).slice(0,clamp(options.limit,4,30,16));
  const citations=ranked.map(citationForRecord);
  const sourceIds=[...new Set([...arr(base?.sources_selected),...extraStatus.filter(x=>x.count>0).map(x=>x.source_id)])];
  return{
    ...base,
    version:UNIVERSAL_KNOWLEDGE_MESH_VERSION,
    contract:UNIVERSAL_KNOWLEDGE_CONTRACT,
    classification,
    sources_selected:sourceIds,
    source_status:[...arr(base?.source_status),...extraStatus],
    documents_retrieved:Number(base?.documents_retrieved||0)+extraRecords.length,
    documents_after_dedup:combined.length,
    documents_used:ranked.length,
    records:ranked,citations,
    universal_knowledge:{version:UNIVERSAL_KNOWLEDGE_MESH_VERSION,packs:classification.packs,domains:classification.domains,extra_sources:extraStatus,omniscience_claim:false,base_model_training:false,method:'federated retrieval + source fusion + verify-before-accept'},
    total_latency_ms:Date.now()-started,
    provenance:{...(base?.provenance||{}),tools_used:[...new Set([...arr(base?.provenance?.tools_used),...extraStatus.filter(x=>x.count>0).map(x=>`knowledge:${x.source_id}`)])],universal_mesh:UNIVERSAL_KNOWLEDGE_MESH_VERSION}
  };
}
