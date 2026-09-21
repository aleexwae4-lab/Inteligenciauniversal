// One real, non-generative session handshake during Render build.
// No image, no model tokens, no personal data, and never print a session secret.
import {bootstrapVisualSession} from '../lib/vision-gateway.js';
try{
 const data=await bootstrapVisualSession({},{});
 if(!data.session_id||!data.session_secret)throw Error('empty_visual_session');
 console.log('[WAE Visual Canary] REAL IU bootstrap PASS (no image, no provider charge)');
}catch(error){
 console.error('[WAE Visual Canary] REAL IU bootstrap FAIL:',String(error?.code||'unknown'),String(error?.message||'').slice(0,180));
 process.exitCode=1;
}
