export const EXECUTION_PROOF_VERSION='execution-proof/v1';
export function buildExecutionProof({message='',toolResults=[],analyticsReport=[],mission=null,externalActionExecuted=false}={}){
 const tools=(toolResults||[]).map(x=>({tool:String(x?.tool||''),status:x?.ok===true?'success':'failed',evidence:x?.ok===true?Array.isArray(x.data)?x.data.length>0:'available':String(x?.error||'')}));
 const executed=externalActionExecuted===true;
 return {version:EXECUTION_PROOF_VERSION,requestedAction:String(message).slice(0,500),capabilities:{analytics:analyticsReport?.length?'executed':'not_required'},tools,external_action_executed:executed,verification_status:tools.some(x=>x.status==='failed')?'partial':'verified',rule:'No external action is considered executed without an authorized tool result or verifiable receipt.'};
}
