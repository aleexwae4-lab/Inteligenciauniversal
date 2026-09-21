(()=>{
'use strict';
const $=s=>document.querySelector(s);
const notify=message=>window.toast?.(message);
const MAX_FRAMES=12, MAX_RECORD_MS=12000;
let stream=null,recorder=null,recordTimer=null,sampleTimer=null,recordStarted=0;
let side='environment',kind='photo',samples=[],chunks=[],pending=null,previewURL=null,opening=0,processing=false,lastSignature=null;
let dialog,video,image,videoPreview,status,go,modePhoto,modeVideo,switchBtn,captureBtn,stopBtn,useBtn,discardBtn,badge;
let preparation=null,revision=0,evidenceState='idle',lastQuestion='',retryBtn=null;
const cleanURL=()=>{if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null}};
function stopStream(){
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  if(video){video.srcObject=null}
}
function stopTimers(){clearTimeout(recordTimer);clearInterval(sampleTimer);recordTimer=null;sampleTimer=null}
function renderBadge(){
  if(!badge)return;
  badge.hidden=!pending;
  if(!pending){badge.textContent='';if(retryBtn)retryBtn.hidden=true;return}
  const label=pending.kind==='video'?'🎬 Video · '+pending.frames.length+' hojas temporales':'📷 Fotografía';
  const detail=evidenceState==='analyzing'?' · Analizando…':evidenceState==='error'?' · Análisis pendiente · × quitar':' · Lista · × quitar';
  badge.textContent=label+detail;
  badge.title='Quitar evidencia visual';
  badge.setAttribute('aria-label',label+detail);
  const frame=pending.frames[0]?.dataUrl;
  if(typeof frame==='string'&&frame.startsWith('data:image/')){
    const thumb=document.createElement('img');thumb.className='wae-camera-thumb';thumb.alt=pending.kind==='video'?'Primera hoja temporal preparada':'Vista previa de la foto preparada';thumb.src=frame;thumb.loading='lazy';badge.prepend(thumb);
  }
  if(retryBtn)retryBtn.hidden=!(evidenceState==='error'&&lastQuestion);
}
function clear(){
  revision++;pending=null;samples=[];chunks=[];lastSignature=null;processing=false;lastQuestion='';evidenceState='idle';cleanURL();

  if(image){image.removeAttribute('src');image.hidden=true}
  if(videoPreview){videoPreview.pause();videoPreview.removeAttribute('src');videoPreview.load();videoPreview.hidden=true}
  renderBadge();
}
function setStatus(message){if(status)status.textContent=message}
async function startCamera(){
  const requestId=++opening;stopStream();
  if(!navigator.mediaDevices?.getUserMedia){setStatus('Este navegador no permite abrir cámara en vivo. Prueba desde Chrome con HTTPS.');return false}
  try{
    const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:side},width:{ideal:1280},height:{ideal:720}}});
    if(requestId!==opening||!dialog?.open){acquired.getTracks().forEach(t=>t.stop());return false}
    stream=acquired;
    video.srcObject=stream;
    await video.play().catch(()=>{});
    setStatus((side==='environment'?'Cámara trasera':'Cámara frontal')+' · '+(kind==='video'?'Video hasta 12 segundos':'Lista para tomar foto'));
    return true;
  }catch(error){
    const code=error?.name;
    setStatus(code==='NotAllowedError'?'Activa el permiso de cámara en el navegador.':'No se pudo abrir la cámara seleccionada. Puedes usar la opción nativa de tu dispositivo.');
    return false;
  }
}
function grabFrame(timeSec=0){
  if(!stream||!video||video.readyState<2)return null;
  const canvas=document.createElement('canvas'),width=Math.min(960,video.videoWidth||960);
  canvas.width=width;canvas.height=Math.max(1,Math.round(width*(video.videoHeight||720)/(video.videoWidth||960)));
  canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,canvas.width,canvas.height);
  let dataUrl=canvas.toDataURL('image/jpeg',.68);
  if(dataUrl.length>350000){
    canvas.width=Math.min(640,width);canvas.height=Math.max(1,Math.round(canvas.width*(video.videoHeight||720)/(video.videoWidth||960)));
    canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,canvas.width,canvas.height);
    dataUrl=canvas.toDataURL('image/jpeg',.52);
  }
  if(dataUrl.length>350000)return null;
  return {dataUrl,timeSec:Math.round(timeSec*10)/10};
}
async function open(){
  if(!dialog)return;
  if(window.WAECoreTools?.status()?.active==='visual.inspect'){notify('El análisis está en curso; conserva la captura hasta terminar.');return}
  clear();kind='photo';side='environment';updateControls();
  if(!dialog.open)dialog.showModal();
  await startCamera();
}
function updateControls(){
  modePhoto.setAttribute('aria-pressed',String(kind==='photo'));modeVideo.setAttribute('aria-pressed',String(kind==='video'));
  switchBtn.textContent=side==='environment'?'↻ Usar frontal':'↻ Usar trasera';
  captureBtn.hidden=kind!=='photo'||!!pending;
  stopBtn.hidden=kind!=='video'||recorder?.state==='inactive'||!recorder;
  go.hidden=kind!=='video'||!!pending||recorder?.state==='recording'||processing;
  useBtn.hidden=!samples.length||recorder?.state==='recording'||processing;
  discardBtn.hidden=!samples.length||processing;
}
async function chooseMode(next){
  if(recorder?.state==='recording'){recorder.onstop=null;stopRecording()}
  kind=next;clear();video.hidden=false;updateControls();await startCamera();
}
async function switchCamera(){
  if(recorder?.state==='recording'){recorder.onstop=null;stopRecording()}
  side=side==='environment'?'user':'environment';clear();video.hidden=false;updateControls();await startCamera();
}
function takePhoto(){
  const frame=grabFrame(0);
  if(!frame){setStatus('La cámara todavía no ofrece un fotograma.');return}
  samples=[frame];
  image.src=frame.dataUrl;image.hidden=false;video.hidden=true;
  setStatus('Foto preparada. Confirma para adjuntarla a tu consulta.');
  updateControls();
}
function stopRecording(){
  stopTimers();
  if(recorder?.state==='recording'){
    try{recorder.stop()}catch(error){setStatus('No se pudo finalizar la grabación')}
  }
}
function startRecording(){
  if(!stream||!window.MediaRecorder){setStatus('La grabación de video no está disponible en este navegador.');return}
  clear();samples=[];chunks=[];cleanURL();
  let mime='';
  for(const option of ['video/webm;codecs=vp8','video/webm','video/mp4']){
    if(MediaRecorder.isTypeSupported(option)){mime=option;break}
  }
  try{recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined)}
  catch(_){setStatus('El dispositivo no admite el formato de grabación.');return}
  recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data)};
  recorder.onerror=()=>{stopTimers();setStatus('No fue posible grabar el video.')};
  recorder.onstop=async()=>{
    stopTimers();processing=true;updateControls();
    if(!samples.length){const frame=grabFrame(0);if(frame)samples.push(frame)}
    const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
    if(blob.size>0){
      previewURL=URL.createObjectURL(blob);videoPreview.src=previewURL;videoPreview.hidden=false;
    }
    video.hidden=true;
    try{
      const visual=await window.WAEVideoScanV2?.prepare(samples);
      if(!visual)throw Error('No está disponible el muestreador local');
      samples=visual.frames;
      setStatus('WAE Video Scan · '+visual.frameCount+' momentos de video → '+visual.sheetCount+' hojas temporales con hora visible. El original y el audio no se envían a la IA.');
    }catch(error){samples=[];setStatus('No fue posible preparar el análisis visual: '+String(error.message||error))}
    finally{processing=false;updateControls()}

  };
  try{recorder.start(1000)}
  catch(_){setStatus('No se pudo iniciar la grabación.');return}
  recordStarted=performance.now();const first=grabFrame(0);if(first)samples.push(first);
  sampleTimer=setInterval(()=>{
    if(samples.length>=MAX_FRAMES)return;
    const frame=grabFrame((performance.now()-recordStarted)/1000),signature=window.WAEVideoScanV2?.signature(video);
    const change=window.WAEVideoScanV2?.frameDelta(lastSignature,signature)??100;
    if(frame&&(change>=1.35||samples.length<2||Math.round(frame.timeSec)%3===0)){samples.push(frame);lastSignature=signature}
  },1000);
  recordTimer=setTimeout(stopRecording,MAX_RECORD_MS);
  setStatus('Grabando… hasta 12 segundos; se seleccionarán momentos distintos y se construirán hojas temporales para la IA.');
  updateControls();
}
function accept(){
  if(!samples.length||processing||recorder?.state==='recording')return;
  pending={kind,frames:samples.map(f=>({...f})),source:'camera',videoScope:kind==='video'?'sampled_frames_only':'image'};
  evidenceState='ready';
  stopStream();dialog.close();renderBadge();notify(kind==='video'?'Video preparado: se analizarán solo fotogramas, no audio.':'Foto preparada para análisis visual.');
}
function close(){
  opening++;
  if(recorder?.state==='recording'){recorder.onstop=null;stopRecording()}
  stopTimers();stopStream();
  if(dialog?.open)dialog.close();
  if(!pending)clear();
}
function button(label,handler,extraClass=''){
  const el=document.createElement('button');el.type='button';el.className='wae-camera-control '+extraClass;el.textContent=label;
  el.addEventListener('click',handler);return el;
}
// The same native tool accepts camera captures AND files from the ordinary Adjuntar control.
async function loadPhoto(file){
  if(file.size>8_000_000)throw Error('La fotografía supera 8 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    const canvas=document.createElement('canvas'),ratio=bitmap.height/bitmap.width;
    let width=Math.min(960,bitmap.width),dataUrl='';
    for(const quality of [.68,.52,.42]){
      canvas.width=width;canvas.height=Math.max(1,Math.round(width*ratio));
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)throw Error('No se pudo preparar la foto en este dispositivo.');
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      dataUrl=canvas.toDataURL('image/jpeg',quality);
      if(dataUrl.length<=350000)break;
      width=Math.min(640,width);
    }
    if(dataUrl.length>350000)throw Error('Foto demasiado grande para analizar; intenta otra toma.');
    return [{dataUrl,timeSec:0}];
  }finally{bitmap.close()}
}
async function prepareFile(file){
  if(!file)throw Error('Selecciona una fotografía o video.');
  if(window.WAECoreTools?.status()?.active==='visual.inspect')throw Error('El análisis anterior sigue en curso.');
  clear();const requestRevision=revision;
  if(file.type.startsWith('image/')){
    const frames=await loadPhoto(file);
    if(requestRevision!==revision)throw Error('La fotografía fue reemplazada o cancelada.');
    pending={kind:'photo',frames,source:'attachment'};
  }else if(file.type.startsWith('video/')||/\.(?:mp4|webm|mov|m4v)$/i.test(file.name)){
    if(!window.WAEVideoScanV2?.prepareFile)throw Error('El analizador temporal de video no está disponible.');
    const prepared=await window.WAEVideoScanV2.prepareFile(file);
    if(requestRevision!==revision)throw Error('El video fue reemplazado o cancelado.');
    pending={kind:'video',frames:prepared.frames,source:'attachment',videoScope:'sampled_frames_only'};
  }else throw Error('El archivo no es una imagen o video compatible.');
  evidenceState='ready';renderBadge();
  notify(pending.kind==='video'?'Video preparado para WAE Visual Scan; el audio no se analiza.':'Foto lista para análisis nativo en el chat.');
  return {kind:pending.kind,frameCount:pending.frames.length};
}
function initialize(){
  const controls=$('.composer-actions>div');if(!controls||$('#waeCameraBtn'))return;
  $('#fileInput')?.addEventListener('change',async event=>{
    const visuals=[...(event.target.files||[])].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/')||/\.(?:mp4|webm|mov|m4v)$/i.test(f.name));
    if(!visuals.length)return;
    if(visuals.length>1){notify('Analizaré el primer archivo visual; adjunta los demás por separado.')}
    if(window.WAEChatState?.busy?.()){notify('Termina la respuesta actual antes de adjuntar otra imagen.');return}
    // Clear picker only after every change listener has read the same FileList (including text attachments).
    const picker=event.target;setTimeout(()=>{picker.value=''},0);
    const task=preparation=prepareFile(visuals[0]);
    try{await task}catch(error){notify('No se preparó el archivo: '+String(error?.message||error).slice(0,150))}
    finally{if(preparation===task)preparation=null}
  });
  const camera=button('📷',open,'wae-camera-trigger');camera.id='waeCameraBtn';camera.title='Abrir cámara frontal o trasera';camera.setAttribute('aria-label','Abrir cámara');
  ($('#attachBtn')||controls.lastElementChild)?.after(camera);
  badge=button('',()=>{if(window.WAECoreTools?.status()?.active==='visual.inspect'){notify('El análisis está en curso.');return}clear();notify('Captura retirada')},'wae-camera-badge');badge.id='waeCameraBadge';badge.hidden=true;
  retryBtn=button('↻ Reintentar análisis',()=>{
    if(!pending||window.WAEChatState?.busy?.())return;
    const input=$('#messageInput');if(input&&!input.value.trim())input.value=lastQuestion;
    $('#composer')?.requestSubmit();
  },'wae-camera-retry');retryBtn.id='waeCameraRetry';retryBtn.hidden=true;
  $('.composer-actions')?.before(badge,retryBtn);
  window.addEventListener('wae:core-tool',event=>{
    if(event.detail?.id!=='visual.inspect')return;
    if(event.detail.kind==='start')evidenceState='analyzing';
    if(event.detail.kind==='failure')evidenceState='error';
    renderBadge();
  });
  dialog=document.createElement('dialog');dialog.id='waeCameraDialog';dialog.className='wae-camera-dialog';
  const panel=document.createElement('div');panel.className='wae-camera-panel';
  const title=document.createElement('h2');title.textContent='Cámara · Universal Core';
  const intro=document.createElement('p');intro.textContent='La cámara solo se activa con tu permiso. Las capturas no se guardan automáticamente en la memoria.';
  const top=document.createElement('div');top.className='wae-camera-toolbar';
  modePhoto=button('📷 Foto',()=>chooseMode('photo'));modeVideo=button('🎬 Video',()=>chooseMode('video'));
  switchBtn=button('↻ Usar frontal',switchCamera);
  const closeBtn=button('× Cerrar',close);
  top.append(modePhoto,modeVideo,switchBtn,closeBtn);
  video=document.createElement('video');video.id='waeCameraLive';video.autoplay=true;video.muted=true;video.playsInline=true;
  image=document.createElement('img');image.alt='Vista previa de la foto';image.hidden=true;
  videoPreview=document.createElement('video');videoPreview.controls=true;videoPreview.playsInline=true;videoPreview.hidden=true;
  status=document.createElement('p');status.className='wae-camera-status';status.setAttribute('role','status');status.textContent='Solicitando permiso de cámara…';
  const actions=document.createElement('div');actions.className='wae-camera-actions';
  captureBtn=button('Tomar foto',takePhoto,'wae-camera-main');
  go=button('● Grabar video',startRecording,'wae-camera-main');
  stopBtn=button('■ Detener',stopRecording);
  useBtn=button('✓ Usar captura',accept,'wae-camera-main');
  discardBtn=button('↺ Repetir',()=>{clear();video.hidden=false;updateControls();setStatus('Preparado para nueva captura.')});
  const native=button('Cámara del dispositivo',()=>{
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('capture',side);input.hidden=true;
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];input.remove();if(!file)return;
      if(!file.type.startsWith('image/')||file.size>8_000_000){setStatus('Selecciona una fotografía de hasta 8 MB.');return}
      try{
        const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas'),ratio=bitmap.height/bitmap.width;
        canvas.width=Math.min(960,bitmap.width);canvas.height=Math.round(canvas.width*ratio);
        canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);
        let dataUrl=canvas.toDataURL('image/jpeg',.68);
        if(dataUrl.length>350000){canvas.width=Math.min(640,canvas.width);canvas.height=Math.round(canvas.width*ratio);canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height);dataUrl=canvas.toDataURL('image/jpeg',.52)}
        bitmap.close();
        if(dataUrl.length>350000){setStatus('La imagen sigue siendo demasiado grande; toma otra fotografía.');return}
        kind='photo';samples=[{dataUrl,timeSec:0}];image.src=dataUrl;image.hidden=false;video.hidden=true;
        setStatus('Foto preparada mediante la cámara del dispositivo.');updateControls();
      }catch(_){setStatus('No fue posible leer la fotografía.')}
    },{once:true});
    document.body.append(input);input.click();
  });
  const gallery=button('🎞 Video de galería',()=>{
    const input=document.createElement('input');input.type='file';input.accept='video/mp4,video/webm,video/quicktime,video/*';input.hidden=true;
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];input.remove();if(!file)return;
      if(processing){setStatus('Finaliza el análisis anterior antes de cargar otro video.');return}
      stopRecording();stopTimers();stopStream();clear();kind='video';processing=true;updateControls();
      setStatus('WAE Video Scan · decodificando 12 momentos temporales del video local…');
      try{
        if(!window.WAEVideoScanV2?.prepareFile)throw Error('El muestreador de video no está disponible');
        const analyzed=await window.WAEVideoScanV2.prepareFile(file);
        samples=analyzed.frames;previewURL=URL.createObjectURL(file);
        videoPreview.src=previewURL;videoPreview.hidden=false;video.hidden=true;
        setStatus('Video local · '+analyzed.frameCount+' fotogramas, '+analyzed.sheetCount+' hojas visuales. Duración '+Math.round(analyzed.duration)+'s. El audio y el archivo original no se envían al modelo.');
      }catch(error){setStatus('No se pudo preparar el video: '+String(error.message||error))}
      finally{processing=false;updateControls()}
    },{once:true});
    document.body.append(input);input.click();
  });
  actions.append(captureBtn,go,stopBtn,useBtn,discardBtn,native,gallery);
  panel.append(title,intro,top,video,image,videoPreview,status,actions);dialog.append(panel);
  $('.app-shell')?.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
  dialog.addEventListener('click',event=>{if(event.target===dialog)close()});
  window.addEventListener('pagehide',()=>{opening++;stopRecording();stopTimers();stopStream();cleanURL()});
  updateControls();
}
window.WAECamera={
  hasPending:()=>!!pending,
  defaultQuestion:()=>evidenceState==='error'&&lastQuestion?lastQuestion:pending?.kind==='video'?'Analiza la secuencia de estas hojas temporales: resume qué cambia, identifica texto visible y anomalías, y separa observaciones de hipótesis. No supongas audio ni video completo.':'Analiza esta fotografía: elementos visibles, detalles relevantes, dudas y recomendaciones prácticas.',
  clear,
  open,
  prepareFile,
  status:()=>({pending:!!pending,kind:pending?.kind||null,sheetCount:pending?.kind==='video'?pending.frames.length:0,source:pending?.source||null,state:evidenceState}),
  analyze:async context=>{
    if(!pending)throw Error('No hay captura preparada');
    if(!window.WAEVisualRuntime?.analyze)throw Error('No se cargó el motor visual. Actualiza la página y conserva tu captura.');
    const args=typeof context==='string'?{message:context}:context||{};
    const relevantHistory=(Array.isArray(args.history)?args.history:[]).slice(-4)
      .map(item=>String(item?.role||'')+': '+String(item?.text||'').slice(0,220)).join('\n');
    const requested=String(args.message||'').slice(0,3000);
    const simpleRetry=/^(?:reintenta|vuelve a intentar|otra vez|inténtalo otra vez)[.!\s]*$/i.test(requested.trim());
    const question=simpleRetry&&lastQuestion?lastQuestion:requested;
    if(question.trim())lastQuestion=question;
    const contextual= relevantHistory?question+'\n\nContexto conversacional (puede ser incompleto; no lo trates como evidencia visual):\n'+relevantHistory:question;
    return window.WAEVisualRuntime.analyze({question:contextual.slice(0,4000),kind:pending.kind,frames:pending.frames,mode:args.mode||window.WAEChatState?.mode?.()||'general'});
  }
};
window.WAECoreTools?.register({
  id:'visual.inspect',
  label:'WAE Visual Scan',
  kind:'multimodal',
  canHandle:()=>!!pending||!!preparation,
  run:async context=>{
    if(preparation)await preparation;
    if(!pending)throw Error('La captura no pudo prepararse; intenta adjuntarla otra vez.');
    const mediaKind=pending?.kind,frameCount=pending?.frames.length||0;
    const result=await window.WAECamera.analyze(context);
    // Only clear after real inference succeeded. No fabricated success or lost evidence on provider failure.
    clear();
    return {reply:result.reply,metadata:{mediaKind,frameCount,scope:result.videoScope||'image',model:result.model||null}};
  }
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();