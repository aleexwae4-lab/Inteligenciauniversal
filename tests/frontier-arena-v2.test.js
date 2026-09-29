import test from 'node:test';import assert from 'node:assert/strict';import {ARENA_CASES} from '../lib/frontier-arena-v2.js';
test('arena contains independent capability cases',()=>{assert.ok(ARENA_CASES.length>=8);assert.ok(new Set(ARENA_CASES.map(x=>x.domain)).size>=5);assert.ok(ARENA_CASES.every(x=>x.grade));});
