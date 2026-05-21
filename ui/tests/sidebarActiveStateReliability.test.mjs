import assert from 'node:assert/strict';
import { ROUTES } from '../src/constants/routes.js';
import { isNavItemActive, isNavItemActiveWithLocation } from '../src/utils/navActive.js';

const firmSlug = 'acme-law';

const teamItem = {
  to: ROUTES.ADMIN(firmSlug),
  activeMatch: 'exactOrDescendant',
  excludeActiveFor: [ROUTES.ADMIN_REPORTS(firmSlug)],
};

const reportsItem = {
  to: ROUTES.ADMIN_REPORTS(firmSlug),
  activeMatch: 'exactOrDescendant',
};

assert.equal(isNavItemActive(ROUTES.ADMIN(firmSlug), teamItem), true, 'Team should be active on /admin');
assert.equal(isNavItemActive(ROUTES.ADMIN_REPORTS(firmSlug), teamItem), false, 'Team should not be active on /admin/reports');
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
