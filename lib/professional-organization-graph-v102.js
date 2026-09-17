export const PROFESSIONAL_ORG_GRAPH_V102='professional-organization-graph/v102';

const PROFILE={
  forensic:{specialists:['forensic_examiner','digital_evidence_analyst','chain_of_custody_auditor','timeline_analyst','forensic_qa'],capabilities:['evidence_integrity','chain_of_custody','forensic_timeline','metadata_analysis','hypothesis_testing','contradiction_detection','forensic_reporting'],workspace:['cases','evidence','hashes','chain_of_custody','laboratory','reports'],risk:'high'},
  legal:{specialists:['legal_research','litigation_strategy','evidence_analysis','procedural_analysis','legal_drafting','legal_qa'],capabilities:['issue_spotting','authority_research','argument_analysis','counterarguments','procedural_timeline','document_drafting','citation_review'],workspace:['cases','authorities','evidence','filings','timeline','documents'],risk:'high'},
  engineering:{specialists:['systems_engineer','domain_engineer','data_analyst','safety_engineer','qa_engineer','project_engineer'],capabilities:['requirements','root_cause_analysis','fmea','trade_study','simulation_planning','test_design','technical_documentation','project_planning'],workspace:['projects','requirements','simulations','specifications','tests','diagrams'],risk:'medium'},
  software:{specialists:['software_architect','full_stack_engineer','backend_engineer','frontend_engineer','devops_sre','qa_engineer','security_engineer'],capabilities:['architecture','code_generation','debugging','testing','deployment','observability','security_review','database_design'],workspace:['repositories','code','apis','deployments','tests','logs'],risk:'medium'},
  executive:{specialists:['ceo_strategy','cfo','coo','product','growth','legal_risk','operations'],capabilities:['strategy','financial_analysis','operations','product_planning','growth','risk_management','decision_support','kpi_design'],workspace:['decisions','finance','operations','sales','risks','kpis'],risk:'medium'},
  academic:{specialists:['subject_matter_expert','curriculum_designer','research_analyst','assessment_designer','teaching_assistant'],capabilities:['curriculum_design','lesson_planning','research_synthesis','bibliography','assessment','rubrics','feedback'],workspace:['courses','classes','research','bibliography','assessments','materials'],risk:'medium'},
  government:{specialists:['public_policy','operations','legal_compliance','budget_analyst','risk_analyst','program_manager'],capabilities:['policy_analysis','public_operations','budgeting','compliance','program_design','risk_management','public_reporting'],workspace:['programs','policy','budget','operations','compliance','reports'],risk:'high'},
  health:{specialists:['clinical_evidence','health_operations','data_analyst','safety_review'],capabilities:['evidence_synthesis','clinical_workflow','medical_literature','data_analysis','safety_review','patient_communication_support'],workspace:['cases','evidence','workflows','literature','reports'],risk:'high'},
  finance:{specialists:['cfo','financial_analyst','accounting','treasury','risk_analyst'],capabilities:['financial_modeling','cash_flow','unit_economics','budgeting','valuation','risk_analysis','financial_reporting'],workspace:['finance','models','cashflow','budgets','risks','reports'],risk:'high'},
  creative:{specialists:['creative_director','content_strategist','copywriter','brand_strategist','producer'],capabilities:['content_strategy','copywriting','storytelling','campaign_design','brand_systems','production_planning'],workspace:['briefs','content','campaigns','scripts','assets'],risk:'low'},
  general:{specialists:['general_analyst'],capabilities:['analysis','planning','writing','research','problem_solving'],workspace:['chat','projects','documents'],risk:'low'}
};

const unique=items=>[...new Set(items.filter(Boolean))];
export function profileForDomainV102(domain='general'){return PROFILE[domain]||PROFILE.general}

export function buildProfessionalOrganizationGraphV102(context={}){
  const operatorDomain=String(context.operatorDomain||'general');
  const taskDomain=String(context.task?.domain||'general');
  const domains=unique([operatorDomain!=='general'?operatorDomain:null,taskDomain!=='general'&&taskDomain!=='multidisciplinary'?taskDomain:null]);
  const selected=domains.length?domains:['general'];
  const profiles=selected.map(profileForDomainV102);
  return{version:PROFESSIONAL_ORG_GRAPH_V102,domains:selected,primaryDomain:String(context.task?.workingDomain||selected[0]||'general'),nodes:{person:Boolean(context.operator?.profession||context.operator?.role),profession:selected,organization:Boolean(context.operator?.organization),project:Boolean(context.operator?.project),task:true,outcome:true},specialists:unique(profiles.flatMap(p=>p.specialists)).slice(0,12),capabilities:unique(profiles.flatMap(p=>p.capabilities)).slice(0,24),workspace:unique(profiles.flatMap(p=>p.workspace)).slice(0,18),risk:profiles.some(p=>p.risk==='high')?'high':profiles.some(p=>p.risk==='medium')?'medium':'low'};
}
