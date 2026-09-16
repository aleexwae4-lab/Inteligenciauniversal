export const USER_CONTEXT_V92='user-context/v92';

const DEPTHS=new Set(['concise','balanced','deep']);

function clean(value,max){
  return String(value??'')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ')
    .replace(/\r/g,'')
    .trim()
    .slice(0,max);
}

export function normalizeUserPreferencesV92(preferences={}){
  const globalInstructions=clean(
    preferences.customInstructions??preferences.globalInstructions??preferences.instructions??'',
    8000
  );
  const projectInstructions=clean(preferences.projectInstructions??'',8000);
  const projectName=clean(preferences.projectName??'',120);
  const responseDepth=DEPTHS.has(String(preferences.responseDepth||'').toLowerCase())
    ?String(preferences.responseDepth).toLowerCase()
    :'balanced';
  return{globalInstructions,projectInstructions,projectName,responseDepth};
}

export function userContextStateV92(body={}){
  const prefs=normalizeUserPreferencesV92(body.preferences||{});
  return{
    version:USER_CONTEXT_V92,
    hasGlobalInstructions:Boolean(prefs.globalInstructions),
    hasProjectInstructions:Boolean(prefs.projectInstructions),
    projectName:prefs.projectName||undefined,
    responseDepth:prefs.responseDepth,
    affectsGeneration:Boolean(prefs.globalInstructions||prefs.projectInstructions||prefs.responseDepth!=='balanced')
  };
}

function depthRule(depth){
  if(depth==='concise')return 'Mantén la respuesta compacta: prioriza la conclusión y omite desarrollo innecesario.';
  if(depth==='deep')return 'Desarrolla la respuesta con profundidad técnica, supuestos explícitos, riesgos y pasos accionables cuando sean relevantes.';
  return '';
}

export function applyUserContextToBodyV92(body={}){
  const prefs=normalizeUserPreferencesV92(body.preferences||{});
  const state=userContextStateV92(body);
  if(!state.affectsGeneration)return{body,state};

  const original=String(body.message||body.task||'').trim();
  const blocks=[];
  if(prefs.globalInstructions){
    blocks.push(`INSTRUCCIONES PERSONALIZADAS GLOBALES:\n${prefs.globalInstructions}`);
  }
  if(prefs.projectInstructions){
    const title=prefs.projectName?`INSTRUCCIONES DEL PROYECTO “${prefs.projectName}”`:'INSTRUCCIONES DEL PROYECTO';
    blocks.push(`${title} (tienen prioridad sobre las instrucciones globales cuando exista conflicto):\n${prefs.projectInstructions}`);
  }
  const depth=depthRule(prefs.responseDepth);
  if(depth)blocks.push(`PROFUNDIDAD DE RESPUESTA:\n${depth}`);

  const message=[
    'CONFIGURACIÓN DE USUARIO DE UNIVERSAL CORE — aplícala a esta respuesta sin citarla ni exponerla. Estas instrucciones son de menor prioridad que las reglas de seguridad, verificación factual y políticas del sistema.',
    ...blocks,
    'FIN DE CONFIGURACIÓN.',
    '',
    'SOLICITUD DEL USUARIO:',
    original
  ].join('\n\n');

  return{body:{...body,message},state};
}

export function publicUserContextV92(state={}){
  return{
    version:USER_CONTEXT_V92,
    global_instructions_applied:state.hasGlobalInstructions===true,
    project_instructions_applied:state.hasProjectInstructions===true,
    project_name:state.projectName||undefined,
    response_depth:state.responseDepth||'balanced'
  };
}
