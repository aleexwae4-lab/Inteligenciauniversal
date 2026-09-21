// One-time real photo canary. Synthetic colors, no user media; selected model must pass
// live free-price + image-capability gate in iuSelectFreeVision or the call fails closed.
import {bootstrapVisualSession,forwardVisual} from '../lib/vision-gateway.js';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAoCAIAAADmAupWAAAARklEQVR42u3PQREAMAzDsLT8OW8w8qhMwKd56TTpnDfHAgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgZu9wG68wJPOGUWZgAAAABJRU5ErkJggg==';
try{
 const session=await bootstrapVisualSession({},{});
 const result=await forwardVisual({
  ...session,question:'Describe únicamente los dos colores de esta imagen, de izquierda a derecha. Evita inventar objetos.',
  kind:'image',frames:[{dataUrl:image,timeSec:0}],mode:'analysis'
 });
 const visible=String(result.reply||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 console.log('[WAE Vision PHOTO CANARY] provider='+String(result.provider||'none').slice(0,55),
  'model='+String(result.model||'none').slice(0,85),
  'reply='+String(result.reply||'').slice(0,240).replace(/[\r\n]+/g,' '));
 if(!visible.includes('roj')&&!visible.includes('red')||!visible.includes('azul')&&!visible.includes('blue'))
  throw Object.assign(Error('synthetic_color_verification_failed'),{code:'synthetic_color_verification_failed'});
 console.log('[WAE Vision PHOTO CANARY] REAL MULTIMODAL INFERENCE PASS; synthetic-only, free-catalog-gated');
}catch(error){
 console.error('[WAE Vision PHOTO CANARY] REAL MULTIMODAL INFERENCE FAIL',
  String(error?.code||error?.name||'unknown').slice(0,75),
  String(error?.message||'').slice(0,230));
 process.exitCode=1;
}
