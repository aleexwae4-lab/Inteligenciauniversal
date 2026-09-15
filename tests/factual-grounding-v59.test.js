import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldGroundStableFacts, retrieveFactualGrounding, groundingSources, FACTUAL_GROUNDING_VERSION } from '../lib/factual-grounding-v59.js';

function jsonResponse(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}})}

function fakeFetch(input){
  const url=new URL(String(input));
  if(url.hostname==='es.wikipedia.org'&&url.searchParams.get('list')==='search'){
    return Promise.resolve(jsonResponse({query:{search:[{pageid:101,title:'¿Quién se ha llevado mi queso?'}]}}));
  }
  if(url.hostname==='en.wikipedia.org'&&url.searchParams.get('list')==='search'){
    return Promise.resolve(jsonResponse({query:{search:[{pageid:202,title:'Who Moved My Cheese?'}]}}));
  }
  if(url.hostname==='es.wikipedia.org'&&url.searchParams.get('prop')){
    return Promise.resolve(jsonResponse({query:{pages:{101:{pageid:101,title:'¿Quién se ha llevado mi queso?',fullurl:'https://es.wikipedia.org/wiki/%C2%BFQui%C3%A9n_se_ha_llevado_mi_queso%3F',extract:'Es una fábula empresarial de Spencer Johnson sobre cuatro personajes que afrontan el cambio.'}}}}));
  }
  if(url.hostname==='en.wikipedia.org'&&url.searchParams.get('prop')){
    return Promise.resolve(jsonResponse({query:{pages:{202:{pageid:202,title:'Who Moved My Cheese?',fullurl:'https://en.wikipedia.org/wiki/Who_Moved_My_Cheese%3F',extract:'The story features two mice, Sniff and Scurry, and two Littlepeople, Hem and Haw, in a maze.'}}}}));
  }
  if(url.hostname==='www.googleapis.com'){
    return Promise.resolve(jsonResponse({items:[{volumeInfo:{title:'Who Moved My Cheese?',authors:['Spencer Johnson'],publishedDate:'1998',infoLink:'https://books.google.com/books?id=test',description:'A parable about anticipating, adapting to, and embracing change.'}}]}));
  }
  return Promise.resolve(jsonResponse({},404));
}

test('book plot and character questions activate stable factual grounding',()=>{
  assert.equal(shouldGroundStableFacts('¿De qué trata el libro Quién se ha llevado mi queso?'),true);
  assert.equal(shouldGroundStableFacts('Escribe un correo breve'),false);
});

test('factual grounding federates public reference evidence without inventing details',async()=>{
  const result=await retrieveFactualGrounding({message:'¿De qué trata el libro Quién se ha llevado mi queso y quiénes son sus personajes?',force:true,fetchImpl:fakeFetch});
  assert.equal(result.version,FACTUAL_GROUNDING_VERSION);
  assert.equal(result.used,true);
  assert.ok(result.sourceCount>=2);
  assert.match(result.context,/Sniff and Scurry/);
  assert.match(result.context,/Hem and Haw/);
  assert.match(result.context,/no afirmes un detalle que contradiga esta evidencia/i);
  const sources=groundingSources(result);
  assert.ok(sources.every(x=>/^K\d+$/.test(x.key)));
  assert.ok(sources.some(x=>x.host==='en.wikipedia.org'));
});
