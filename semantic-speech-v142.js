(()=>{
'use strict';
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const text=v=>String(v??'').normalize('NFKC');
const compact=v=>text(v).replace(/[\t ]+/gu,' ').trim();
function spokenDate(y,m,d){
  const yy=Number(y),mm=Number(m),dd=Number(d);
  if(!Number.isInteger(yy)||!Number.isInteger(mm)||!Number.isInteger(dd)||mm<1||mm>12||dd<1||dd>31)return `${y}-${m}-${d}`;
  return `${dd} de ${MONTHS[mm-1]} de ${yy}`;
}
function cells(line){
  return text(line).trim().replace(/^\||\|$/g,'').split('|').map(v=>compact(v.replace(/\\\|/g,'|')));
}
function isTableLine(line){return /^\s*\|?.+\|.+\|?\s*$/u.test(line)}
function isDivider(line){
  const c=cells(line);
  return c.length>1&&c.every(v=>/^:?-{3,}:?$/u.test(v.replace(/\s+/g,'')));
}
function tableSpeech(lines,start){
  if(start+1>=lines.length||!isTableLine(lines[start])||!isDivider(lines[start+1]))return null;
  const head=cells(lines[start]);let i=start+2;const rows=[];
  while(i<lines.length&&isTableLine(lines[i])&&!isDivider(lines[i])){
    const row=cells(lines[i]);if(row.some(Boolean))rows.push(row);i++;
  }
  if(!head.length)return null;
  const out=[`Tabla. Columnas: ${head.join(', ')}.`];
  const shown=rows.slice(0,8);
  shown.forEach((row,index)=>{
    const parts=head.map((h,j)=>row[j]?`${h}: ${row[j]}`:null).filter(Boolean);
    if(parts.length)out.push(`Fila ${index+1}. ${parts.join('; ')}.`);
  });
  if(rows.length>shown.length)out.push(`Hay ${rows.length-shown.length} filas adicionales disponibles en pantalla.`);
  return {spoken:out.join('\n'),next:i};
}
function semanticSpeech(input,{locale='es-MX'}={}){
  let raw=text(input).replace(/\r\n?/g,'\n');
  if(!raw.trim())return '';
  raw=raw.replace(/(?:\x60{3}|~{3})([A-Za-z0-9_+.-]*)\s*\n?[\s\S]*?(?:\x60{3}|~{3})/gu,(_m,lang)=>{
    const label=compact(lang);
    return `\nBloque de código${label?' '+label:''} omitido de la lectura. El código permanece disponible en pantalla.\n`;
  });
  const lines=raw.split('\n'),spoken=[];
  for(let i=0;i<lines.length;){
    const table=tableSpeech(lines,i);
    if(table){spoken.push(table.spoken);i=table.next;continue}
    let line=lines[i++];
    if(!line.trim()){spoken.push('');continue}
    line=line
      .replace(/^\s{0,3}#{1,6}\s+(.+)$/u,'$1.')
      .replace(/^\s*(\d+)[.)]\s+(.+)$/u,'Paso $1. $2')
      .replace(/^\s*[-+*•▪◦●○■□◆◇►▶]\s+(.+)$/u,'Punto. $1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/gu,(_m,alt)=>alt?`Imagen: ${alt}.`:'Imagen disponible en pantalla.')
      .replace(/\[([^\]]+)\]\([^)]*\)/gu,'$1')
      .replace(/\[(?:W|M|MEM)\d+\]/giu,' ')
      .replace(/https?:\/\/\S+|www\.\S+/giu,' enlace disponible en pantalla ')
      .replace(/<br\s*\/?>/giu,'\n')
      .replace(/<[^>]+>/gu,' ');
    spoken.push(line);
  }
  let out=spoken.join('\n');
  out=out
    .replace(/\bMXN\s*\$?\s*([\d.,]+)/giu,'$1 pesos mexicanos')
    .replace(/\$\s*([\d.,]+)\s*MXN\b/giu,'$1 pesos mexicanos')
    .replace(/\bUSD\s*\$?\s*([\d.,]+)/giu,'$1 dólares estadounidenses')
    .replace(/\$\s*([\d.,]+)\s*USD\b/giu,'$1 dólares estadounidenses')
    .replace(/€\s*([\d.,]+)/gu,'$1 euros')
    .replace(/£\s*([\d.,]+)/gu,'$1 libras esterlinas')
    .replace(/\$\s*([\d.,]+)/gu,locale.toLowerCase()==='es-mx'?'$1 pesos':'$1 unidades monetarias')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*%/gu,'$1 por ciento')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/gu,(_m,y,m,d)=>spokenDate(y,m,d))
    .replace(/\b(\d+(?:[.,]\d+)?)\s*km\/h\b/giu,'$1 kilómetros por hora')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*km\b/giu,'$1 kilómetros')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*kg\b/giu,'$1 kilogramos')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*cm\b/giu,'$1 centímetros')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*mm\b/giu,'$1 milímetros')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(GB|MB|TB)\b/gu,(_m,n,u)=>`${n} ${({GB:'gigabytes',MB:'megabytes',TB:'terabytes'})[u]}`)
    .replace(/\b(\d+(?:[.,]\d+)?)\s*ms\b/giu,'$1 milisegundos')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*°\s*C\b/giu,'$1 grados Celsius')
    .replace(/(^|[\s(])-(\d+(?:[.,]\d+)?)/gu,'$1menos $2')
    .replace(/\x60([^\x60\n]+)\x60/gu,' $1 ')
    .replace(/\*\*|__|~~|[*_~\x60#@]/gu,' ')
    .replace(/[→⇒➜➝➞➡⟶⟹↦↪]/gu,', ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,' ')
    .replace(/[{}<>]/gu,' ')
    .replace(/[“”„‟"«»]/gu,' ')
    .replace(/^\s*[-*_#=]{2,}\s*$/gmu,' ')
    .replace(/[ \t]+/gu,' ')
    .replace(/\s+([,.;:!?])/gu,'$1')
    .replace(/([,.;:!?]){2,}/gu,'$1')
    .replace(/\n{3,}/gu,'\n\n')
    .replace(/^\s+|\s+$/gu,'');
  return out.slice(0,12000);
}
if(typeof window!=='undefined')window.WAESemanticSpeech=semanticSpeech;
if(typeof module!=='undefined'&&module.exports)module.exports={semanticSpeech};
})();