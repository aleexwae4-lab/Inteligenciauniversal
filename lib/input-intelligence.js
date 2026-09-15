const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const ELECTRICITY_CUES=[
  /\belectric(?:idad|o|a|os|as)?\b/,
  /\bcircuit(?:o|os)?\b/,
  /\bvolt(?:aje|ajes|io|ios|s)?\b/,
  /\bresist(?:encia|encias|or|ores)\b/,
  /\bcorriente\b/,
  /\bamper(?:io|ios|aje|ajes|e|es)?\b/,
  /\bgenerador(?:es)?\b/,
  /\baislante(?:s)?\b/,
  /\bfrecuencia(?:s)?\b/,
  /\bhertz\b/,
  /\bpotencia\b/,
  /\bohm(?:io|ios|s)?\b/,
  /\bwatt(?:s|io|ios)?\b/,
  /\bdiodo(?:s)?\b/,
  /\bcapacit(?:or|ores|ancia)\b/,
  /\binduct(?:or|ores|ancia)\b/,
  /\btransistor(?:es)?\b/
];
const CHEMISTRY_CUES=[/\bquimic(?:a|o|as|os)\b/,/\belemento(?:s)?\b/,/\bnumero atomico\b/,/\btabla periodica\b/,/\bhalogeno(?:s)?\b/,/\bmolecula(?:s)?\b/];

const countMatches=(text,rules)=>rules.reduce((sum,rx)=>sum+(rx.test(text)?1:0),0);

function replaceTracked(text,rx,replacement,corrections){
  return text.replace(rx,match=>{
    if(fold(match)===fold(replacement))return match;
    corrections.push({from:match,to:replacement});
    return replacement;
  });
}

export function normalizeUserIntent(value=''){
  const original=String(value||'').trim();
  if(!original)return{original,text:'',changed:false,domain:null,confidence:0,corrections:[]};
  const lexical=fold(original),electricalScore=countMatches(lexical,ELECTRICITY_CUES),chemistryScore=countMatches(lexical,CHEMISTRY_CUES);
  const corrections=[];
  let text=original,domain=null,confidence=0;

  if(electricalScore>=2){
    domain='electricity';
    confidence=Math.min(.99,.78+(electricalScore-2)*.045);
    if(chemistryScore===0)text=replaceTracked(text,/\b(?:iodo|yodo)\b/gi,'diodo',corrections);
    text=replaceTracked(text,/\b(?:what|wat|guat)\b/gi,'watt',corrections);
    text=replaceTracked(text,/\bomios\b/gi,'ohmios',corrections);
    text=replaceTracked(text,/\bomio\b/gi,'ohmio',corrections);
  }

  const unique=[];const seen=new Set();
  for(const item of corrections){const key=`${fold(item.from)}>${fold(item.to)}`;if(!seen.has(key)){seen.add(key);unique.push(item)}}
  return{original,text,changed:text!==original,domain,confidence:Number(confidence.toFixed(2)),corrections:unique};
}

export function formatIntentInterpretation(intent={}){
  if(!intent.changed||!Array.isArray(intent.corrections)||!intent.corrections.length)return'';
  const changes=intent.corrections.map(x=>`“${x.from}” → “${x.to}”`).join(', ');
  return `Interpretación contextual de entrada: ${changes}. Dominio probable: ${intent.domain||'general'}. La normalización se aplicó sólo porque el contexto aporta evidencia suficiente; responde a la intención normalizada y no conviertas la respuesta en una discusión sobre errores de dictado.`;
}
