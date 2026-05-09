const assert = require('assert');
const { suggestDocketCategory } = require('../src/services/docketCategorySuggestion.service');

const categories = [{ _id: 'c1', name: 'Immigration', isActive: true, subcategories: [{ id: 's1', name: 'Visa Filing', isActive: true }] }];
const result = suggestDocketCategory({ firmId: 'f1', title: 'USCIS visa filing support', description: 'Need i-485 compliance review', categories });
assert.ok(result.suggestions.length > 0);
assert.strictEqual(result.suggestions[0].categoryId, 'c1');
assert.strictEqual(result.suggestions[0].subcategoryId, 's1');
assert.ok(['high', 'medium', 'low'].includes(result.suggestions[0].confidence));

const weak = suggestDocketCategory({ firmId: 'f1', title: 'Hi', description: '', categories });
assert.deepStrictEqual(weak.suggestions, []);
console.log('docketCategorySuggestion.service.test.js passed');
