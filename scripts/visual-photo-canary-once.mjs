// One-time real photo canary. Synthetic colors, no user media; selected model must pass
// live free-price + image-capability gate in iuSelectFreeVision or the call fails closed.
import {bootstrapVisualSession,forwardVisual} from '../lib/vision-gateway.js';
import {deflateSync,inflateSync} from 'node:zlib';
// Build a valid RGB PNG instead of relying on an accidentally truncated base64 literal.
function crc32(bytes){
 let value=0xffffffff;
 for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0)}
 return (value^0xffffffff)>>>0;
}
function chunk(name,data){
 const type=Buffer.from(name,'ascii'),length=Buffer.alloc(4),crc=Buffer.alloc(4);
 length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));
 return Buffer.concat([length,type,data,crc]);
}
function verifiedPng(){
 const width=128,height=64,rowSize=1+width*3,raw=Buffer.alloc(height*rowSize);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*rowSize+1+x*3;
  raw[i]=x<width/2?255:0;raw[i+1]=0;raw[i+2]=x>=width/2?255:0;
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
 ihdr[8]=8;ihdr[9]=2; // true-colour 8-bit RGB, filter 0 on every scanline.
 const compressed=deflateSync(raw);
 if(!inflateSync(compressed).equals(raw)||raw[1]!==255||raw[2]!==0||raw[3]!==0||
   raw[1+width/2*3]!==0||raw[3+width/2*3]!==255)throw Error('synthetic_png_self_check_failed');
 const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',compressed),chunk('IEND',Buffer.alloc(0))]);
 console.log('[WAE Vision PHOTO CANARY] verified synthetic PNG bytes='+bytes.length+' size='+width+'x'+height+' left=red right=blue');
 return 'data:image/png;base64,'+bytes.toString('base64');
}
const image=verifiedPng();
try{
 const session=await bootstrapVisualSession({},{});
 const result=await forwardVisual({
  ...session,question:'Describe únicamente los dos colores de esta imagen, de izquierda a derecha. Evita inventar objetos.',
  kind:'image',frames:[{dataUrl:image,timeSec:0}],mode:'analysis'
 });
 const safeReply=String(result.reply||'').trim();
 if(!safeReply||/<\/?(?:thought|think|analysis|reasoning)\b/i.test(safeReply)||/^\s*(?:Role|Task|Constraints?)\s*:/i.test(safeReply))
  throw Object.assign(Error('visual_visible_boundary_failed'),{code:'visual_visible_boundary_failed'});
 const visible=safeReply.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
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
