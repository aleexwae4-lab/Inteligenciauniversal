export const SCIENTIFIC_EVIDENCE_VERSION='scientific-evidence/v2';
export const RESEARCH_INTEGRITY_VERSION='research-integrity/v2';

const arr=value=>Array.isArray(value)?value:[];
const text=(value,max=6000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const SCIENCE_DOMAINS=new Set(['medicine','biology','physics','computer_science','mathematics','economics','engineering','science','health']);

export function isScientificContext(understanding={}){
  return arr(understanding.domains).some(domain=>SCIENCE_DOMAINS.has(String(domain).toLowerCase()));
}

export function classifyScientificStudy(record={}){
  const source=String(record.source?.id||'').toLowerCase();
  const raw=record.raw_metadata||{};
  const hay=norm([
    record.type,
    record.title,
    record.quality?.publication_type,
    arr(raw.pubtype).join(' '),
    arr(raw.publicationTypes).join(' '),
    raw.type,
    raw.documentType
  ].filter(Boolean).join(' '));

  if(source==='arxiv'||/\b(preprint|working paper)\b/.test(hay))return'preprint';
  if(/\b(meta[-\s]?analysis|metaanalysis|meta[-\s]?analisis)\b/.test(hay))return'meta_analysis';
  if(/\b(systematic review|revision sistematica|revisi[oó]n sistematica)\b/.test(hay))return'systematic_review';
  if(/\b(randomized controlled trial|randomised controlled trial|controlled clinical trial|ensayo clinico aleatorizado|ensayo controlado aleatorizado)\b/.test(hay))return'randomized_controlled_trial';
  if(/\b(cohort|case control|cross sectional|observational|prospective study|retrospective study|estudio observacional|cohorte|casos y controles|transversal)\b/.test(hay))return'observational_study';
  if(/\b(case report|case study|reporte de caso|informe de caso)\b/.test(hay))return'case_report';
  if(/\b(editorial|commentary|letter to the editor|perspective)\b/.test(hay))return'editorial';
  if(/\b(review|revision|revisi[oó]n)\b/.test(hay))return'review';
  if(/\b(conference|proceedings|workshop)\b/.test(hay))return'conference_paper';
  if(record.type==='dataset'||/\b(dataset|data set)\b/.test(hay))return'dataset';
  if(record.type==='book'||/\b(book|monograph)\b/.test(hay))return'book';
  return record.type==='paper'?'research_article':'unclassified';
}

export function researchIntegrityCheck(record={}){
  const q=record.quality||{};
  const raw=record.raw_metadata||{};
  const source=String(record.source?.id||'').toLowerCase();
  const statusText=norm([q.retraction_status,arr(raw.pubtype).join(' '),JSON.stringify(raw.updates||[]),JSON.stringify(raw.relation||{})].join(' '));
  const reasons=[];
  let status='clear_or_unknown';
  let action='allow_with_normal_caution';

  if(/\bretract/.test(statusText)){
    status='retracted';action='exclude_from_supporting_claims';reasons.push('retraction_signal');
  }else if(/expression of concern|concern notice|editorial concern/.test(statusText)){
    status='expression_of_concern';action='use_only_with_prominent_warning';reasons.push('expression_of_concern');
  }else if(/correction|erratum|corrigendum|update/.test(statusText)){
    status='corrected_or_updated';action='prefer_latest_version';reasons.push('correction_or_update_signal');
  }

  const studyType=classifyScientificStudy(record);
  if(studyType==='preprint')reasons.push('preprint_not_final_publication');
  if(source==='arxiv'&&studyType==='preprint')action=action==='allow_with_normal_caution'?'preliminary_evidence_only':action;

  return{
    version:RESEARCH_INTEGRITY_VERSION,
    status,
    action,
    reasons:[...new Set(reasons)],
    usable_for_supporting_claims:status!=='retracted',
    final_publication_verified:false,
    checked_signals:['record.quality.retraction_status','raw_metadata.pubtype','raw_metadata.updates','raw_metadata.relation','source_type']
  };
}

function evidenceStage(studyType,integrity){
  if(integrity.status==='retracted')return'compromised';
  if(integrity.status==='expression_of_concern')return'contested_integrity';
  if(studyType==='preprint')return'preliminary';
  if(studyType==='meta_analysis'||studyType==='systematic_review')return'synthesized_evidence';
  if(studyType==='randomized_controlled_trial')return'controlled_evidence';
  if(studyType==='observational_study')return'observational_evidence';
  if(studyType==='case_report')return'case_level_evidence';
  if(studyType==='review')return'narrative_synthesis';
  return'unclassified_evidence';
}

function designWeight(studyType){
  switch(studyType){
    case'meta_analysis':return 1.08;
    case'systematic_review':return 1.06;
    case'randomized_controlled_trial':return 1.05;
    case'observational_study':return 1.00;
    case'research_article':return 1.00;
    case'review':return 0.96;
    case'conference_paper':return 0.92;
    case'case_report':return 0.88;
    case'preprint':return 0.78;
    case'editorial':return 0.72;
    default:return 0.95;
  }
}

export function scientificEvidenceProfile(record={},understanding={}){
  const studyType=classifyScientificStudy(record);
  const integrity=researchIntegrityCheck(record);
  let weight=designWeight(studyType);
  if(integrity.status==='retracted')weight=0.12;
  else if(integrity.status==='expression_of_concern')weight=Math.min(weight,0.55);
  else if(integrity.status==='corrected_or_updated')weight=Math.min(weight,0.95);

  return{
    version:SCIENTIFIC_EVIDENCE_VERSION,
    applicable:isScientificContext(understanding)||['paper','dataset'].includes(record.type),
    study_type:studyType,
    evidence_stage:evidenceStage(studyType,integrity),
    peer_review_status:studyType==='preprint'?'preprint':(record.quality?.peer_review_status||'unknown'),
    integrity,
    ranking_multiplier:Number(weight.toFixed(3)),
    interpretation:integrity.status==='retracted'?'do_not_use_as_supporting_evidence':studyType==='preprint'?'preliminary_not_peer_reviewed':'requires_contextual_appraisal'
  };
}

export function applyScientificEvidenceProfiles(records=[],understanding={}){
  return arr(records).map(record=>{
    const scientific=scientificEvidenceProfile(record,understanding);
    return{...record,quality:{...(record.quality||{}),scientific}};
  });
}

function canonicalDoi(record){return String(record?.identifiers?.doi||'').trim().toLowerCase()}
function titleKey(record){return norm(record?.title||'').replace(/[^a-z0-9]+/g,' ').trim()}

export function detectResearchIntegrityConflicts(records=[]){
  const groups=new Map();
  for(const record of arr(records)){
    const doi=canonicalDoi(record);if(!doi)continue;
    if(!groups.has(doi))groups.set(doi,[]);groups.get(doi).push(record);
  }
  const conflicts=[];
  for(const [doi,items] of groups){
    if(items.length<2)continue;
    const titles=new Set(items.map(titleKey).filter(Boolean));
    const years=new Set(items.map(x=>String(x.publicationDate||'').slice(0,4)).filter(Boolean));
    const integrityStates=new Set(items.map(x=>x.quality?.scientific?.integrity?.status||researchIntegrityCheck(x).status));
    const issues=[];
    if(titles.size>1)issues.push('title_mismatch_same_doi');
    if(years.size>1)issues.push('publication_year_mismatch_same_doi');
    if(integrityStates.size>1)issues.push('integrity_status_mismatch_same_doi');
    if(issues.length)conflicts.push({doi,issues,sources:[...new Set(items.map(x=>x.source?.id).filter(Boolean))],record_count:items.length});
  }
  return conflicts;
}

export function scientificEvidenceSummary(records=[]){
  const summary={total:0,preprints:0,retracted:0,systematic_reviews:0,meta_analyses:0,randomized_trials:0,observational:0,case_reports:0,usable_for_supporting_claims:0};
  for(const record of arr(records)){
    const profile=record.quality?.scientific||scientificEvidenceProfile(record,{});summary.total++;
    if(profile.study_type==='preprint')summary.preprints++;
    if(profile.study_type==='systematic_review')summary.systematic_reviews++;
    if(profile.study_type==='meta_analysis')summary.meta_analyses++;
    if(profile.study_type==='randomized_controlled_trial')summary.randomized_trials++;
    if(profile.study_type==='observational_study')summary.observational++;
    if(profile.study_type==='case_report')summary.case_reports++;
    if(profile.integrity?.status==='retracted')summary.retracted++;
    if(profile.integrity?.usable_for_supporting_claims!==false)summary.usable_for_supporting_claims++;
  }
  return{version:SCIENTIFIC_EVIDENCE_VERSION,...summary};
}
