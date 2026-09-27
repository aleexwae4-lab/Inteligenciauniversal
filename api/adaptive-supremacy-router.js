import { applyHeaders } from '../lib/security.js';
import { buildAdaptiveSupremacyRouter } from '../lib/adaptive-supremacy-router-v1.js';

function parseJson(value,fallback={}){
  if(!value)return fallback;
  try{return JSON.parse(value)}catch{return fallback}
}

export default async function adaptiveSupremacyHandler(req,res){
  applyHeaders(res);
  if((req.method||'GET')!=='GET'){
    res.statusCode=405;
    return res.json({error:'method_not_allowed'});
  }
  const q=new URL(req.url||'/api/benchmark/adaptive-router','http://localhost').searchParams;
  const result=buildAdaptiveSupremacyRouter({
    taskCategory:q.get('category')||'default',
    gapReport:parseJson(q.get('gapReport')),
    curriculum:parseJson(q.get('curriculum')),
    history:parseJson(q.get('history')),
    constraints:parseJson(q.get('constraints'))
  });
  return res.json(result);
}
