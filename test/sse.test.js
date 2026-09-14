import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSSE,parseOpenAIDataLine,safeReasoningStatus} from '../lib/sse.js';

test('encodes named SSE events',()=>assert.equal(encodeSSE('content.delta',{delta:'Hola'}),'event: content.delta\ndata: {"delta":"Hola"}\n\n'));
test('parses real OpenAI compatible delta',()=>assert.equal(parseOpenAIDataLine('data: {"choices":[{"delta":{"content":"Ho"}}]}').delta,'Ho'));
test('recognizes DONE',()=>assert.equal(parseOpenAIDataLine('data: [DONE]').done,true));
test('reasoning status cannot expose arbitrary text',()=>assert.equal(safeReasoningStatus('private chain of thought'),'analizando'));
