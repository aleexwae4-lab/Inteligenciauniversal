/* Universal Core v126: deliver only an accepted, persisted final answer.
 * This module does not invent text or expose provider deltas before the guard.
 */
export const VERIFIED_DELIVERY_VERSION='wae-verified-delivery/v126';

export function verifiedDeliveryEventsV126(response={},speechText=(_text)=>'',structured=false){
  const canonical=typeof response?.content==='string'?response.content:'';
  if(!canonical.trim())return [];
  const events=[{event:'content.delta',data:{text:canonical}}];
  if(!structured){
    const spoken=String(speechText(canonical)||'').trim();
    if(spoken)events.push({event:'speech.delta',data:{text:spoken}});
  }
  return events;
}
