// Multimodal final-answer boundary. An image was not successfully analyzed if
// the provider returned only a scratchpad, partial thinking tags or a refusal
// falsely claiming that the supplied image is missing.
export function extractVisibleVisualReply(value){
  let reply=typeof value==='string'?value.trim():'';
  if(!reply||reply.length>18000)return '';
  for(const tag of ['thought','think','analysis']){
    const block=new RegExp('<'+tag+'(?:\\s[^>]*)?>[\\s\\S]*?<\\/'+tag+'\\s*>','gi');
    reply=reply.replace(block,'').trim();
    if(new RegExp('<\\/?'+tag+'\\b','i').test(reply))return '';
  }
  const final=reply.match(/^<final\\s*>([\\s\\S]*?)<\\/final\\s*>$/i);
  if(final)reply=final[1].trim();
  if(!reply||/<\\/?(?:thought|think|analysis|final)\\b/i.test(reply))return '';
  if(/(?:^|\\n)\\s*(?:internal reasoning|chain.of.thought|scratchpad|private analysis|thoughts?)\\s*:/im.test(reply))return '';
  if(/\\b(?:no (?:has|hay|veo|recib[ií]|puedo ver) (?:adjuntado |una |ninguna )?(?:imagen|archivo)|no image (?:was |is )?(?:attached|provided|received)|cannot (?:see|access) the image)\\b/i.test(reply))return '';
  return reply;
}
