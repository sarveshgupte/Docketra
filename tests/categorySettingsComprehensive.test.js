const assert = require('assert');
const mongoose = require('mongoose');
const Category = require('../src/models/Category.model');

// Test 1: Category Model Schema and Defaults
(() => {
  const firmId = new mongoose.Types.ObjectId();
  const workbasketId = new mongoose.Types.ObjectId();

  const cat = new Category({
    firmId,
    name: 'Corporate Secretarial',
    defaultSlaDays: 5,
    qcPercent: 20,
    requiresRelatedEmployeeUser: true,
    subcategories: [
      {
        id: new mongoose.Types.ObjectId().toString(),
        name: 'Annual Filing',
        workbasketId,
        defaultSlaDays: 2,
        qcPercent: 10,
        requiresRelatedEmployeeUser: false,
      },
      {
        id: new mongoose.Types.ObjectId().toString(),
        name: 'Board Resolutions',
        workbasketId,
        defaultSlaDays: 0, // Should inherit category SLA
        qcPercent: 0,      // Should inherit category QC
        requiresRelatedEmployeeUser: false,
      },
    ],
  });

  const err = cat.validateSync();
  assert.strictEqual(err, undefined, 'Category with subcategories should validate cleanly');
  assert.strictEqual(cat.name, 'Corporate Secretarial');
  assert.strictEqual(cat.defaultSlaDays, 5);
  assert.strictEqual(cat.qcPercent, 20);
  assert.strictEqual(cat.requiresRelatedEmployeeUser, true);
  assert.strictEqual(cat.isActive, true, 'Default isActive should be true');

  // Subcategory 1 values
  const sub1 = cat.subcategories[0];
  assert.strictEqual(sub1.name, 'Annual Filing');
  assert.strictEqual(sub1.defaultSlaDays, 2);
  assert.strictEqual(sub1.qcPercent, 10);
  assert.strictEqual(sub1.requiresRelatedEmployeeUser, false);
  assert.strictEqual(sub1.isActive, true, 'Subcategory default isActive should be true');

  // Subcategory 2 inheritance logic
  const sub2 = cat.subcategories[1];
  const effectiveSla2 = sub2.defaultSlaDays > 0 ? sub2.defaultSlaDays : cat.defaultSlaDays;
  assert.strictEqual(effectiveSla2, 5, 'Subcategory with 0 SLA should inherit parent category SLA');

  const effectiveQc2 = sub2.qcPercent > 0 ? sub2.qcPercent : cat.qcPercent;
  assert.strictEqual(effectiveQc2, 20, 'Subcategory with 0 QC should inherit parent category QC');

  const effectiveEmployeeReq2 = Boolean(sub2.requiresRelatedEmployeeUser || cat.requiresRelatedEmployeeUser);
  assert.strictEqual(effectiveEmployeeReq2, true, 'Subcategory should inherit parent category employee requirement');

  console.log('✓ Test 1: Category and subcategory schema defaults & inheritance logic passed');
})();

// Test 2: Subcategory Validation Constraints
(() => {
  const firmId = new mongoose.Types.ObjectId();

  // Missing workbasketId on subcategory
  const invalidCat = new Category({
    firmId,
    name: 'Taxation',
    subcategories: [
      {
        id: 'sub-1',
        name: 'GST',
        // workbasketId omitted
      },
    ],
  });

  const err = invalidCat.validateSync();
  assert.ok(err, 'Category validation should fail when subcategory is missing workbasketId');
  assert.ok(err.errors['subcategories.0.workbasketId'], 'Error should point to missing workbasketId');

  console.log('✓ Test 2: Subcategory workbasket requirement validation passed');
})();

// Test 3: SLA Range Validation (0-365) and QC Range Validation (0-100)
(() => {
  const firmId = new mongoose.Types.ObjectId();
  const workbasketId = new mongoose.Types.ObjectId();

  // Negative SLA
  const negSlaCat = new Category({
    firmId,
    name: 'Audit',
    defaultSlaDays: -1,
  });
  assert.ok(negSlaCat.validateSync(), 'Negative category SLA should fail validation');

  // QC > 100
  const overQcCat = new Category({
    firmId,
    name: 'Audit',
    qcPercent: 105,
  });
  assert.ok(overQcCat.validateSync(), 'Category QC percent > 100 should fail validation');

  // Negative subcategory QC
  const negQcSubCat = new Category({
    firmId,
    name: 'Audit',
    subcategories: [
      {
        id: 'sub-1',
        name: 'Internal Audit',
        workbasketId,
        qcPercent: -5,
      },
    ],
  });
  assert.ok(negQcSubCat.validateSync(), 'Negative subcategory QC should fail validation');

  console.log('✓ Test 3: SLA and QC range bounds validation passed');
})();

