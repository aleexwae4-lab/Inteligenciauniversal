export const ENTITY_GROUNDING_VERSION='entity-grounding/v1';

const clean=(s='',n=1600)=>String(s||'').replace(/\s+/g,' ').trim().slice(0,n);
const norm=(s='')=>clean(s,1800).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const KNOWN_ENTITIES=[
  {id:'porsche',aliases:['porsche','porsche ag','dr. ing. h.c. f. porsche','ferdinand porsche','ferry porsche'],domain:'history',anchors:['ferdinand porsche','ferry porsche','porsche 356','porsche 911','zuffenhausen','gmuend','gmünd','stuttgart'],queryTerms:['Porsche history','Ferdinand Porsche','Ferry Porsche','Porsche 356','Porsche 911']},
  {id:'volkswagen',aliases:['volkswagen','vw','volkswagen ag'],domain:'history',anchors:['volkswagen','volkswagen beetle','type 60','käfer'],queryTerms:['Volkswagen history','Volkswagen Type 60','Ferdinand Porsche']},
  {id:'ferrari',aliases:['ferrari','ferrari nv'],domain:'history',anchors:['enzo ferrari','maranello','scuderia ferrari'],queryTerms:['Ferrari history','Enzo Ferrari','Maranello']},
  {id:'tesla',aliases:['tesla','tesla motors','tesla inc'],domain:'business',anchors:['elon musk','tesla model s','tesla model 3','tesla model y'],queryTerms:['Tesla history','Tesla Motors','Tesla Model S']},
  {id:'apple',aliases:['apple','apple inc'],domain:'business',anchors:['steve jobs','steve wozniak','macintosh','iphone'],queryTerms:['Apple history','Steve Jobs','Steve Wozniak','Macintosh']},
  {id:'microsoft',aliases:['microsoft','microsoft corporation'],domain:'business',anchors:['bill gates','paul allen','windows','ms-dos'],queryTerms:['Microsoft history','Bill Gates','Paul Allen','Windows']}
];

const HISTORY_TERMS=/\b(historia|history|origen|fundacion|fundación|fundador|fundadora|evolucion|evolución|cronologia|cronología|trayectoria|nacimiento|inicios|hitos|heritage|origins|founded|founder)\b/i;

export function resolveEntityGrounding(query=''){
  const q=norm(query);
  const matched=KNOWN_ENTITIES.find(entity=>entity.aliases.some(alias=>q.includes(norm(alias))));
  if(matched)return {
    version:ENTITY_GROUNDING_VERSION,
    entityId:matched.id,
    entityName:matched.aliases[0],
    domain:matched.domain,
    anchors:matched.anchors,
    queryTerms:matched.queryTerms,
    explicitEntity:true,
    entityQuery: HISTORY_TERMS.test(q)||/\b(quien es|conoces|conocer|sobre|acerca de|historia de)\b/i.test(q)
  };
  const historyMatch=q.match(/(?:historia|origen|fundacion|fundación|trayectoria|historia de)\s+(?:de\s+)?([a-z0-9][a-z0-9 .&-]{1,80})/i);
  if(historyMatch){
    const candidate=clean(historyMatch[1],100).replace(/[?¿!¡.,;:]+$/,'').trim();
    if(candidate&&candidate.split(/\s+/).length<=8)return {
      version:ENTITY_GROUNDING_VERSION,
      entityId:null,entityName:candidate,domain:'history',anchors:[candidate],queryTerms:[candidate+' history',candidate+' origins'],
      explicitEntity:true,entityQuery:true
    };
  }
  return {version:ENTITY_GROUNDING_VERSION,entityId:null,entityName:null,domain:null,anchors:[],queryTerms:[],explicitEntity:false,entityQuery:false};
}

function textHaystack(record={}){
  return norm([record.title,record.abstract,record.snippet,record.content,record.publication,record.venue,record.author,Array.isArray(record.topics)?record.topics.join(' '):'',Array.isArray(record.keywords)?record.keywords.join(' '):''].join(' '));
}

export function entityEvidenceScore(record={},grounding={}){
  if(!grounding?.explicitEntity)return {score:1,matchedAnchors:[],entityMatch:false,entityMismatch:false};
  const hay=textHaystack(record);
  const exact=grounding.entityName&&hay.includes(norm(grounding.entityName));
  const matched=grounding.anchors.filter(anchor=>hay.includes(norm(anchor))).slice(0,8);
  const score=exact?1:(matched.length?Math.min(.95,.35+.15*matched.length):0);
  return {score:Number(score.toFixed(3)),matchedAnchors:matched,entityMatch:Boolean(exact||matched.length),entityMismatch:!exact&&!matched.length};
}

export function groundEntityRecords(records=[],grounding={}){
  if(!grounding?.explicitEntity)return records;
  return (Array.isArray(records)?records:[]).map(record=>({...record,quality:{...(record.quality||{}),entity_grounding:entityEvidenceScore(record,grounding)}}));
}

export function entityGroundingInstruction(grounding){
  if(!grounding?.explicitEntity)return '';
  return '\n\nANCLAJE DE ENTIDAD ('+ENTITY_GROUNDING_VERSION+'):\n- Entidad principal: '+grounding.entityName+'.\n- La evidencia debe corresponder a esa entidad; una coincidencia de palabras genéricas no demuestra relevancia.\n- Para historia/origen/trayectoria, prioriza fuentes institucionales, históricas o primarias de la entidad y conserva las fuentes que realmente sustentan cada afirmación.\n- Si un registro no contiene la entidad ni señales sustantivas asociadas, no lo uses para responder aunque su título comparta palabras genéricas.\n- No confundas coincidencia lexical con evidencia.\n';
}

export function publicEntityGrounding(grounding){
  if(!grounding)return null;
  return {...grounding};
}
