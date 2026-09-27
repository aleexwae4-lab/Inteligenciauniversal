import { buildAstraRegressionHunter, buildRegressionCurriculum } from '../lib/astra-regression-hunter-v1.js';
import { applyHeaders } from '../lib/security.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const url=new URL(req.url||'/api/benchmark/astra-regression','http://localhost');
  const raw=url.searchParams.get('measurements');
  let measurements={};
  if(raw){
    try{measurements=JSON.parse(raw)}catch{return res.status(400).json({error:'invalid_measurements_json'})}
  }
  const mode=url.searchParams.get('mode')==='curriculum'?'curriculum':'report';
  const payload=mode==='curriculum'
    ?buildRegressionCurriculum({measurements})
    :buildAstraRegressionHunter({measurements});
  return res.status(200).json(payload);
}
