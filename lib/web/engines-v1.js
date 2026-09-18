import { createHash } from 'node:crypto';
import { findSourceByUrl } from './source-registry-v1.js';

export const WEB_EVIDENCE_ENGINES_VERSION = 'web-evidence-engines/v1.0.0';
const clamp = (n,min=0,max=100) => Math.max(min,Math.min(max,Number(n)||0));
const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/[^a-z0-9%$€£¥.-]+/g,' ').replace(/\s+/g,' ').trim();
const tokens = value => new Set(norm(value).split(' ').filter(x => x.length > 2));

const DOMAIN_RULES = [
  ['medicine',/\b(medic|health|salud|clinical|clinico|drug|farmaco|disease|enfermedad|diagnos|treatment|tratamiento)\b/i],
  ['law',/\b(ley|law|legal|jurisprud[a-záéíóúñ]*|tribunal|court|article|articulo|regulation|reglamento|decreto|statute)\b/i],
  ['finance',/\b(financ|stock|accion|market|mercado|inflation|inflacion|fx|exchange rate|bitcoin|crypto|sec filing|earnings)\b/i],
  ['software',/\b(software|api|library|libreria|framework|node|react|python|github|package|version|release|bug|code)\b/i],
  ['cybersecurity',/\b(cve-|vulnerab|exploit|cyber|ciber|malware|security advisory|cvss|cwe|kev)\b/i],
  ['science',/\b(paper|study|estudio|scientific|cientific|doi|research|investigacion|preprint|trial|meta-analysis|systematic review)\b/i],
  ['news',/\b(today|hoy|latest|ultimo|último|breaking|news|noticia|esta semana|this week)\b/i],
  ['business',/\b(company|empresa|revenue|ingresos|competitor|competidor|ceo|funding|valuation|investor)\b/i],
];

export function classifyResearchDomain(query = '') {
  const hits = DOMAIN_RULES.filter(([,rx]) => rx.test(query)).map(([id]) => id);
  return hits[0] || 'general';
}

export function classifyFreshnessRequirement(query = '', domain = classifyResearchDomain(query)) {
  const q = norm(query);
  if (/\b(price|precio|exchange rate|tipo de cambio|bitcoin|stock price|cotizacion|cotización|weather|clima|score|marcador|live|ahora|right now)\b/.test(q)) return 'REAL_TIME';
  if (/\b(today|hoy|latest|ultimo|último|current|actual|ceo|version|release|jurisprud|law|ley vigente|noticia|news|cve|vulnerab)\b/.test(q)) return 'HIGH';
  if (['news','law','software','cybersecurity','finance'].includes(domain)) return 'HIGH';
  if (['science','medicine','business'].includes(domain)) return 'MEDIUM';
  if (/\b(history|historia|born|nacio|capital of|capital de|definition|definicion)\b/.test(q)) return 'LOW';
  return 'MEDIUM';
}

const freshnessTtl = {STATIC:3650,LOW:365,MEDIUM:60,HIGH:7,REAL_TIME:0.04};
export function scoreFreshness({publishedAt, retrievedAt = new Date().toISOString(), requirement = 'MEDIUM'} = {}) {
  if (!publishedAt) return {score: requirement === 'STATIC' ? 85 : 45, ageDays:null, requirement, reason:'publication_date_unknown'};
  const pub = new Date(publishedAt); const ret = new Date(retrievedAt);
  if (Number.isNaN(pub.getTime())) return {score:40, ageDays:null, requirement, reason:'publication_date_invalid'};
  const ageDays = Math.max(0,(ret.getTime()-pub.getTime())/86400000);
  const ttl = freshnessTtl[requirement] ?? 60;
  const score = ttl === 0 ? 100 : clamp(100 * Math.exp(-ageDays / Math.max(ttl,0.04)));
  return {score:Number(score.toFixed(1)), ageDays:Number(ageDays.toFixed(2)), requirement, reason:`age_vs_${requirement.toLowerCase()}_ttl`};
}

export function scoreSourceAuthority(record = {}, {corroborationCount = 0, freshnessRequirement = 'MEDIUM'} = {}) {
  const registry = record.registrySource || findSourceByUrl(record.url || '') || {};
  const reasons = [];
  let score = Number(registry.trustScore ?? registry.reliabilityScore ?? 55);
  if (registry.primarySource) { score += 8; reasons.push('primary_source'); }
  if (registry.officialSource) { score += 6; reasons.push('official_source'); }
  if (registry.governmentSource) { score += 4; reasons.push('government_source'); }
  if (registry.academicSource) { score += 3; reasons.push('academic_source'); }
  if (registry.communitySource) { score -= 18; reasons.push('community_signal_only'); }
  if (registry.sourceType === 'social_signal') { score -= 25; reasons.push('social_signal_only'); }
  const fresh = scoreFreshness({publishedAt:record.publishedAt, retrievedAt:record.retrievedAt, requirement:freshnessRequirement});
  score += (fresh.score - 50) * 0.12;
  if (corroborationCount > 1) { score += Math.min(8, corroborationCount * 2); reasons.push(`corroborated_by_${corroborationCount}`); }
  if (!record.url) { score -= 15; reasons.push('missing_url'); }
  return {
    trustScore:Number(clamp(score).toFixed(1)),
    reasons,
    components:{registryTrust:Number(registry.trustScore ?? registry.reliabilityScore ?? 55), freshness:fresh.score, corroborationCount},
    registrySourceId:registry.id || null,
  };
}

