import { createHash } from 'node:crypto';
import { astraFrontierSuite } from './astra-frontier-challenge-v1.js';
import { astraBenchmarkContract } from './astra-benchmark-contract-v1.js';

export const ASTRA_REGRESSION_HUNTER_VERSION='astra-regression-hunter/v1';

const hash=v=>createHash('sha256').update(String(v??'')).digest('hex');

export function buildAstraRegressionHunter({measurements={}, frontierEntries=[]}={}) {
  const contract=astraBenchmarkContract();
  const frontier=astraFrontierSuite();
  const tasks=[];

  for(const metric of contract.metrics){
    const raw=measurements?.[metric.id];
    const measured=Number.isFinite(Number(raw));
    const score=measured?Math.max(0,Math.min(1,Number(raw))):null;
    const gap=measured?Number((score-metric.astra).toFixed(4)):null;
    const status=!measured?'UNMEASURED':gap<0?'GAP':gap===0?'MATCH':'ABOVE_REFERENCE';
    const matching=frontier.filter(c=>{
      const category=String(c.category||'').toLowerCase();
      const domain=String(metric.domain||'').toLowerCase();
      return category===domain || category.includes(domain) || domain.includes(category);
    });
    const severity=status==='GAP'?'P0':status==='UNMEASURED'?'P1':status==='MATCH'?'P2':'P3';
    tasks.push({
      id:`astra-${metric.id}`,
      metricId:metric.id,
      protocol:metric.protocol,
      target:metric.astra,
      universalScore:score,
      gap,
      status,
      severity,
      regressionCases:matching.slice(0,8).map(c=>c.id),
      action:status==='GAP'?'raise score above public reference under the exact protocol':status==='UNMEASURED'?'execute Universal Core measurement under the exact protocol':'maintain and regression-test this capability',
      deterministicId:hash(metric.id+':'+metric.astra+':'+JSON.stringify(matching.map(c=>c.id)))
    });
  }

  const ordered=[...tasks].sort((a,b)=>{
    const rank={P0:0,P1:1,P2:2,P3:3};
    return rank[a.severity]-rank[b.severity] || (a.gap??-1)-(b.gap??-1);
  });
  return {
    version:ASTRA_REGRESSION_HUNTER_VERSION,
    referenceModel:contract.referenceModel,
    source:contract.officialSource,
    tasks:ordered,
    summary:{
      p0:ordered.filter(x=>x.severity==='P0').length,
      p1:ordered.filter(x=>x.severity==='P1').length,
      p2:ordered.filter(x=>x.severity==='P2').length,
      p3:ordered.filter(x=>x.severity==='P3').length
    },
    policy:{
      noSimulatedCompetitorData:true,
      noGlobalSuperiorityClaim:true,
      benchmarkScopedOnly:true
    }
  };
}

export function buildRegressionCurriculum({measurements={}, frontierEntries=[]}={}) {
  const report=buildAstraRegressionHunter({measurements,frontierEntries});
  return {
    version:ASTRA_REGRESSION_HUNTER_VERSION,
    generatedAt:new Date().toISOString(),
    sourceHash:hash(JSON.stringify(report.tasks)),
    objective:'Convert measured Astra reference gaps into reproducible Universal Core regression work.',
    queue:report.tasks.filter(x=>x.severity==='P0'||x.severity==='P1'),
    holdout:report.tasks.filter(x=>x.severity==='P2'||x.severity==='P3'),
    policy:report.policy
  };
}
