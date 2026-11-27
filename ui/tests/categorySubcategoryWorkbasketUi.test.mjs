import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relPath) => fs.readFileSync(path.resolve(uiRoot, relPath), 'utf8');

const modalsSource = read('src/pages/admin/components/AdminCategoryModals.jsx');
const sectionSource = read('src/pages/admin/components/AdminCategoriesSection.jsx');
const adminPageSource = read('src/pages/AdminPage.jsx');
const bulkPasteModalSource = read('src/pages/admin/components/AdminBulkPasteModal.jsx');
const serviceSource = read('src/services/categoryService.js');
const loaderSource = read('src/pages/admin/hooks/useAdminDataLoader.js');

// 1. AdminCategoryModals pairs every category & subcategory modal with primary WB + Linked QC WB
assert.ok(modalsSource.includes('const WorkbasketLinkField ='), 'AdminCategoryModals should extract shared WorkbasketLinkField component');
assert.ok(modalsSource.includes('Linked QC Workbasket:'), 'WorkbasketLinkField must display resolved linked QC workbasket');
assert.ok(modalsSource.includes('Selected workbasket does not have an active linked QC workbasket.'), 'WorkbasketLinkField must warn when QC workbasket is missing or inactive');
assert.ok((modalsSource.match(/<WorkbasketLinkField/g) || []).length === 4, 'All 4 modals (Create/Edit Category & Add/Edit Subcategory) must include WorkbasketLinkField');
assert.ok(modalsSource.includes("workbasket.type === 'PRIMARY'"), 'Modal workbasket selector must keep PRIMARY-only filtering');
assert.ok(modalsSource.includes('workbasket.isActive !== false'), 'Modal workbasket selector must exclude inactive workbaskets');
assert.ok(modalsSource.includes('isCurrentWorkbasketInactive'), 'Modal workbasket selector must keep inactive assignment notice');

// 2. AdminCategoriesSection renders both WB and QC WB for categories and subcategories
assert.ok(sectionSource.includes('WB: {categoryWbName}'), 'Category header must show linked Primary WB');
assert.ok(sectionSource.includes('QC WB: {linkedQc}'), 'Category header must show linked QC WB');
assert.ok(sectionSource.includes('Linked Workbasket'), 'Subcategory table must display Linked Workbasket column');
assert.ok(sectionSource.includes('Linked QC Workbasket'), 'Subcategory table must display Linked QC Workbasket column');

// 3. AdminPage enforces WB + linked QC WB on create/update/bulk paste & smart defaults
assert.ok(adminPageSource.includes('resolvePrimaryAndQcLink'), 'AdminPage must enforce both primary WB and linked QC WB before saving');
assert.ok(adminPageSource.includes('findEligiblePrimaryAndQc'), 'AdminPage bulk paste must match active PRIMARY WB with active linked QC WB');
assert.ok(bulkPasteModalSource.includes('Paste 2 columns: CategoryName, Workbasket'), 'Category bulk paste instructions must require CategoryName and Workbasket');
assert.ok(bulkPasteModalSource.includes('Paste 3 columns: CategoryName, SubcategoryName, Workbasket'), 'Subcategory bulk paste instructions must require CategoryName, SubcategoryName, Workbasket');

// 4. Data loader includes inactive WBs in categories tab so inactive assignments remain visible
assert.ok(loaderSource.includes("fetchWorkbaskets({ includeInactive: true })"), 'Categories tab should load workbaskets with includeInactive: true for safe inspection/reassignment');

// 5. categoryService exposes workbasketId & qcWorkbasketId cleanly while preserving existing signatures
assert.ok(serviceSource.includes('workbasketId: options.workbasketId'), 'categoryService must pass workbasketId for category create/update');
assert.ok(serviceSource.includes('qcWorkbasketId: options.qcWorkbasketId'), 'categoryService must pass qcWorkbasketId for category/subcategory create & update');

console.log('categorySubcategoryWorkbasketUi.test.mjs passed');
