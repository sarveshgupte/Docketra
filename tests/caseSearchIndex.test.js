const assert = require('assert');
const Case = require('../src/models/Case.model');

const run = async () => {
  const indexes = Case.schema.indexes();
  const hasTextIndex = indexes.some(([index]) => index.title === 'text' && index.description === 'text');
  assert.ok(hasTextIndex, 'Case model should expose text index on title and description');
  console.log('✓ case search text index test passed');
};

run().catch((error) => {
  console.error('case search index test failed:', error);
  process.exit(1);
});
