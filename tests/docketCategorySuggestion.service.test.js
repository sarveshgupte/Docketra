const assert = require('assert');
const { suggestDocketCategory } = require('../src/services/docketCategorySuggestion.service');

const categories = [
  { _id: 'tax1', name: 'Tax Compliance', isActive: true, subcategories: [{ id: 'gst1', name: 'GST Filing', isActive: true }, { id: 'tds1', name: 'TDS Returns', isActive: true }] },
  { _id: 'sec1', name: 'Secretarial', isActive: true, subcategories: [{ id: 'roc1', name: 'ROC Annual Filing', isActive: true }, { id: 'board1', name: 'Board Resolution', isActive: true }] },
  { _id: 'legal1', name: 'Legal Contracts', isActive: true, subcategories: [{ id: 'agr1', name: 'Agreement Drafting', isActive: true }, { id: 'notice1', name: 'Legal Notice Reply', isActive: true }] },
  { _id: 'inactive', name: 'Dormant', isActive: false, subcategories: [{ id: 'x', name: 'Ignore', isActive: true }] },
];

assert.strictEqual(suggestDocketCategory({ firmId: null, title: 'gst filing', description: 'gstr' , categories }).suggestions.length, 0);
assert.strictEqual(suggestDocketCategory({ firmId: 'f1', title: 'hi', description: '', categories }).suggestions.length, 0);

const tax = suggestDocketCategory({ firmId: 'f1', title: 'Need GST and GSTR filing with TDS reconciliation', description: 'Income tax notice and assessment support', categories });
assert.ok(tax.suggestions[0].categoryName.toLowerCase().includes('tax'));

const sec = suggestDocketCategory({ firmId: 'f1', title: 'MCA AOC-4 and MGT-7 due', description: 'Board meeting minutes and resolution drafting', categories });
assert.ok(sec.suggestions[0].categoryName.toLowerCase().includes('secretarial'));

const legal = suggestDocketCategory({ firmId: 'f1', title: 'Draft NDA and lease agreement', description: 'Reply to legal notice under contract terms', categories });
assert.ok(legal.suggestions[0].categoryName.toLowerCase().includes('legal'));

const inactiveHit = suggestDocketCategory({ firmId: 'f1', title: 'dormant ignore', description: 'ignore', categories });
assert.ok(!inactiveHit.suggestions.some((s) => s.categoryId === 'inactive'));

console.log('docketCategorySuggestion.service.test.js passed');
