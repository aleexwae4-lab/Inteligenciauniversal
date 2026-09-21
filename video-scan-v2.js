// WAE Video Scan v2: adapted from WAE Video Scan v130's local, timestamped contact sheets.
// Never presents sampled video as full audiovisual understanding.
(()=>{
'use strict';
const MAX_SAMPLES=12,FRAMES_PER_SHEET=4,MAX_SHEETS=3;
function stamp(seconds){const s=Math.max(0,Number(seconds)||0),minutes=Math.floor(s/60);return String(minutes).padStart(2,'0')+':'+(s-minutes*60).toFixed(1).padStart(4,'0')}
function imageFor(dataUrl){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>reject(new Error('No se pudo decodificar un fotograma'));
  image.src=dataUrl;
 });
}
function frameDelta(a,b){
 // Scene-change estimation from compact perceptual grayscale signatures.
 if(!a||!b||a.length!==b.length)return 100;
 let difference=0;
 for(let i=0;i<a.length;i++)difference+=Math.abs(a[i]-b[i]);
 return Math.round(difference/(a.length*255)*10000)/100;
}
function signature(video){
 try{
  const canvas=document.createElement('canvas');canvas.width=16;canvas.height=12;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return null;
  ctx.drawImage(video,0,0,16,12);
  const pixels=ctx.getImageData(0,0,16,12).data,out=new Uint8Array(192);
  for(let i=0,j=0;i<pixels.length;i+=4,j++)out[j]=Math.round(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114);
  return out;
 }catch{return null}
}
async function sheet(group,index,total){
 const canvas=document.createElement('canvas'),W=960,H=640,header=45,pad=8;
 canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)throw Error('La composición visual no está disponible');
 ctx.fillStyle='#07101b';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#fff';ctx.font='600 21px system-ui,sans-serif';ctx.fillText('WAE Video Scan · '+(index+1)+'/'+total+' · visual sin audio',14,29);
 const tileW=(W-pad)/2,tileH=(H-header-pad)/2;
 for(let i=0;i<group.length;i++){
  const frame=group[i],image=await imageFor(frame.dataUrl),x=(i%2)*(tileW+pad),y=header+Math.floor(i/2)*(tileH+pad);
  const ratio=Math.min(tileW/image.width,tileH/image.height);
  const dw=image.width*ratio,dh=image.height*ratio;
  ctx.fillStyle='#050505';ctx.fillRect(x,y,tileW,tileH);
  ctx.drawImage(image,x+(tileW-dw)/2,y+(tileH-dh)/2,dw,dh);
  const durationLabel='t='+stamp(frame.timeSec);
  ctx.fillStyle='rgba(0,0,0,.8)';ctx.fillRect(x+8,y+8,150,31);
  ctx.font='600 19px ui-monospace,monospace';ctx.fillStyle='white';ctx.fillText(durationLabel,x+15,y+30);
 }
 let dataUrl=canvas.toDataURL('image/jpeg',.60);
 if(dataUrl.length>350000)dataUrl=canvas.toDataURL('image/jpeg',.43);
 if(dataUrl.length>350000){
  const reduced=document.createElement('canvas');reduced.width=720;reduced.height=480;
  reduced.getContext('2d',{alpha:false}).drawImage(canvas,0,0,720,480);
  dataUrl=reduced.toDataURL('image/jpeg',.46);
 }
 if(dataUrl.length>350000)throw Error('La evidencia visual supera el límite; graba un video más breve');
 return{dataUrl,timeSec:group[0].timeSec,endSec:group[group.length-1].timeSec};
}
async function prepare(frames){
 const original=frames.filter(x=>x?.dataUrl&&Number.isFinite(x?.timeSec)).slice(0,MAX_SAMPLES);
 if(!original.length)throw Error('El video no contiene fotogramas decodificables');
 const sheets=[],total=Math.ceil(original.length/FRAMES_PER_SHEET);
 for(let i=0;i<total;i++)sheets.push(await sheet(original.slice(i*FRAMES_PER_SHEET,(i+1)*FRAMES_PER_SHEET),i,total));
 return{frames:sheets,frameCount:original.length,sheetCount:sheets.length,timestamps:original.map(x=>x.timeSec)};
}
async function waitFor(element,event,ms){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{finish();reject(Error('Se agotó el tiempo de decodificación del video'))},ms);
  function finish(){clearTimeout(timer);element.removeEventListener(event,onLoad);element.removeEventListener('error',onError)}
  function onLoad(){finish();resolve()}
  function onError(){finish();reject(Error('El navegador no pudo decodificar el video'))}
  element.addEventListener(event,onLoad,{once:true});element.addEventListener('error',onError,{once:true});
 });
}
async function prepareFile(file){
 if(!file||!/^video\//.test(file.type)||file.size>150*1024*1024)throw Error('Selecciona un video compatible de hasta 150 MB');
 const source=URL.createObjectURL(file),video=document.createElement('video');
 video.preload='auto';video.muted=true;video.playsInline=true;video.src=source;
 try{
  const ready=waitFor(video,'loadedmetadata',15000);video.load();await ready;
  if(!Number.isFinite(video.duration)||video.duration<=0)throw Error('El video no informa una duración válida');
  const duration=video.duration,frames=[];
  for(let i=0;i<MAX_SAMPLES;i++){
   const at=Math.min(duration-.03,duration*(i+.5)/MAX_SAMPLES);
   const seek=waitFor(video,'seeked',12000);
   video.currentTime=Math.max(0,at);await seek;
   const canvas=document.createElement('canvas'),width=Math.min(720,video.videoWidth||720),height=Math.max(1,Math.round(width*(video.videoHeight||405)/(video.videoWidth||720)));
   canvas.width=width;canvas.height=height;canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,width,height);
   let dataUrl=canvas.toDataURL('image/jpeg',.59);
   if(dataUrl.length>350000)dataUrl=canvas.toDataURL('image/jpeg',.43);
   if(dataUrl.length>350000)throw Error('Un fotograma supera el tamaño admitido');
   frames.push({timeSec:Math.round(at*10)/10,dataUrl});
  }
  const result=await prepare(frames);
  return{...result,duration,originalUploaded:false,audioTranscribed:false};
 }finally{
  video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(source);
 }
}
window.WAEVideoScanV2=Object.freeze({version:'2.1.0',prepare,prepareFile,signature,frameDelta,MAX_SAMPLES,MAX_SHEETS,stamp});
})();