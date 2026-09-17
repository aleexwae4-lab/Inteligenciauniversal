export const MEMORY_FABRIC_V102='memory-fabric/v102';

const clean=(value,max=72)=>String(value??'').replace(/[^a-zA-Z0-9_.:@-]/g,'_').slice(0,max);
const first=(body,keys)=>{for(const key of keys){if(body?.[key]!==undefined&&body?.[key]!==null&&String(body[key]).trim())return String(body[key])}return''};

export function planMemoryFabricV102(body={},context={}){
  const baseKey=first(body,['userKey','user_id','userId','sessionId','session_id']);
  const ids={organization:first(body,['organizationId','organization_id','orgId','org_id','tenantId','tenant_id']),project:first(body,['projectId','project_id']),client:first(body,['clientId','client_id']),case:first(body,['caseId','case_id','expedienteId','expediente_id']),laboratory:first(body,['labId','lab_id','laboratoryId','laboratory_id']),course:first(body,['courseId','course_id'])};
  const activeScopes=Object.entries(ids).filter(([,value])=>String(value||'').trim()).map(([scope])=>scope);
  const partitions=Object.entries(ids).filter(([,value])=>String(value||'').trim()).map(([scope,value])=>`${scope}:${clean(value)}`);
  const partitioned=Boolean(baseKey&&partitions.length);const scopedUserKey=partitioned?`${clean(baseKey,90)}::${partitions.join('::')}`.slice(0,180):baseKey||'';
  const semanticScopes=['conversation',context.operator?.profession?'professional':null,context.operator?.organization?'organizational':null,context.operator?.project?'project':null,...activeScopes].filter(Boolean);
  return{version:MEMORY_FABRIC_V102,partitioned,scopedUserKey,scopes:[...new Set(semanticScopes)],isolation:partitioned?'strict_explicit_scope':'user_session_scope',writePolicy:'store_relevant_context_only',crossScopeLeakage:'deny'};
}

export function publicMemoryFabricV102(plan={}){return{version:MEMORY_FABRIC_V102,partitioned:plan.partitioned===true,scopes:Array.isArray(plan.scopes)?plan.scopes:[],isolation:plan.isolation||'user_session_scope',writePolicy:plan.writePolicy||'store_relevant_context_only',crossScopeLeakage:'deny'}}
export function memoryInstructionV102(plan={}){const scopes=(plan.scopes||[]).join(', ')||'conversation';return `MEMORY FABRIC: usa únicamente memoria pertinente a estos ámbitos: ${scopes}. No mezcles expedientes, proyectos, clientes, organizaciones, laboratorios o cursos entre particiones. La memoria privada sirve como contexto, no como evidencia externa independiente.`}
