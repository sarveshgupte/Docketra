/**
 * Security Test: ReDoS Prevention
 * Verifies that escapeRegExp correctly handles special characters and prevents regex injection.
 */

const { escapeRegExp } = require('../../src/utils/regexp.utils');
const assert = require('assert');

function runTests() {
  console.log('Running ReDoS Prevention Tests...');

  // Test 1: Basic escaping
  const input1 = 'test.string*with+special?chars^$';
  const escaped1 = escapeRegExp(input1);
  assert.strictEqual(escaped1, 'test\\.string\\*with\\+special\\?chars\\^\\$');
  console.log('✓ Test 1: Basic escaping passed');

  // Test 2: All special characters
  const input2 = '.*+?^${}()|[]\\';
  const escaped2 = escapeRegExp(input2);
  assert.strictEqual(escaped2, '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  console.log('✓ Test 2: All special characters escaped passed');

  // Test 3: Literal matching in RegExp
  const input3 = 'evil(input|injection)';
  const escaped3 = escapeRegExp(input3);
  const regex3 = new RegExp(`^${escaped3}$`);
  assert.strictEqual(regex3.test('evil(input|injection)'), true);
  assert.strictEqual(regex3.test('evilinput'), false);
  assert.strictEqual(regex3.test('evilinjection'), false);
  console.log('✓ Test 3: Literal matching in RegExp passed');

  // Test 4: Potential ReDoS pattern
  // (a+)+b is a classic ReDoS pattern if input is a repeated 'a's without 'b' at the end
  const redosPattern = '(a+)+$';
  const escapedRedos = escapeRegExp(redosPattern);
  const regex4 = new RegExp(`^${escapedRedos}`);

  const safeStart = Date.now();
  const longA = 'a'.repeat(10000);
  assert.strictEqual(regex4.test(longA), false);
  const duration = Date.now() - safeStart;

  assert.ok(duration < 100, `Regex took too long: ${duration}ms`);
  console.log(`✓ Test 4: Potential ReDoS pattern neutralized (took ${duration}ms)`);

  // Test 5: Non-string input
  assert.strictEqual(escapeRegExp(null), '');
  assert.strictEqual(escapeRegExp(undefined), '');
  assert.strictEqual(escapeRegExp(123), '');
  console.log('✓ Test 5: Non-string input handled passed');

  console.log('\nAll ReDoS Prevention Tests Passed!');
}

try {
  runTests();
} catch (error) {
  console.error('\nTest Failed!');
  console.error(error);
  process.exit(1);
}
