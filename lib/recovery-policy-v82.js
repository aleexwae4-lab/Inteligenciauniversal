export const RECOVERY_POLICY_V82='recovery-policy/v82';

const GREETING_PREFIX=/^\s*(?:hola|hey|buenas|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches)\b[\s,;:!¡.¿?\-–—]*/i;
const PURE_CASUAL=/^\s*(?:hola|hey|buenas|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|gracias|muchas\s+gracias|ok|vale|perfecto|listo|qu[eé]\s+tal|c[oó]mo\s+est[aá]s)\s*[!¡?.¿]*\s*$/i;
const MEMORY=/\b(recuerda|recordar|memoria|recupera\s+de\s+tu\s+memoria|conversaci[oó]n\s+nueva|datos\s+del\s+proyecto)\b/i;
const TRANSFORM=/\b(traduce|traducci[oó]n|corrige\s+ortograf[ií]a|ortograf[ií]a|reescribe|reformula|resume\s+este\s+texto|resumir\s+este\s+texto)\b/i;
const CREATIVE=/\b(escribe|redacta|crea|genera|inventa|poema|cuento|gui[oó]n|copy|correo|mensaje|publicaci[oó]n|post|lema|slogan)\b/i;
const HIGH_RISK=/\b(diagn[oó]stic|tratamiento|dosis|medicamento|legal|jur[ií]dic|penal|delito|fiscal|tributar|inversi[oó]n|cr[eé]dito|fraude)\b/i;
const FACTUAL=/^(?:para\s+qu[eé]|por\s+qu[eé]|qu[eé]|qui[eé]n|cu[aá]l|cu[aá]nto|d[oó]nde|cu[aá]ndo|c[oó]mo|define|explica|sirve[n]?|funciona[n]?)\b/i;
const TECHNICAL=/\b(gpu|cpu|ia|inteligencia\s+artificial|api|backend|frontend|software|hardware|servidor|base\s+de\s+datos|programaci[oó]n|typescript|javascript|python|sql|arquitectura|modelo|algoritmo|red\s+neuronal|cloud|nube)\b/i;
const RESEARCH=/\b(investiga|investigaci[oó]n|fuentes?|evidencia|web|benchmark|estad[ií]stica|paper|estudio|cient[ií]fic)\b/i;

export function stripGreetingPrefix(value=''){
  const raw=String(value||'').trim();
  if(!raw)return'';
  const stripped=raw.replace(GREETING_PREFIX,'').trim();
  return stripped||raw;
}

export function sameOriginKnowledgeEligible(message='',mode='general'){
  const raw=String(message||'').trim();
  if(raw.length<3||PURE_CASUAL.test(raw))return false;
  const intent=stripGreetingPrefix(raw);
  if(!intent||intent.length<4)return false;
  if(MEMORY.test(intent)||TRANSFORM.test(intent)||CREATIVE.test(intent)||HIGH_RISK.test(intent))return false;
  if(String(mode||'general').toLowerCase()==='research')return true;
  if(FACTUAL.test(intent)||TECHNICAL.test(intent)||RESEARCH.test(intent))return true;
  return intent.length>=48&&/[?¿]/.test(intent);
}
