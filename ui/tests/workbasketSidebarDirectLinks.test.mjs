import assert from 'node:assert/strict';
import { getPlatformNavigation } from '../src/constants/platformNavigation.js';
import { ROUTES } from '../src/constants/routes.js';
import { isNavItemActive } from '../src/utils/navActive.js';

const firmSlug = 'acme-law';

const adminNav = getPlatformNavigation(firmSlug, {
  role: 'ADMIN',
  workbaskets: [{ _id: 'wb-1', name: 'Intake WB' }],
  qcWorkbaskets: [{ _id: 'qc-1', name: 'QC Alpha' }],
});
const adminItems = adminNav.flatMap((section) => section.items);
assert.ok(adminItems.some((item) => item.to === ROUTES.WORKBASKET_DETAIL(firmSlug, 'wb-1')), 'Admin should see assigned workbasket direct link');
assert.ok(adminItems.some((item) => item.to === ROUTES.QC_WORKBASKET_DETAIL(firmSlug, 'qc-1')), 'Admin should see assigned QC workbasket direct link');

const managerNav = getPlatformNavigation(firmSlug, {
  role: 'MANAGER',
  workbaskets: [{ _id: 'wb-2', name: 'Manager WB' }],
  qcWorkbaskets: [{ _id: 'qc-2', name: 'Manager QC' }],
});
const managerItems = managerNav.flatMap((section) => section.items);
assert.ok(managerItems.some((item) => item.to === ROUTES.WORKBASKET_DETAIL(firmSlug, 'wb-2')), 'Manager should see assigned workbasket direct link');
assert.ok(managerItems.some((item) => item.to === ROUTES.QC_WORKBASKET_DETAIL(firmSlug, 'qc-2')), 'Manager should see assigned QC workbasket direct link');

const employeeWithQcNav = getPlatformNavigation(firmSlug, {
  role: 'USER',
  workbaskets: [{ _id: 'wb-3', name: 'Employee WB' }],
  qcWorkbaskets: [{ _id: 'qc-3', name: 'Employee QC' }],
});
const employeeWithQcItems = employeeWithQcNav.flatMap((section) => section.items);
assert.ok(employeeWithQcItems.some((item) => item.to === ROUTES.WORKBASKET_DETAIL(firmSlug, 'wb-3')), 'Employee should see assigned workbasket direct link');
assert.ok(employeeWithQcItems.some((item) => item.to === ROUTES.QC_WORKBASKET_DETAIL(firmSlug, 'qc-3')), 'Employee should see QC link when explicitly assigned');

const employeeNoQcNav = getPlatformNavigation(firmSlug, {
  role: 'USER',
  workbaskets: [{ _id: 'wb-4', name: 'Employee WB No QC' }],
  qcWorkbaskets: [],
});
const employeeNoQcItems = employeeNoQcNav.flatMap((section) => section.items);
assert.ok(employeeNoQcItems.some((item) => item.to === ROUTES.WORKBASKET_DETAIL(firmSlug, 'wb-4')), 'Employee should still see assigned workbasket direct link');
assert.equal(employeeNoQcItems.some((item) => item.to.includes('/qc-workbaskets/')), false, 'Employee without QC assignment should not see QC links');

assert.equal(employeeNoQcItems.some((item) => item.to === ROUTES.GLOBAL_WORKLIST(firmSlug)), false, 'Sidebar should not rely on generic workbasket page link in direct assignment flow');

const directWorkbasketItem = { to: ROUTES.WORKBASKET_DETAIL(firmSlug, 'wb-4'), activeMatch: 'exactOrDescendant' };
assert.equal(isNavItemActive(ROUTES.WORKBASKET_DETAIL(firmSlug, 'wb-4'), directWorkbasketItem), true, 'Direct workbasket route should be active');
assert.equal(isNavItemActive(`${ROUTES.WORKBASKET_DETAIL(firmSlug, 'wb-4')}/details`, directWorkbasketItem), true, 'Direct workbasket descendant routes should remain active');

const hasDashboard = employeeNoQcItems.some((item) => item.to === ROUTES.DASHBOARD(firmSlug));
assert.equal(hasDashboard, false, 'Dashboard should remain absent/secondary from firm sidebar');

console.log('workbasketSidebarDirectLinks.test.mjs passed');
