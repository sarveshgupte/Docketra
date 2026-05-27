import assert from 'node:assert/strict';
import { ROUTES } from '../src/constants/routes.js';
import { getPlatformNavigation } from '../src/constants/platformNavigation.js';
import { isNavItemActive, isNavItemActiveWithLocation } from '../src/utils/navActive.js';

const firmSlug = 'acme-law';
const adminNavigation = getPlatformNavigation(firmSlug, { role: 'ADMIN', permissions: ['clients:manage'] });
const adminSection = adminNavigation.find((section) => section.section === 'Administration');
assert.deepEqual(adminSection.items.map((item) => item.id), ['settings'], 'Administration should render one clean Settings item');
assert.equal(adminSection.items[0].label, 'Settings', 'Administration should show a single Settings label in sidebar');

const managerNavigation = getPlatformNavigation(firmSlug, { role: 'MANAGER' });
const managerAdminSection = managerNavigation.find((section) => section.section === 'Administration');
assert.deepEqual(managerAdminSection.items.map((item) => item.id), ['settings'], 'Manager sidebar should keep a single Settings item');

const teamItem = {
  to: ROUTES.ADMIN(firmSlug),
  activeMatch: 'exactOrDescendant',
  excludeActiveFor: [ROUTES.ADMIN_REPORTS(firmSlug), ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug)],
};

const reportsItem = {
  to: ROUTES.ADMIN_REPORTS(firmSlug),
  activeMatch: 'exactOrDescendant',
};

assert.equal(isNavItemActive(ROUTES.ADMIN(firmSlug), teamItem), true, 'Team should be active on /admin');
assert.equal(isNavItemActive(ROUTES.ADMIN_REPORTS(firmSlug), teamItem), false, 'Team should not be active on /admin/reports');
assert.equal(isNavItemActiveWithLocation(ROUTES.ADMIN(firmSlug), '?tab=categories&context=work-settings', teamItem), false, 'Team should not be active on category settings query route');
assert.equal(isNavItemActive(`${ROUTES.ADMIN(firmSlug)}/hierarchy`, teamItem), true, 'Team should remain active on nested team pages');
assert.equal(isNavItemActive(ROUTES.ADMIN_REPORTS(firmSlug), reportsItem), true, 'Reports should be active on /admin/reports');
assert.equal(isNavItemActive(`${ROUTES.ADMIN_REPORTS(firmSlug)}/detailed`, reportsItem), true, 'Reports should stay active on report children');
assert.equal(isNavItemActive(ROUTES.ADMIN(firmSlug), reportsItem), false, 'Reports should not be active on /admin');

const settingsItem = {
  to: ROUTES.SETTINGS(firmSlug),
  activeMatch: 'exactOrDescendant',
};
assert.equal(isNavItemActive(`${ROUTES.SETTINGS(firmSlug)}/firm`, settingsItem), true, 'Settings should stay active on settings subpages');
assert.equal(isNavItemActive(ROUTES.ADMIN(firmSlug), settingsItem), false, 'Settings should not be active outside settings routes');

const generalSettingsItem = {
  to: ROUTES.SETTINGS(firmSlug),
  activeMatch: 'exact',
};
assert.equal(isNavItemActive(`${ROUTES.SETTINGS(firmSlug)}/firm`, generalSettingsItem), false, 'General settings should only be active on the settings hub itself');

const crmItem = {
  to: ROUTES.CRM(firmSlug),
  activeMatch: 'exactOrDescendant',
};
assert.equal(isNavItemActive(`${ROUTES.CRM(firmSlug)}/clients/123`, crmItem), true, 'CRM should stay active on CRM child routes');
assert.equal(isNavItemActive(ROUTES.CMS(firmSlug), crmItem), false, 'CRM should not be active for CMS routes');

console.log('sidebarActiveStateReliability.test.mjs passed');

const scopedWorklistA = { to: `${ROUTES.WORKLIST(firmSlug)}?workbasketId=a`, activeMatch: 'exactWithQuery' };
const scopedWorklistB = { to: `${ROUTES.WORKLIST(firmSlug)}?workbasketId=b`, activeMatch: 'exactWithQuery' };
assert.equal(isNavItemActiveWithLocation(ROUTES.WORKLIST(firmSlug), '?workbasketId=a', scopedWorklistA), true, 'Worklist child A should be active when query matches');
assert.equal(isNavItemActiveWithLocation(ROUTES.WORKLIST(firmSlug), '?workbasketId=b', scopedWorklistA), false, 'Worklist child A should be inactive when query differs');
assert.equal(isNavItemActiveWithLocation(ROUTES.WORKLIST(firmSlug), '?workbasketId=b', scopedWorklistB), true, 'Worklist child B should be active when query matches');
