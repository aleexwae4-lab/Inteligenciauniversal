export const MULTIMODAL_EVIDENCE_GRAPH_VERSION='multimodal-evidence-graph/v1';

function clean(v,max=500){return String(v??'').replace(/\s+/g,' ').trim().slice(0,max)}
function kindOf(a){return String(a?.kind||'unknown')}
function evidenceId(prefix,index){return prefix+'-'+(index+1)}

export function buildMultimodalEvidenceGraph(attachments=[]){
  const files=Array.isArray(attachments)?attachments.slice(0,8):[];
  const nodes=[],edges=[];
  files.forEach((a,i)=>{
    const fileId=evidenceId('file',i);
    nodes.push({id:fileId,type:'file',kind:kindOf(a),name:clean(a.name,180),mime:clean(a.mime,120),verified:true});
    if(String(a.text||'').trim()){
      const textId=evidenceId('text',i);
      nodes.push({id:textId,type:'extracted_text',kind:'text',text:clean(a.text,2000),verified:true});
      edges.push({from:fileId,to:textId,relation:'contains_extracted_text',verified:true});
    }
    if(a.url||a.dataUrl){
      const inputId=evidenceId('input',i);
      nodes.push({id:inputId,type:'model_input',kind:kindOf(a),verified:true});
      edges.push({from:fileId,to:inputId,relation:'available_to_multimodal_model',verified:true});
    }
  });
  return {
    version:MULTIMODAL_EVIDENCE_GRAPH_VERSION,
    nodeCount:nodes.length,
    edgeCount:edges.length,
    nodes,
    edges,
    evidencePolicy:{
      verifiedOnly:true,
      noSyntheticNodes:true,
      noUnsupportedClaims:true,
      provenanceRequired:true
    }
  };
}

export function evidenceGraphInstruction(graph){
  if(!graph||!graph.nodeCount)return '';
  return '\n\nGRAFO DE EVIDENCIA MULTIMODAL ('+MULTIMODAL_EVIDENCE_GRAPH_VERSION+'):\n'+
    '- Usa el grafo como mapa de procedencia, no como evidencia adicional.\n'+
    '- Cada afirmación sobre un archivo debe poder vincularse a un nodo de archivo, entrada multimodal o texto extraído.\n'+
    '- No conviertas inferencias del modelo en hechos verificados.\n'+
    '- Si varios archivos contienen evidencia relacionada, puedes cruzarlos, pero conserva la procedencia de cada pieza.\n'+
    '- Si no existe evidencia suficiente, declara la limitación.\n';
}

export function publicEvidenceGraph(graph){
  return {version:MULTIMODAL_EVIDENCE_GRAPH_VERSION,nodeCount:graph?.nodeCount||0,edgeCount:graph?.edgeCount||0,nodes:(graph?.nodes||[]).slice(0,32),edges:(graph?.edges||[]).slice(0,64),evidencePolicy:graph?.evidencePolicy||{verifiedOnly:true,noSyntheticNodes:true,noUnsupportedClaims:true,provenanceRequired:true}};
}