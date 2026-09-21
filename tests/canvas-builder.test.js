import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../canvas-builder-v1.js',import.meta.url),'utf8');
const window={};vm.runInNewContext(source,{window});const builder=window.WAECanvasBuilder;
const plan={brand:'Café Aroma',eyebrow:'Café de especialidad',headline:'Una pausa con sabor a origen',subheadline:'Descubre café recién tostado y bebidas preparadas para disfrutar cada momento.',cta:'Conoce el menú',story:'Seleccionamos granos y preparamos cada taza con cuidado.',contact:'Conoce nuestras bebidas y pregunta por la selección del día.',palette:'warm',features:[{title:'Espresso',description:'Preparado al momento con aroma intenso y textura equilibrada.'},{title:'Latte',description:'Café con leche y una textura suave que acompaña tu mañana.'},{title:'Café de origen',description:'Conoce distintos perfiles aromáticos según la selección disponible.'}],slides:[{title:'Bienvenido a Café Aroma',body:'Explora una propuesta de café de especialidad y momentos tranquilos.'},{title:'Nuestro café',body:'Conoce el proceso de selección y preparación de cada bebida.'},{title:'Visítanos',body:'Descubre el menú y elige tu próxima taza favorita.'}]};
test('AI blueprint yields complete self-contained high-detail landing without HTML model truncation',()=>{
 const parsed=builder.parse(JSON.stringify(plan),'landing','Crea una landing para Café Aroma');
 const html=builder.build(parsed);
 assert.match(html,/^<!doctype html>/);
 assert.match(html,/<\/body><\/html>$/);
 assert.match(html,/Café Aroma/);
 assert.match(html,/Una pausa con sabor a origen/);
 assert.match(html,/Espresso/);
 assert.match(html,/Latte/);
 assert.match(html,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(html,/@media\(max-width:760px\)/);
 assert.match(html,/href="#contacto"/);
 assert.doesNotMatch(html,/https?:\/\/|cdn\./i);
 assert.ok(html.length>3600);
});
test('AI blueprint parser rejects incomplete data, generic branding and injected markup',()=>{
 assert.throws(()=>builder.parse('{"brand":"Café Aroma"','landing','Café Aroma'));
 assert.throws(()=>builder.parse(JSON.stringify({...plan,brand:'WAE OS'}),'landing','Café Aroma'),/marca distinta/);
 assert.throws(()=>builder.parse(JSON.stringify({...plan,brand:'WAE OS Enterprise'}),'landing','Café Aroma'),/marca distinta/);
 assert.throws(()=>builder.parse(JSON.stringify({...plan,features:[{title:'Innovación',description:'Descripción demasiado genérica sin identidad.'},{title:'Confianza',description:'Descripción demasiado genérica sin identidad.'},{title:'Resultados',description:'Descripción demasiado genérica sin identidad.'}]}),'landing','Café Aroma'),/ejemplo genérico/);
 assert.throws(()=>builder.parse(JSON.stringify({...plan,features:[]}), 'landing','Café Aroma'),/contenido suficiente/);
 const raw=JSON.stringify({...plan,headline:'Café <script>alert(1)</script> Aroma'});
 const html=builder.build(builder.parse(raw,'landing','Café Aroma'));
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/&lt;script&gt;/);
});
test('presentation and prototype are interactive, contextual, and not fake numerical dashboards',()=>{
 for(const kind of ['slides','prototype']){
  const html=builder.build(builder.parse(JSON.stringify(plan),kind,'Café Aroma'));
  assert.match(html,/Bienvenido a Café Aroma/);
  assert.match(html,/<button/);
  assert.match(html,/<script>/);
  assert.doesNotMatch(html,/Tu próximo gran producto/);
  assert.match(html,/<\/body><\/html>$/);
 }
});

test('offline drafts are clearly labeled, specific to user brief, and generated for chosen artifact kind',()=>{
 for(const kind of ['landing','slides','prototype']){
  const result=builder.draft('Crear una landing para Café Aroma',kind);
  assert.match(result.html,/Café Aroma/i);
  assert.match(result.html,/Borrador local ilustrativo/);
  assert.match(result.html,/no generado por IA/);
  assert.doesNotMatch(result.html,/WAE OS · LANDING PAGE|Tu próximo gran producto/);
  if(kind==='slides')assert.match(result.html,/Diapositiva 3/);
  if(kind==='prototype')assert.match(result.html,/Paso 03/);
 }
});

test('premium landing includes responsive original coffee illustration without remote assets',()=>{
 const html=builder.build(builder.parse(JSON.stringify(plan),'landing','Café Aroma'));
 assert.match(html,/hero-grid/);
 assert.match(html,/hero-visual/);
 assert.match(html,/Ilustración editorial de taza de café/);
 assert.match(html,/<svg/);
 assert.match(html,/grid-template-columns:minmax\(0,1\.1fr\)/);
 assert.doesNotMatch(html,/<img[^>]+https?:\/\//);
});
test('dashboard is an actual dashboard with empty data states, not a landing with invented KPIs',()=>{
 const html=builder.build(builder.parse(JSON.stringify(plan),'dashboard','Café Aroma'));
 assert.match(html,/Sin datos conectados/);
 assert.match(html,/conecta fuentes reales/);
 assert.doesNotMatch(html,/\$120,000|240 · Ejemplo/);
 assert.doesNotMatch(html,/href="#experiencia"/);
});
