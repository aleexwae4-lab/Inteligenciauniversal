import * as cheerio from 'cheerio';
import { sanitizeWebText } from './security-v1.js';

export const STRUCTURED_DATA_VERSION='structured-data/v2.0.0';
const clean=(v,max=20000)=>String(v??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const abs=(href,base)=>{try{return new URL(href,base).toString()}catch{return null}};
const safeJson=value=>{try{return JSON.parse(value)}catch{return null}};
const flattenJsonLd=value=>{
  const out=[];
  const walk=v=>{
    if(!v)return;
    if(Array.isArray(v)){for(const x of v)walk(x);return}
    if(typeof v!=='object')return;
    if(Array.isArray(v['@graph']))walk(v['@graph']);
    if(v['@type']||v['@id']||v.headline||v.name||v.datePublished)out.push(v);
  };
  walk(value);return out.slice(0,50);
};
function schemaProjection(v={}){
  const pick=['@context','@type','@id','name','headline','description','datePublished','dateModified','author','publisher','mainEntityOfPage','url','identifier','sameAs'];
  const out={};for(const k of pick)if(v[k]!==undefined)out[k]=v[k];
  return out;
}
function selectMainText($){
  const candidates=['main','article','[role="main"]','.article-body','.article-content','.entry-content','#content'];
  for(const selector of candidates){
    const t=clean($(selector).first().text(),180000);
    if(t.length>=300)return{selector,text:t};
  }
  return{selector:'body',text:clean($('body').text(),180000)};
}
export function parseHtmlDocument(html='',url=''){
  const $=cheerio.load(String(html||''),{decodeEntities:true});
  $('script:not([type="application/ld+json"]),style,noscript,template,svg,canvas,form,button,nav,footer').remove();
  const title=clean($('title').first().text()||$('meta[property="og:title"]').attr('content')||$('h1').first().text(),800);
  const description=clean($('meta[name="description"]').attr('content')||$('meta[property="og:description"]').attr('content'),2000);
  const canonical=abs($('link[rel="canonical"]').attr('href')||url,url)||url;
  const language=clean($('html').attr('lang'),40)||null;
  const author=clean($('meta[name="author"]').attr('content')||$('[rel="author"]').first().text(),300)||null;
  const publishedAt=clean($('meta[property="article:published_time"]').attr('content')||$('[itemprop="datePublished"]').attr('content')||$('time[datetime]').first().attr('datetime'),100)||null;
  const modifiedAt=clean($('meta[property="article:modified_time"]').attr('content')||$('[itemprop="dateModified"]').attr('content'),100)||null;
  const jsonLd=[];
  $('script[type="application/ld+json"]').each((_,el)=>{const parsed=safeJson($(el).text());for(const row of flattenJsonLd(parsed))jsonLd.push(schemaProjection(row))});
  const headings=[];$('h1,h2,h3').each((_,el)=>{const value=clean($(el).text(),500);if(value)headings.push({level:String(el.tagName||'').toLowerCase(),text:value})});
  const links=[];$('a[href]').each((_,el)=>{const href=abs($(el).attr('href'),url);if(href)links.push({url:href,text:clean($(el).text(),240)})});
  const tables=[];$('table').slice(0,6).each((_,table)=>{
    const rows=[];$(table).find('tr').slice(0,80).each((__,tr)=>{
      const cells=[];$(tr).find('th,td').slice(0,20).each((___,cell)=>cells.push(clean($(cell).text(),500)));
      if(cells.some(Boolean))rows.push(cells);
    });if(rows.length)tables.push(rows);
  });
  const main=selectMainText($);
  const sanitized=sanitizeWebText(main.text,180000);
  return{kind:'html',title,description,canonical,language,author,publishedAt,modifiedAt,text:sanitized.text,mainSelector:main.selector,promptInjectionDetected:sanitized.injectionDetected,headings:headings.slice(0,80),links:links.slice(0,200),linkCount:links.length,structured:{jsonLd:jsonLd.slice(0,30),openGraph:{type:clean($('meta[property="og:type"]').attr('content'),100)||null,siteName:clean($('meta[property="og:site_name"]').attr('content'),200)||null},tables},version:STRUCTURED_DATA_VERSION};
}
export function parseJsonDocument(raw='',url=''){
  const data=safeJson(String(raw||''));if(data===null)throw new Error('invalid_json_document');
  const jsonLd=flattenJsonLd(data).map(schemaProjection);
  const title=clean(data?.title||data?.name||data?.headline,800);
  const description=clean(data?.description||data?.abstract||data?.summary,2000);
  const serialized=JSON.stringify(data);
  const sanitized=sanitizeWebText(serialized,180000);
  return{kind:'json',title,description,canonical:url,text:sanitized.text,promptInjectionDetected:sanitized.injectionDetected,structured:{jsonLd:jsonLd.slice(0,50),rootType:Array.isArray(data)?'array':typeof data},linkCount:0,version:STRUCTURED_DATA_VERSION};
}
export function parseXmlDocument(raw='',url=''){
  const $=cheerio.load(String(raw||''),{xmlMode:true,decodeEntities:true});
  const root=$.root().children().first().get(0)?.tagName||'xml';
  const feedItems=[];
  $('item,entry').slice(0,50).each((_,el)=>{
    const node=$(el);const link=node.find('link').attr('href')||node.find('link').first().text();
    feedItems.push({title:clean(node.find('title').first().text(),700),url:abs(link,url),publishedAt:clean(node.find('pubDate,published,updated').first().text(),120)||null,summary:clean(node.find('description,summary,content').first().text(),3000)});
  });
  const title=clean($('channel > title,feed > title').first().text(),800);
  const description=clean($('channel > description,feed > subtitle').first().text(),2000);
  const textBody=feedItems.length?feedItems.map(x=>[x.title,x.summary].filter(Boolean).join(' - ')).join('\n'):clean($.text(),180000);
  const sanitized=sanitizeWebText(textBody,180000);
  return{kind:/rss/i.test(root)?'rss':/feed/i.test(root)?'atom':'xml',title,description,canonical:url,text:sanitized.text,promptInjectionDetected:sanitized.injectionDetected,structured:{root,items:feedItems},linkCount:feedItems.filter(x=>x.url).length,version:STRUCTURED_DATA_VERSION};
}
export function parseTextDocument(raw='',url=''){
  const sanitized=sanitizeWebText(String(raw||''),180000);
  return{kind:'text',title:'',description:'',canonical:url,text:sanitized.text,promptInjectionDetected:sanitized.injectionDetected,structured:{},linkCount:0,version:STRUCTURED_DATA_VERSION};
}
