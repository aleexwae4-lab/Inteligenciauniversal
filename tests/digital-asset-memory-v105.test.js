import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DIGITAL_ASSET_MEMORY_V105,
  assetArchiveIntentV105,
  classifyDigitalAssetV105,
  digitalAssetMemoryCapabilitiesV105,
  formatLongitudinalArchiveV105,
} from '../lib/digital-asset-memory-v105.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('v105 classifies reusable answers as digital assets without inventing money',()=>{
  const asset=classifyDigitalAssetV105({
    userText:'Crea una estrategia de crecimiento para mi empresa',
    assistantText:'# Estrategia de crecimiento\nObjetivo: aumentar retención.\n1. Medir cohortes.\n2. Reducir fricción.\n3. Probar un programa de referidos.\n4. Revisar CAC y LTV cada semana.'
  });
  assert.equal(asset.version,DIGITAL_ASSET_MEMORY_V105);
  assert.equal(asset.assetType,'strategy');
  assert.equal(asset.reusable,true);
  assert.equal(asset.outcomeStatus,'unverified');
  assert.equal(asset.monetaryValue,null);
  assert.equal(asset.monetaryValueVerified,false);
});

test('v105 recognizes longitudinal book and life/work archive intents',()=>{
  const book=assetArchiveIntentV105('Crea un libro con todas mis conversaciones de cómo manejé mi vida con inteligencia artificial.');
  assert.equal(book.matched,true);
  assert.equal(book.longitudinal,true);
  const ordinary=assetArchiveIntentV105('Explícame qué es EBITDA.');
  assert.equal(ordinary.matched,false);
});

test('v105 packs authorized historical turns into bounded chronological archive blocks',()=>{
  const rows=Array.from({length:12},(_,i)=>({
    created_at:`2026-09-${String(i+1).padStart(2,'0')}T12:00:00.000Z`,
    user_text:`Solicitud ${i+1}`,
    assistant_text:`# Plan ${i+1}\nEste es un plan reutilizable con acciones, responsables, riesgos, métricas y siguientes pasos suficientemente detallados para convertirse en un activo digital del usuario.`
  }));
  const chunks=formatLongitudinalArchiveV105(rows,4);
  assert.ok(chunks.length<=4);
  assert.match(chunks[0].content,/ARCHIVO LONGITUDINAL DE ACTIVOS DEL USUARIO/);
  assert.match(chunks[0].content,/Usuario: Solicitud 1/);
  assert.equal(chunks[0].metadata.sourcePolicy,'user-owned-conversation-history');
  assert.equal(chunks[0].metadata.outcomePolicy,'do-not-invent-value');
});

test('v105 exposes asset, chronology, book, portfolio and outcome-integrity capabilities',()=>{
  const caps=digitalAssetMemoryCapabilitiesV105();
  assert.equal(caps.version,DIGITAL_ASSET_MEMORY_V105);
  assert.equal(caps.responseAsAsset,true);
  assert.equal(caps.persistentAssetIndex,true);
  assert.equal(caps.longitudinalConversationReconstruction,true);
  assert.equal(caps.bookFromAuthorizedConversationHistory,true);
  assert.equal(caps.professionalPortfolioFromHistory,true);
  assert.equal(caps.inventedMonetaryValueForbidden,true);
  assert.equal(caps.security.hashedUserKey,true);
});

test('memory runtime indexes assets and switches to longitudinal recall for archive requests',async()=>{
  const [memory,capabilities]=await Promise.all([read('lib/memory.js'),read('api/capabilities.js')]);
  assert.match(memory,/indexDigitalAssetV105/);
  assert.match(memory,/assetArchiveIntentV105/);
  assert.match(memory,/recallLongitudinalArchiveV105/);
  assert.match(memory,/formatLongitudinalArchiveV105/);
  assert.match(memory,/context-memory\/v105-digital-assets/);
  assert.match(capabilities,/digitalAssetMemoryCapabilitiesV105/);
  assert.match(capabilities,/digitalAssetMemory:/);
});
