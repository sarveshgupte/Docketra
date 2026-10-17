import assert from 'node:assert/strict';
import {
  STATUTORY_BLUEPRINTS,
  getBlueprintById,
  matchBlueprintToCategories,
} from '../src/components/docket/statutoryBlueprints.js';

// 1. Verify all 5 statutory presets are present
assert.strictEqual(STATUTORY_BLUEPRINTS.length, 5, 'Should define exactly 5 statutory blueprints');

const expectedIds = ['tax_audit_3cd', 'roc_annual_filing', 'dir3_kyc', 'gst_monthly', 'fema_fla'];
for (const id of expectedIds) {
  const bp = getBlueprintById(id);
  assert.ok(bp, `Blueprint ${id} should exist`);
  assert.ok(bp.name && bp.name.length > 0, `${id} should have a name`);
  assert.ok(bp.shortName && bp.shortName.length > 0, `${id} should have a shortName`);
  assert.ok(bp.authority && bp.authority.length > 0, `${id} should have an authority`);
  assert.ok(bp.defaultTitle && bp.defaultTitle.length > 5, `${id} should have defaultTitle`);
  assert.ok(bp.defaultDescription && bp.defaultDescription.length > 10, `${id} should have defaultDescription`);
  assert.ok(Array.isArray(bp.checklist) && bp.checklist.length >= 5, `${id} should have at least 5 checklist items`);

  for (const item of bp.checklist) {
    assert.ok(item.id, `Item in ${id} should have id`);
    assert.ok(item.title && item.title.trim().length > 0, `Item in ${id} should have title`);
    assert.strictEqual(typeof item.required, 'boolean', `Item in ${id} should have required boolean`);
  }
}

// 2. getBlueprintById returns null on unknown
assert.strictEqual(getBlueprintById('non_existent'), null);

// 3. Category matching - Exact category & subcategory match
const mockCategories = [
  {
    _id: 'cat-tax-1',
    name: 'Direct Taxation',
    isActive: true,
    subcategories: [
      { id: 'sub-3cd', name: 'Tax Audit u/s 44AB (Form 3CD)', isActive: true },
      { id: 'sub-itr', name: 'ITR-6 Corporate Returns', isActive: true },
    ],
  },
  {
    _id: 'cat-roc-2',
    name: 'MCA & Secretarial',
    isActive: true,
    subcategories: [
      { id: 'sub-roc', name: 'ROC Annual Filing AOC-4 / MGT-7', isActive: true },
      { id: 'sub-inc', name: 'Company Incorporation', isActive: true },
    ],
  },
  {
    _id: 'cat-gst-3',
    name: 'GST Compliance',
    isActive: true,
    subcategories: [
      { id: 'sub-gst-m', name: 'Monthly GSTR-1 and GSTR-3B Filing', isActive: true },
    ],
  },
];

const taxBlueprint = getBlueprintById('tax_audit_3cd');
const matchTax = matchBlueprintToCategories(mockCategories, taxBlueprint);
assert.strictEqual(matchTax.categoryId, 'cat-tax-1');
assert.strictEqual(matchTax.subcategoryId, 'sub-3cd');
assert.strictEqual(matchTax.matchedCategory.name, 'Direct Taxation');
assert.strictEqual(matchTax.matchedSubcategory.name, 'Tax Audit u/s 44AB (Form 3CD)');

const rocBlueprint = getBlueprintById('roc_annual_filing');
const matchRoc = matchBlueprintToCategories(mockCategories, rocBlueprint);
assert.strictEqual(matchRoc.categoryId, 'cat-roc-2');
assert.strictEqual(matchRoc.subcategoryId, 'sub-roc');

const gstBlueprint = getBlueprintById('gst_monthly');
const matchGst = matchBlueprintToCategories(mockCategories, gstBlueprint);
assert.strictEqual(matchGst.categoryId, 'cat-gst-3');
assert.strictEqual(matchGst.subcategoryId, 'sub-gst-m');

// 4. Category matching - Partial match (category matches, subcategory is not found)
const partialCategories = [
  {
    _id: 'cat-gen-tax',
    name: 'Taxation Services',
    isActive: true,
    subcategories: [
      { id: 'sub-gen', name: 'General Consultation', isActive: true },
    ],
  },
];
const matchPartial = matchBlueprintToCategories(partialCategories, taxBlueprint);
assert.strictEqual(matchPartial.categoryId, 'cat-gen-tax');
assert.strictEqual(matchPartial.subcategoryId, '');
assert.strictEqual(matchPartial.matchedSubcategory, null);

// 5. Category matching - Empty or no match
const matchEmpty = matchBlueprintToCategories([], taxBlueprint);
assert.strictEqual(matchEmpty.categoryId, '');
assert.strictEqual(matchEmpty.subcategoryId, '');

const unrelatedCategories = [
  { _id: 'cat-hr', name: 'Human Resources', isActive: true, subcategories: [] },
];
const matchUnrelated = matchBlueprintToCategories(unrelatedCategories, taxBlueprint);
assert.strictEqual(matchUnrelated.categoryId, '');
assert.strictEqual(matchUnrelated.subcategoryId, '');

console.log('statutoryBlueprints.test.mjs passed');
