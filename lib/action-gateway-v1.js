export const ACTION_GATEWAY_VERSION='action-gateway/v1';
const EXECUTABLE_SIDE_EFFECTS=new Set(['write','mutate','execute','send','publish','deploy','payment']);
const normalize=(v,max=300)=>String(v??'').trim().slice(0,max);
export function buildActionGateway({decisionWorkspace=null,toolRegistry=[],toolResults=[]}={}){
 const registry=Array.isArray(toolRegistry)?toolRegistry:[];
 const available=registry.filter(t=>EXECUTABLE_SIDE_EFFECTS.has(String(t?.sideEffect||'').toLowerCase()));
 const receipts=(toolResults||[]).filter(r=>r?.ok===true&&r?.receipt).map(r=>({tool:normalize(r.tool,100),receipt:normalize(r.receipt,500)}));
 const verified=receipts.length>0;
 const pending=decisionWorkspace?.decisionQueue||[];
 return {version:ACTION_GATEWAY_VERSION,mode:available.length?'conditional-execution':'read-only',availableSideEffectTools:available.map(t=>normalize(t.id||t.canonicalId,100)),pendingActions:pending.map((x,i)=>({id:x.id||`A${i+1}`,action:normalize(x.action,240),status:'pending',requiresAuthorization:true})),receipts,verification:{status:verified?'verified':'not_executed',rule:'No side effect is executed or reported without an authorized side-effect tool and verifiable receipt.'}};
}
export function actionGatewayInstruction(gateway){if(!gateway)return'';return`\n\nACTION GATEWAY (${gateway.version}):\n${JSON.stringify(gateway).slice(0,10000)}\nRegla estricta: distingue propuesta, autorización, ejecución y verificación. Nunca afirmes que una acción externa fue realizada sin herramienta de efectos laterales autorizada y recibo verificable.`}
export function publicActionGatewayContract(){return{version:ACTION_GATEWAY_VERSION,states:['pending','authorized','executing','verified','failed'],defaultExecution:'read_only',receiptRequired:true};}
