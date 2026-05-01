import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/aiService.js'), 'utf8');
assert.ok(source.includes("api.get('/ai/configuration')"), 'getAiConfiguration should call GET /ai/configuration');
assert.ok(source.includes('response.data?.configuration'), 'getAiConfiguration should unwrap response.data.configuration');
assert.ok(source.includes("api.put('/ai/configuration', payload)"), 'updateAiConfiguration should call PUT /ai/configuration');
assert.ok(source.includes("api.post('/ai/test-configuration')"), 'testAiConfiguration should call POST /ai/test-configuration');
console.log('aiServiceContract.test.mjs passed');
