function clip(value,max=900){const s=String(value??'').replace(/\s+/g,' ').trim();return s.length>max?`${s.slice(0,max)}…`:s}

function evidenceFromTools(toolResults=[]){
  const blocks=[];
  for(const item of toolResults){
    if(!item?.ok||!Array.isArray(item.data)||!item.data.length)continue;
    if(item.tool==='web_search'){
      const rows=item.data.slice(0,5).map((x,i)=>`- [W${i+1}] ${clip(x.title||'Fuente',180)} — ${clip(x.content||'',500)}${x.url?`\n  ${clip(x.url,900)}`:''}`);
      if(rows.length)blocks.push(`## Evidencia web recuperada\n${rows.join('\n')}`);
    }
    if(item.tool==='github_search'){
      const rows=item.data.slice(0,8).map(x=>`- ${clip(x.repository||'',160)} · ${clip(x.path||x.name||'',300)}${x.url?` — ${clip(x.url,900)}`:''}`);
      if(rows.length)blocks.push(`## Evidencia de GitHub recuperada\n${rows.join('\n')}`);
    }
  }
  return blocks;
}

function evidenceFromAttachments(attachments=[]){
  if(!attachments.length)return null;
  const rows=attachments.slice(0,5).map((x,i)=>`- Archivo ${i+1}: **${clip(x.name||'sin nombre',180)}** (${clip(x.type||'texto',80)}). Extracto literal: “${clip(x.text||'',500)}”`);
  return `## Archivos disponibles\n${rows.join('\n')}`;
}

export function buildContinuityResult({message='',attachments=[],memory=[],toolResults=[],failures=[]}={}){
  const sections=[
    '# Universal Core · modo de continuidad',
    'Los motores generativos externos no están disponibles o no son confiables en este momento. Mantengo la operación sin fabricar una respuesta.',
    ...evidenceFromTools(toolResults)
  ];
  const files=evidenceFromAttachments(attachments);if(files)sections.push(files);
  if(memory.length)sections.push(`## Memoria\nSe recuperaron ${memory.length} registros de contexto de esta sesión. No los expongo automáticamente en modo degradado para evitar fugas de información.`);
  sections.push(`## Solicitud preservada\n${clip(message,1800)}`);
  sections.push('## Estado\nLa solicitud permanece disponible para reintento automático por los carriles generativos. La evidencia mostrada arriba es literal; no contiene inferencias nuevas del modelo.');
  return{
    text:sections.filter(Boolean).join('\n\n'),
    provider:'universal_continuity_core',
    model:'deterministic-evidence-v1',
    usage:null,
    responseId:null,
    failures:Array.isArray(failures)?failures:[],
    degraded:true
  };
}
