/* WAE Factory ZIP v4: offline, uncompressed, UTF-8 ZIP builder. No CDNs or network. */
(()=>{
'use strict';
if(window.WAEZipProject)return;
const encoder=new TextEncoder();
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function make(length){const bytes=new Uint8Array(length);return{bytes,view:new DataView(bytes.buffer)}}
function u16(v,n,value){v.setUint16(n,value,true)}
function u32(v,n,value){v.setUint32(n,value,true)}
function archive(files){
 if(!Array.isArray(files)||files.length<1||files.length>30)throw Error('Número de archivos inválido.');
 const chunks=[],central=[],seen=new Set();let offset=0,size=0;
 for(const file of files){
  if(!file||typeof file.name!=='string'||typeof file.content!=='string'||!/^(?!\.)(?!.*\.\.)(?!\/)[a-zA-Z0-9_./-]{1,100}$/.test(file.name)||seen.has(file.name))throw Error('Ruta inválida o duplicada.');
  seen.add(file.name);
  const name=encoder.encode(file.name),content=encoder.encode(file.content);
  if(content.length>220000||name.length>65535)throw Error('Archivo demasiado grande.');
  size+=content.length;if(size>2_000_000)throw Error('Proyecto demasiado grande.');
  const hash=crc32(content);
  const local=make(30);
  u32(local.view,0,0x04034b50);u16(local.view,4,20);u16(local.view,6,0x0800);
  u32(local.view,14,hash);u32(local.view,18,content.length);u32(local.view,22,content.length);
  u16(local.view,26,name.length);
  chunks.push(local.bytes,name,content);
  const record=make(46);
  u32(record.view,0,0x02014b50);u16(record.view,4,20);u16(record.view,6,20);u16(record.view,8,0x0800);
  u32(record.view,16,hash);u32(record.view,20,content.length);u32(record.view,24,content.length);
  u16(record.view,28,name.length);u32(record.view,42,offset);
  central.push(record.bytes,name);
  offset+=local.bytes.length+name.length+content.length;
 }
 const centralSize=central.reduce((n,p)=>n+p.length,0);
 const end=make(22);u32(end.view,0,0x06054b50);u16(end.view,8,files.length);u16(end.view,10,files.length);
 u32(end.view,12,centralSize);u32(end.view,16,offset);
 const parts=chunks.concat(central,end.bytes),total=offset+centralSize+22;
 const result=new Uint8Array(total);let at=0;
 for(const part of parts){result.set(part,at);at+=part.length}
 return result;
}
window.WAEZipProject=archive;
})();
