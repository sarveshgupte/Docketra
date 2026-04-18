#!/usr/bin/env node
const assert = require('assert');
const { parseCookieHeader, getCookieValue } = require('../src/utils/requestCookies');

function testParseCookieHeader() {
  console.log('Running testParseCookieHeader...');

  // Null/undefined/empty input
  assert.deepStrictEqual(parseCookieHeader(null), {});
  assert.deepStrictEqual(parseCookieHeader(undefined), {});
  assert.deepStrictEqual(parseCookieHeader(''), {});

  // Single cookie
  assert.deepStrictEqual(parseCookieHeader('foo=bar'), { foo: 'bar' });

  // Multiple cookies
  assert.deepStrictEqual(parseCookieHeader('foo=bar; baz=qux'), { foo: 'bar', baz: 'qux' });

  // Whitespace handling
  assert.deepStrictEqual(parseCookieHeader('  foo = bar  ;   baz=qux  '), { foo: 'bar', baz: 'qux' });

  // Key with no value
  assert.deepStrictEqual(parseCookieHeader('foo'), { foo: '' });
  assert.deepStrictEqual(parseCookieHeader('foo; bar=baz'), { foo: '', bar: 'baz' });

  // Key with empty value
  assert.deepStrictEqual(parseCookieHeader('foo=; bar=baz'), { foo: '', bar: 'baz' });

  // URL encoding
  assert.deepStrictEqual(parseCookieHeader('foo=%E2%9C%93'), { foo: '✓' });

  // Malformed URL encoding (should return raw value)
  assert.deepStrictEqual(parseCookieHeader('foo=%E2%9C'), { foo: '%E2%9C' });

  // Duplicate keys (first one should win based on implementation)
  assert.deepStrictEqual(parseCookieHeader('foo=bar; foo=baz'), { foo: 'bar' });

  // Empty entries
  assert.deepStrictEqual(parseCookieHeader('foo=bar;;baz=qux; ; '), { foo: 'bar', baz: 'qux' });

  console.log('testParseCookieHeader passed.');
}

function testGetCookieValue() {
  console.log('Running testGetCookieValue...');

  const header = 'foo=bar; baz=%E2%9C%93';

  // Basic retrieval
  assert.strictEqual(getCookieValue(header, 'foo'), 'bar');
  assert.strictEqual(getCookieValue(header, 'baz'), '✓');

  // Non-existent cookie
  assert.strictEqual(getCookieValue(header, 'missing'), null);

  // Missing name parameter
  assert.strictEqual(getCookieValue(header, null), null);
  assert.strictEqual(getCookieValue(header, ''), null);

  // Null/empty header
  assert.strictEqual(getCookieValue(null, 'foo'), null);
  assert.strictEqual(getCookieValue('', 'foo'), null);

  console.log('testGetCookieValue passed.');
}

function run() {
  try {
    testParseCookieHeader();
    testGetCookieValue();
    console.log('All requestCookies tests passed.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();
