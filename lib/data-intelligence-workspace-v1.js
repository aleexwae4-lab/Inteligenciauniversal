export const DATA_INTELLIGENCE_WORKSPACE_VERSION='data-intelligence-workspace/v1';

function rankFindings(report=[]){
 const findings=[];
 for(const r of report){if(r.type!=='tabular')continue;
  const q=r.quality||{}, missing=Object.entries(q.missing||{}).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
  if(q.duplicateRows>0)findings.push({type:'data_quality',severity:q.duplicateRate>.1?'high':'medium',file:r.file,message:`Se detectaron ${q.duplicateRows} filas duplicadas (${(q.duplicateRate*100).toFixed(1)}%).`});
  if(missing.length)findings.push({type:'data_quality',severity:'medium',file:r.file,message:`La columna ${missing[0][0]} presenta ${missing[0][1]} valores faltantes.`});
  for(const [column,items] of Object.entries(r.outliers||{})){if(items.length)findings.push({type:'anomaly',severity:'medium',file:r.file,column,message:`Se detectaron ${items.length} valores atípicos mediante IQR.`})}
  const strong=(r.correlations||[]).filter(x=>Math.abs(x.r)>=.7).sort((a,b)=>Math.abs(b.r)-Math.abs(a.r))[0];
  if(strong)findings.push({type:'relationship',severity:'info',file:r.file,message:`Correlación fuerte entre ${strong.x} y ${strong.y}: r=${strong.r}.`});
  if(r.experiment)findings.push({type:'experiment',severity:'info',file:r.file,message:`Comparación A/B detectada entre ${r.experiment.groups.join(' y ')} sobre ${r.experiment.metricColumn}; el p-value es aproximado.`});
 }
 return findings.slice(0,20);
}
function classify(report=[]){if(!report.length)return'empty';if(report.some(r=>r.type==='tabular'&&r.experiment))return'experiment';if(report.some(r=>r.temporal))return'time_series';if(report.some(r=>r.network))return'network';if(report.some(r=>r.type==='text'))return'text';return'tabular';}
export function buildDataIntelligenceWorkspace(report=[]){
 const findings=rankFindings(report),kind=classify(report);
 const actions=findings.slice(0,6).map(f=>f.type==='data_quality'?'Revisar calidad y reglas de validación':f.type==='anomaly'?'Investigar valores atípicos':'Validar la relación con datos adicionales');
 return{version:DATA_INTELLIGENCE_WORKSPACE_VERSION,datasetType:kind,files:report.length,executiveSummary:findings.length?`${findings.length} hallazgos automáticos requieren revisión contextual.`:'No se identificaron hallazgos automáticos con los datos disponibles.',findings,limitations:['Los hallazgos son señales analíticas, no causalidad demostrada.','Las proyecciones son tendencias deterministas.','Las comparaciones A/B usan una aproximación estadística y requieren validación inferencial formal cuando corresponda.'],nextActions:[...new Set(actions)]};
}
export function dataIntelligenceInstruction(workspace){if(!workspace)return'';return`\n\nDATA INTELLIGENCE WORKSPACE (${workspace.version}):\n${JSON.stringify(workspace).slice(0,12000)}\nRegla: presenta primero el hallazgo ejecutivo, después evidencia, implicaciones, limitaciones y acciones. No conviertas correlaciones en causalidad ni señales en hechos.`;}
export function publicDataIntelligenceContract(){return{version:DATA_INTELLIGENCE_WORKSPACE_VERSION,automatic:['dataset_classification','quality_findings','anomaly_findings','relationship_findings','experiment_detection','executive_findings','next_actions'],principles:['evidence_first','no_causality_inference','deterministic_forecast_labeling']};}
