import { sanitizeWebText } from './security-v1.js';
export const PDF_INTELLIGENCE_VERSION='pdf-intelligence/v2.0.0';
const clean=(v,max=180000)=>String(v??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=v=>clean(v,4000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function rankPdfPages(pages=[],query='',limit=4){
  const terms=[...new Set(norm(query).split(' ').filter(x=>x.length>2))].slice(0,24);
  return (Array.isArray(pages)?pages:[]).map(page=>{
    const hay=norm(page?.text||'');let hits=0;for(const term of terms)if(hay.includes(term))hits++;
    return{page:Number(page?.num)||0,text:clean(page?.text||'',12000),score:terms.length?hits/terms.length:0};
  }).filter(x=>x.page>0&&x.text).sort((a,b)=>b.score-a.score||a.page-b.page).slice(0,Math.max(1,Math.min(Number(limit)||4,8)));
}
export async function parsePdfBuffer(buffer,{query='',maxPages=80,extractTables=false}={}){
  const { PDFParse } = await import('pdf-parse');
  const parser=new PDFParse({data:new Uint8Array(buffer)});
  try{
    const textResult=await parser.getText({first:Math.max(1,Math.min(Number(maxPages)||80,200))});
    const infoResult=await parser.getInfo({parsePageInfo:true});
    let tableResult=null;
    if(extractTables){
      try{tableResult=await parser.getTable({first:Math.max(1,Math.min(Number(maxPages)||20,40))})}catch{}
    }
    const textSanitized=sanitizeWebText(clean(textResult?.text||'',180000),180000);
    const pages=(Array.isArray(textResult?.pages)?textResult.pages:[]).map(p=>({num:Number(p.num)||0,text:clean(p.text||'',18000)}));
    const relevantPages=rankPdfPages(pages,query,5);
    const info=infoResult?.infoData||infoResult?.info||{};
    const tables=[];
    for(const page of Array.isArray(tableResult?.pages)?tableResult.pages:[]){
      for(const table of Array.isArray(page?.tables)?page.tables:[])tables.push({page:Number(page.num)||null,rows:Array.isArray(table)?table.slice(0,100):[]});
    }
    return{
      kind:'pdf',title:clean(info?.Title,800),author:clean(info?.Author,300)||null,description:clean(info?.Subject,2000),
      publishedAt:clean(info?.CreationDate,120)||null,modifiedAt:clean(info?.ModDate,120)||null,totalPages:Number(textResult?.total||infoResult?.total||pages.length)||0,
      text:textSanitized.text,promptInjectionDetected:textSanitized.injectionDetected,pages:relevantPages,
      ocrRequired:clean(textResult?.text||'',10000).length<80&&(Number(textResult?.total||infoResult?.total||0)>0),
      structured:{tables:tables.slice(0,20),pageInfo:Array.isArray(infoResult?.pages)?infoResult.pages.slice(0,200).map(p=>({num:p.num,pageLabel:p.pageLabel||null,width:p.width||null,height:p.height||null,links:Array.isArray(p.links)?p.links.slice(0,40):[]})):[]},
      version:PDF_INTELLIGENCE_VERSION
    };
  } finally { await parser.destroy().catch(()=>{}); }
}
