import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function loadBrowserScript(path){
  const window={};
  const module={exports:{}};
  vm.runInNewContext(read(path),{window,module,console});
  return {window,exports:module.exports};
}

test('v142 semantic voice narrates tables, currency, percentages, dates and units',()=>{
  const {window}=loadBrowserScript('semantic-speech-v142.js');
  const spoken=window.WAESemanticSpeech(`### Informe financiero
| KPI | Valor |
|---|---|
| Margen | 35% |
| Ingreso | $1,250 MXN |
| Egreso | USD $950 |

Fecha: 2026-09-25.
Velocidad: 80 km/h.`);
  assert.match(spoken,/Informe financiero\./);
  assert.match(spoken,/Tabla\. Columnas: KPI, Valor\./);
  assert.match(spoken,/Fila 1\. KPI: Margen; Valor: 35 por ciento\./);
  assert.match(spoken,/1,250 pesos mexicanos/);
  assert.match(spoken,/950 dólares estadounidenses/);
  assert.match(spoken,/25 de septiembre de 2026/);
  assert.match(spoken,/80 kilómetros por hora/);
  assert.doesNotMatch(spoken,/[#*`|{}]/);
  assert.doesNotMatch(spoken,/pesos\. pesos|950\. dólares/);
});

test('v142 semantic voice summarizes code and keeps links visual instead of spelling syntax',()=>{
  const {window}=loadBrowserScript('semantic-speech-v142.js');
  const spoken=window.WAESemanticSpeech(`Consulta [documentación](https://example.com/docs).
\`\`\`js
const total = items.reduce((a,b)=>a+b,0);
\`\`\`
Más detalles: https://example.com/a-b`);
  assert.match(spoken,/Consulta documentación/);
  assert.match(spoken,/Bloque de código js omitido de la lectura/);
  assert.match(spoken,/código permanece disponible en pantalla/);
  assert.match(spoken,/enlace disponible en pantalla/);
  assert.doesNotMatch(spoken,/https?:\/\//);
  assert.doesNotMatch(spoken,/reduce\(/);
});

test('v142 semantic chunks preserve semantic content without cutting words',()=>{
  const semantic=loadBrowserScript('semantic-speech-v142.js').window.WAESemanticSpeech;
  const chunks=loadBrowserScript('speech-chunks.js').window.WAESpeechChunks;
  const spoken=semantic(`| Área | Estado |
|---|---|
| Voz | Activa |
| Chat | Operativo |

\`\`\`ts
const x=1;
\`\`\``);
  const output=chunks(spoken,180);
  const rebuilt=output.join(' ');
  assert.ok(output.length>=1);
  assert.equal(rebuilt,spoken.replace(/\s+/g,' ').trim());
  assert.ok(output.every(v=>v.length<=180));
  assert.match(rebuilt,/Tabla\. Columnas: Área, Estado\./);
  assert.match(rebuilt,/Fila 1\. Área: Voz; Estado: Activa\./);
  assert.match(rebuilt,/Bloque de código ts omitido/);
  for(let i=0;i<output.length-1;i++){
    assert.doesNotMatch(output[i],/[\p{L}\p{N}]$/u);
    assert.doesNotMatch(output[i+1],/^[\p{L}\p{N}]/u);
  }
});

test('v142 PWA loads semantic renderer before chunker and premium playback, with exact cache parity',()=>{
  const html=read('index.html'),sw=read('sw.js'),renderer=read('premium-render-v1.js');
  const semanticAsset=html.match(/\.\/semantic-speech-v142\.js\?[^"'<>\s]+/)?.[0];
  const chunksAsset=html.match(/\.\/speech-chunks\.js\?[^"'<>\s]+/)?.[0];
  const premiumAsset=html.match(/\.\/premium-render-v1\.js\?[^"'<>\s]+/)?.[0];
  assert.ok(semanticAsset&&chunksAsset&&premiumAsset);
  assert.ok(html.indexOf(semanticAsset)<html.indexOf(chunksAsset));
  assert.ok(html.indexOf(chunksAsset)<html.indexOf(premiumAsset));
  assert.ok(sw.includes(semanticAsset));
  assert.ok(sw.includes(chunksAsset));
  assert.ok(sw.includes(premiumAsset));
  assert.match(sw,/voice-v143/);
  assert.match(renderer,/window\.WAESemanticSpeech\?window\.WAESemanticSpeech/);
  assert.match(renderer,/setChunkProgress\(button,index,chunks\.length,'cloud'\)/);
  assert.match(renderer,/setChunkProgress\(button,index,chunks\.length,'browser'\)/);
});