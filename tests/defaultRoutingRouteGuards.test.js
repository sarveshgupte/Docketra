const fs = require('fs');
const path = require('path');

describe('default routing route guards', () => {
  test('default routing endpoint is protected by primary admin + permissions', () => {
    const routeFile = fs.readFileSync(path.join(__dirname, '../src/routes/admin.routes.js'), 'utf8');
    expect(routeFile).toContain("router.post('/work-settings/default-routing'");
    expect(routeFile).toContain("requirePrimaryAdmin");
    expect(routeFile).toContain("authorizeFirmPermission('WORKBASKET_MANAGE')");
    expect(routeFile).toContain("authorizeFirmPermission('CATEGORY_MANAGE')");
  });
});
