// Small, dated research index. This is not live search, not model training, and
// never an official staff register. Entries are narrow and carry full provenance.
// Expand only with separately checked primary/secondary publications.
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const entries=[
 {
  id:'anthropic-engineering-linkedin-2026-06',
  company:'Anthropic',
  observed:1680,
  sample:5306,
  asOf:'2026-06-15',
  analyst:'Sebastian Cuadros',
  source:'https://www.techtimes.com/articles/318396/20260615/anthropic-engineering-team-infrastructure-army-new-analysis-1680-engineers.htm',
  publication:'TechTimes',
  scope:'perfiles públicos de LinkedIn que declaraban Anthropic como empleador; 1.680 perfiles clasificados en funciones de ingeniería, no todos dedicados a entrenar Claude'
 }
];
export function datedResearchAnswer(question=''){
 const q=norm(question);
 if(q.length>800||!/\b(?:anthropic|antropic)\b/.test(q)||!/\b(?:ingenier\w*|engineer\w*)\b/.test(q))return null;
 if(!/\b(?:cuant[oa]s?|numero|cantidad|total|plantilla|empleados|personal|how many|headcount)\b/.test(q))return null;
 if(/\b(?:sin fuentes|sin citas|no uses fuentes)\b/.test(q))return null;
 const e=entries[0];
 return {
  reply:'**Una investigación publicada el 15 de junio de 2026 identificó aproximadamente 1.680 ingenieros en Anthropic**, al clasificar 5.306 perfiles de LinkedIn que señalaban a la empresa como empleador.\n\nNo es un censo oficial ni la cifra exacta actual: abarca distintos puestos de ingeniería y no permite saber cuántas personas trabajan exclusivamente en el entrenamiento de Claude. [Fuente: '+e.publication+']('+e.source+').',
  source:{title:e.publication+' · '+e.asOf,url:e.source,publishedAt:e.asOf,scope:e.scope},
  id:e.id,asOf:e.asOf
 };
}
