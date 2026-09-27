import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/astra-regression.js';

test('astra regression endpoint is a real handler',()=>{
 assert.equal(typeof handler,'function');
});