function canonicalUrl(value = '') {
  try {
    const u = new URL(value); u.hash='';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
    return u.toString().replace(/\/$/,'');
  } catch { return String(value||''); }
}

export function deduplicateEvidence(records = []) {
  const map = new Map();
  for (const item of records) {
    const urlKey = canonicalUrl(item.url || '');
    const titleKey = norm(item.title || item.snippet || '').slice(0,300);
    const key = urlKey || titleKey;
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) map.set(key,{...item,corroborationCount:1,providers:[item.provider].filter(Boolean)});
    else {
      existing.corroborationCount += 1;
      existing.providers = [...new Set([...(existing.providers||[]),item.provider].filter(Boolean))];
      if ((item.snippet||'').length > (existing.snippet||'').length) existing.snippet=item.snippet;
      if (!existing.publishedAt && item.publishedAt) existing.publishedAt=item.publishedAt;
    }
  }
  return [...map.values()];
}

function similarity(a,b){
  const A=tokens(a),B=tokens(b); if(!A.size||!B.size)return 0; let hit=0; for(const x of A)if(B.has(x))hit++; return hit/Math.max(A.size,B.size);
}
function extractNumbers(text=''){return [...String(text).matchAll(/(?<![a-z])[-+]?\d+(?:[.,]\d+)?%?/gi)].map(m=>m[0].replace(',','.')).slice(0,12)}

export function detectEvidenceContradictions(records = []) {
  const conflicts=[];
  for(let i=0;i<records.length;i++) for(let j=i+1;j<records.length;j++) {
    const a=records[i],b=records[j]; const sim=similarity(`${a.title} ${a.snippet}`,`${b.title} ${b.snippet}`);
    if(sim<0.55)continue;
    const an=extractNumbers(`${a.title} ${a.snippet}`),bn=extractNumbers(`${b.title} ${b.snippet}`);
    const numericDifference=an.length&&bn.length&&an.some(x=>!bn.includes(x))&&bn.some(x=>!an.includes(x));
    const polarityDifference=/\b(no|not|never|false|falso|niega|denies)\b/i.test(a.snippet||'') !== /\b(no|not|never|false|falso|niega|denies)\b/i.test(b.snippet||'');
    if(numericDifference||polarityDifference)conflicts.push({type:numericDifference?'numeric_or_date_conflict':'polarity_conflict',similarity:Number(sim.toFixed(2)),a:{title:a.title,url:a.url,publishedAt:a.publishedAt,numbers:an},b:{title:b.title,url:b.url,publishedAt:b.publishedAt,numbers:bn},resolutionHint:'Compare publication dates, primary-source status, jurisdiction/version, and the exact underlying claim before synthesizing.'});
  }
  return conflicts.slice(0,20);
}

export function createCitation(record = {}, index = 0) {
  const retrievedAt = record.retrievedAt || new Date().toISOString();
  const excerpt = String(record.snippet || record.excerpt || '').slice(0,1200);
  return {
    key:`W${index+1}`,
    url:record.url || '', title:record.title || '', author:record.author || null,
    publication:record.publication || record.registrySource?.name || null,
    publishedAt:record.publishedAt || null, retrievedAt,
    section:record.section || null, excerpt,
    doi:record.doi || null, jurisdiction:record.registrySource?.jurisdiction || record.jurisdiction || null,
    contentHash:createHash('sha256').update(`${record.url||''}\n${excerpt}`).digest('hex'),
    sourceId:record.registrySource?.id || null,
  };
}

export function buildResearchPlan(query = '', options = {}) {
  const domain = options.domain || classifyResearchDomain(query);
  const freshnessRequirement = options.freshnessRequirement || classifyFreshnessRequirement(query,domain);
  const tasks=[{id:'discovery',kind:'web_search',priority:1,goal:'Discover authoritative and primary sources.'}];
  if(domain==='science'||domain==='medicine')tasks.push({id:'scholar',kind:'scientific_search',priority:1,goal:'Find peer-reviewed literature, registries, and retraction/integrity signals.'});
  if(domain==='law')tasks.push({id:'legal_primary',kind:'legal_search',priority:1,goal:'Find current legislation, court material, jurisdiction and effective date.'});
  if(domain==='software'||domain==='cybersecurity')tasks.push({id:'technical_primary',kind:'technical_search',priority:1,goal:'Find official docs, repositories, releases, advisories and affected versions.'});
  if(domain==='finance'||domain==='business')tasks.push({id:'filings',kind:'financial_primary',priority:1,goal:'Find regulator filings, investor relations and official market data.'});
  if(freshnessRequirement==='HIGH'||freshnessRequirement==='REAL_TIME')tasks.push({id:'recency',kind:'recent_search',priority:1,goal:'Verify the latest state and distinguish publication date from event date.'});
  tasks.push({id:'verification',kind:'cross_check',priority:2,goal:'Cross-check material claims with independent sources and primary evidence when available.'});
  return {schema:'web-research-plan/v1',query,domain,freshnessRequirement,tasks};
}
