import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, '..', 'src');
const apiRoot = path.resolve(__dirname, '..', '..', 'src');

const readUi = (relativePath) => fs.readFileSync(path.join(uiRoot, relativePath), 'utf8');
const readApi = (relativePath) => fs.readFileSync(path.join(apiRoot, relativePath), 'utf8');

const layout = readUi('components/common/SuperAdminLayout.jsx');
const service = readUi('services/superadminService.js');
const routes = readApi('routes/superadmin.routes.js');
const controller = readApi('controllers/superadmin.controller.js');

assert(routes.includes("router.get('/search', requireSuperadmin"), 'Global search route should exist and require superadmin.');
assert(routes.includes('authorize(SuperAdminPolicy.canViewPlatformStats)'), 'Global search route should use superadmin authorization policy.');
assert(controller.includes('slice(0, MAX_SEARCH_LENGTH)'), 'Search query should be capped to MAX_SEARCH_LENGTH.');
assert(controller.includes('const escapeRegex =') && controller.includes('buildSafeContainsRegex'), 'Search regex input should be escaped.');
assert(controller.includes("if (!searchRegex)"), 'Empty query should return empty grouped results.');
assert(controller.includes('emailMasked: maskEmail(admin.email)'), 'Admin search results should return only masked emails.');
assert(controller.includes('sanitizeAuditMetadata(row.metadata || {})'), 'Audit results should sanitize metadata output.');

assert(layout.includes('Global search'), 'SuperAdmin layout should include global search UI.');
assert(layout.includes('Search returns platform lifecycle/support metadata only.'), 'Global search privacy helper text should exist.');
assert(!/href\s*=\s*"#"/.test(layout), 'SuperAdmin layout should not include placeholder href="#" links.');
assert(service.includes('searchGlobal: async'), 'Superadmin service should include global search API method.');

const hrefMatches = [...layout.matchAll(/navigate\(([^)]+)\)/g)].map((match) => match[1]);
assert(hrefMatches.some((value) => value.includes('row.href')), 'Search result click should navigate using safe route hrefs.');

console.log('superadminGlobalSearchSource.test.mjs passed');
