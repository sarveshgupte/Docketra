const assert = require('assert');
const { sanitizePayload, enforceAllowedFields, PayloadValidationError } = require('../src/utils/payloadValidation');

function runTests() {
  console.log('Running payloadValidation tests...');

  // test sanitizePayload
  const raw = { a: 1, b: null, c: undefined, d: '', e: 'hello', f: false, g: 0 };
  const sanitized = sanitizePayload(raw);
  assert.deepStrictEqual(sanitized, { a: 1, e: 'hello', f: false, g: 0 }, 'sanitizePayload should keep false and 0 but remove empty string, null, undefined');

  // test enforceAllowedFields - valid
  const valid = enforceAllowedFields({ a: 1, b: 2 }, ['forbidden'], ['a', 'b']);
  assert.deepStrictEqual(valid, { a: 1, b: 2 });

  // test enforceAllowedFields - forbidden strip
  const withForbidden = enforceAllowedFields({ a: 1, forbidden: 'bad' }, ['forbidden'], ['a']);
  assert.deepStrictEqual(withForbidden, { a: 1 });

  // test enforceAllowedFields - unexpected
  assert.throws(() => {
    enforceAllowedFields({ a: 1, b: 2 }, [], ['a'], 'test');
  }, (err) => {
    return err instanceof PayloadValidationError && err.message === 'Unexpected field(s) in test: b';
  });

  console.log('payloadValidation tests passed!');
}

runTests();
