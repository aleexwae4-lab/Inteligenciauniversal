import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

const TYPE=new Set(['title','h1','h2','h3','p','li','quote','pre']);
export function sanitizeBlocks(value){
  if(!Array.isArray(value))throw Object.assign(new Error('blocks_invalid'),{statusCode:400});
  const entries=value.slice(0,250).map(x=>({
    type:TYPE.has(x?.type)?x.type:'p',
    text:typeof x?.text==='string'?x.text.replace(/\r\n?/g,'\n').trim().slice(0,8000):''
  })).filter(x=>x.text);
  if(!entries.length)throw Object.assign(new Error('document_empty'),{statusCode:400});
  if(entries.reduce((size,x)=>size+x.text.length,0)>55000)throw Object.assign(new Error('document_too_long'),{statusCode:413});
  return entries;
}
const heading={title:HeadingLevel.TITLE,h1:HeadingLevel.HEADING_1,h2:HeadingLevel.HEADING_2,h3:HeadingLevel.HEADING_3};
const cleanName=value=>String(value||'universal-core-documento').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,65)||'universal-core-documento';
async function makeDocx(blocks){
  const paragraphs=blocks.map(b=>new Paragraph({
    heading:heading[b.type],
    spacing:{after:b.type==='title'?260:b.type==='p'?145:85},
    children:[new TextRun({text:b.type==='li'?'• '+b.text:b.text,bold:b.type==='title'||/^h[1-3]$/.test(b.type),font:'Aptos'})]
  }));
  const doc=new Document({creator:'WAE OS Enterprise',title:blocks.find(x=>x.type==='title')?.text||'Universal Core',sections:[{properties:{},children:paragraphs}]});
  return Packer.toBuffer(doc);
}
function makePdf(blocks){
  return new Promise((resolve,reject)=>{
    const document=new PDFDocument({size:'A4',margin:56,info:{Title:blocks.find(x=>x.type==='title')?.text||'Universal Core',Creator:'WAE OS Enterprise'}});
    const parts=[];document.on('data',part=>parts.push(part));document.on('error',reject);document.on('end',()=>resolve(Buffer.concat(parts)));
    for(const block of blocks){
      const heading=/^(title|h1|h2|h3)$/.test(block.type),size=block.type==='title'?21:block.type==='h1'?17:block.type==='h2'?14:block.type==='h3'?12:10.5;
      document.moveDown(block.type==='title'?.8:block.type==='p'?.25:.2);
      document.font(heading?'Helvetica-Bold':'Helvetica').fontSize(size).fillColor('#172127');
      const value=block.type==='li'?'• '+block.text:block.text;
      document.text(value,{lineGap:2,paragraphGap:block.type==='p'?5:2});
    }
    document.end();
  });
}
export default async function exportHandler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  const format=String(req.body?.format||'');
  if(format!=='pdf'&&format!=='docx')return res.status(400).json({error:'unsupported_format'});
  const blocks=sanitizeBlocks(req.body?.blocks);
  const filename=cleanName(req.body?.filename);
  const content=format==='pdf'?await makePdf(blocks):await makeDocx(blocks);
  res.statusCode=200;
  res.setHeader('Content-Type',format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition','attachment; filename="'+filename+'.'+format+'"');
  res.setHeader('Content-Length',String(content.length));
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(content);
}