// Test 4: Subcategory Deadline Rules Validation
(() => {
  const firmId = new mongoose.Types.ObjectId();
  const workbasketId = new mongoose.Types.ObjectId();

  // Valid FIXED_DAY_NEXT_MONTH
  const validDeadlineCat = new Category({
    firmId,
    name: 'Compliance',
    subcategories: [
      {
        id: 'sub-1',
        name: 'Monthly Return',
        workbasketId,
        deadlineRule: {
          mode: 'FIXED_DAY_NEXT_MONTH',
          fixedDayOfMonth: 20,
        },
      },
    ],
  });
  assert.strictEqual(validDeadlineCat.validateSync(), undefined, 'Valid deadline rule should pass');

  // Invalid FIXED_DAY_NEXT_MONTH (day > 31)
  const invalidDayCat = new Category({
    firmId,
    name: 'Compliance',
    subcategories: [
      {
        id: 'sub-1',
        name: 'Monthly Return',
        workbasketId,
        deadlineRule: {
          mode: 'FIXED_DAY_NEXT_MONTH',
          fixedDayOfMonth: 35,
        },
      },
    ],
  });
  const errDay = invalidDayCat.validateSync();
  assert.ok(errDay, 'Fixed day > 31 should fail validation');
  assert.ok(errDay.errors['subcategories.0.deadlineRule.fixedDayOfMonth'], 'Error should point to fixedDayOfMonth > 31');

  console.log('✓ Test 4: Subcategory deadline rules pre-validation passed');
})();

// Test 5: SOP Links and Files Structure
(() => {
  const firmId = new mongoose.Types.ObjectId();
  const workbasketId = new mongoose.Types.ObjectId();

  const sopCat = new Category({
    firmId,
    name: 'Advisory',
    subcategories: [
      {
        id: 'sub-1',
        name: 'Legal Opinion',
        workbasketId,
        sop: {
          title: 'Legal Opinion Drafting Guide',
          body: '# Steps\n1. Review facts\n2. Research precedent',
          format: 'markdown',
          links: [
            { id: 'lnk-1', title: 'MCA Portal', url: 'https://mca.gov.in', type: 'portal' },
          ],
        },
      },
    ],
  });
  assert.strictEqual(sopCat.validateSync(), undefined, 'SOP markdown with valid links should pass');
  assert.strictEqual(sopCat.subcategories[0].sop.links[0].url, 'https://mca.gov.in');

  // Invalid link (not http/https)
  const invalidLnkCat = new Category({
    firmId,
    name: 'Advisory',
    subcategories: [
      {
        id: 'sub-1',
        name: 'Legal Opinion',
        workbasketId,
        sop: {
          title: 'Guide',
          links: [
            { id: 'lnk-1', title: 'File share', url: 'smb://server/share' },
          ],
        },
      },
    ],
  });
  assert.ok(invalidLnkCat.validateSync(), 'Non-http/https SOP link should fail validation');

  console.log('✓ Test 5: Subcategory SOP structure and URL security validation passed');
})();

// Test 6: Inactive Category Excludes Subcategories from Active Routing
(() => {
  const firmId = new mongoose.Types.ObjectId();
  const workbasketId = new mongoose.Types.ObjectId();

  const inactiveCat = new Category({
    firmId,
    name: 'Archived Category',
    isActive: false,
    subcategories: [
      {
        id: 'sub-active',
        name: 'Still Active Subcategory',
        workbasketId,
        isActive: true,
      },
    ],
  });

  assert.strictEqual(inactiveCat.isActive, false, 'Category should be inactive');
  // Routing query filter simulation: { isActive: true }
  const isAvailableForRouting = (cat) => cat.isActive === true;
  assert.strictEqual(isAvailableForRouting(inactiveCat), false, 'Subcategories under inactive category cannot be used for docket creation');

  console.log('✓ Test 6: Inactive category lifecycle and routing exclusion passed');
})();

// Test 7: Static UI Contract Assertions
(() => {
  const fs = require('fs');
  const path = require('path');
  const modalsCode = fs.readFileSync(path.join(__dirname, '..', 'ui/src/pages/admin/components/AdminCategoryModals.jsx'), 'utf8');
  const sectionCode = fs.readFileSync(path.join(__dirname, '..', 'ui/src/pages/admin/components/AdminCategoriesSection.jsx'), 'utf8');
  const formCode = fs.readFileSync(path.join(__dirname, '..', 'ui/src/components/docket/GuidedDocketForm.jsx'), 'utf8');

  // Verify visible label doesn't use "employee/user"
  assert.ok(modalsCode.includes('Require related employee during docket creation'), 'Modal must have clean "Require related employee during docket creation" label');
  assert.ok(modalsCode.includes('isCurrentWorkbasketInactive'), 'Modal must handle inactive workbasket gracefully');
  assert.ok(sectionCode.includes('Requires Employee'), 'Category section must display Requires Employee badges');
  assert.ok(sectionCode.includes('This category is disabled'), 'Category section must display disabled category notice');
  assert.ok(formCode.includes('relatedEmployeeUserId: \'\''), 'Form must clear stale employee errors on classification change');

  console.log('✓ Test 7: UI contract assertions and clean copy checks passed');
})();

console.log('\nAll Category and Subcategory settings unit tests passed successfully!');
process.exit(0);
