export const VISIBLE_RELEVANCE_V84='visible-answer-relevance/v84';

const STOP=new Set('que qué como cómo cual cuál cuales cuáles para por con sin una uno unos unas del las los el la y o de en es son ser se su sus al un ya mas más muy este esta estos estas esto esa ese esos esas mi mis tu tus lo le les nos me te a e u si no pero sobre entre desde hasta explica explicar explicame explícame dime respuesta responde oracion oraciones frase frases breve breves why what how which where when who the and or for with without from into this that these those your you our are is be was were explain answer sentences sentence short'.split(/\s+/));
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const terms=value=>normalize(value).match(/[a-z0-9]{4,}/g)?.filter(w=>!STOP.has(w))||[];
const unique=xs=>[...new Set(xs)];

export function relevanceProfile(question='',answer=''){
  const q=unique(terms(question)).slice(0,18),a=new Set(terms(answer));
  const anchors=q.filter(w=>w.length>=7||/^[a-z]+(?:leigh|ismo|cion|tion|osis|scope|graph|quantum|fot[oó]n)$/i.test(w));
  const matched=q.filter(w=>a.has(w)),matchedAnchors=anchors.filter(w=>a.has(w));
  const ratio=q.length?matched.length/q.length:1;
  const anchorRequired=anchors.length>0;
  const pass=anchorRequired?matchedAnchors.length>0&&ratio>=.2:ratio>=.35;
  return{schema:VISIBLE_RELEVANCE_V84,pass,queryTerms:q,anchors,matched,matchedAnchors,ratio:Number(ratio.toFixed(3))};
}

export function visibleFallbackRelevant(question='',payload={}){
  const answer=String(payload?.reply??payload?.response?.content??'').trim();
  if(!answer)return false;
  return relevanceProfile(question,answer).pass;
}
