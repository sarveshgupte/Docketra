const assert = require('assert');
const { _private } = require('../src/services/superadminFirmHealth.service');

assert.strictEqual(_private.clampScore(140), 100);
assert.strictEqual(_private.clampScore(-3), 0);
assert.strictEqual(_private.toRiskLevel(95), 'healthy');
assert.strictEqual(_private.toRiskLevel(65), 'watch');
assert.strictEqual(_private.toRiskLevel(45), 'at_risk');
assert.strictEqual(_private.toRiskLevel(20), 'critical');
assert.ok(_private.escapeRegex('a+b').includes('\\+'));
assert.strictEqual('x'.repeat(120).slice(0, _private.MAX_SEARCH_LENGTH).length, 100);
console.log('superadminFirmHealth.service.test.js passed');
