import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const loaderSource = read('src/pages/admin/hooks/useAdminDataLoader.js');
assert.ok(loaderSource.includes('loadAdminData'), 'Shared admin data hook should expose loadAdminData');
assert.ok(loaderSource.includes('loadAdminStats'), 'Shared admin data hook should expose loadAdminStats');
assert.ok(loaderSource.includes('fetchWorkbaskets'), 'Shared admin data hook should expose workbasket loading');

const clientsSource = read('src/pages/admin/components/AdminClientsSection.jsx');
assert.ok(clientsSource.includes('Client Management'), 'Clients section should keep existing heading');
assert.ok(clientsSource.includes('Bulk Paste'), 'Clients section should expose bulk paste action');

const categoriesSource = read('src/pages/admin/components/AdminCategoriesSection.jsx');
assert.ok(categoriesSource.includes('Category Management'), 'Categories section should keep existing heading');
assert.ok(categoriesSource.includes('Add Subcategory'), 'Categories section should support subcategory composition');

console.log('adminArchitectureSmoke.test.mjs passed');
