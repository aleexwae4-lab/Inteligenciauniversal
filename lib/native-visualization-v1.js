export const NATIVE_VISUALIZATION_VERSION='native-visualization/v1';
const safe=(v,max=120)=>String(v??'').slice(0,max);
export function buildVisualizationSpecs(report=[]){
 const charts=[];
 for(const r of report){if(r.type!=='tabular')continue;
  const stats=(r.numericStats||[]).slice(0,8);
  if(stats.length)charts.push({type:'bar',title:`Promedios — ${safe(r.file,80)}`,items:stats.map(x=>({label:safe(x.name),value:Number(x.mean)}))});
  const temporal=(r.temporal?.series||[]).filter(x=>Number.isFinite(x.value)).slice(-20);
  if(temporal.length>=3)charts.push({type:'line',title:`Tendencia — ${safe(r.temporal.dateColumn,60)}`,items:temporal.map(x=>({label:safe(x.date,40),value:Number(x.value)}))});
  const correlations=(r.correlations||[]).filter(x=>Number.isFinite(x.r)).slice(0,8);
  if(correlations.length)charts.push({type:'bar',title:'Correlaciones detectadas',items:correlations.map(x=>({label:safe(`${x.x} ↔ ${x.y}`,100),value:Number(x.r)}))});
 }
 return charts.slice(0,6);
}
export function visualizationInstruction(specs=[]){if(!specs.length)return'';return`\n\nVISUALIZACIÓN NATIVA (${NATIVE_VISUALIZATION_VERSION}): Se generaron ${specs.length} especificaciones de gráficas con datos reales del motor. Puedes complementarlas, pero no alteres sus valores. Usa bloques \`\`\`wae-chart JSON solo para datos presentes en evidencia.`;}
export function publicVisualizationContract(){return{version:NATIVE_VISUALIZATION_VERSION,ready:['bar','line'],source:'native_analytics',maxCharts:6};}
