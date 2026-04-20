const assert = require('assert');
const routeSchemas = require('../src/schemas/admin.routes.schema');
const adminRoutesSource = require('fs').readFileSync(require('path').resolve(__dirname, '../src/routes/admin.routes.js'), 'utf8');
const adminApiSource = require('fs').readFileSync(require('path').resolve(__dirname, '../ui/src/api/admin.api.js'), 'utf8');

assert.ok(routeSchemas['GET /cms-intake-settings'], 'Admin route schema should validate GET /cms-intake-settings');
assert.ok(routeSchemas['PUT /cms-intake-settings'], 'Admin route schema should validate PUT /cms-intake-settings');
assert.ok(routeSchemas['POST /cms-intake-settings/intake-api-key/regenerate'], 'Admin route schema should validate key regeneration route');

assert.ok(adminRoutesSource.includes("router.get('/cms-intake-settings'"), 'Admin routes should expose intake settings read endpoint');
assert.ok(adminRoutesSource.includes("router.put('/cms-intake-settings'"), 'Admin routes should expose intake settings update endpoint');
assert.ok(adminRoutesSource.includes("router.post('/cms-intake-settings/intake-api-key/regenerate'"), 'Admin routes should expose intake API key regeneration endpoint');

assert.ok(adminApiSource.includes('getCmsIntakeSettings'), 'Admin frontend API should fetch intake settings');
assert.ok(adminApiSource.includes('updateCmsIntakeSettings'), 'Admin frontend API should save intake settings');
assert.ok(adminApiSource.includes('regenerateCmsIntakeApiKey'), 'Admin frontend API should regenerate intake API key');

console.log('cmsIntakeAdminRoutes.test.js passed');
