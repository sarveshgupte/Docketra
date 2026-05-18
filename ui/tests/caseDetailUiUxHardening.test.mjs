import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const page = read('src/pages/CaseDetailPage.jsx');
const overview = read('src/pages/caseDetail/CaseDetailOverviewPanel.jsx');
const modals = read('src/pages/caseDetail/CaseWorkflowModals.jsx');
const attachmentsPanel = read('src/pages/caseDetail/CaseDetailAttachmentsPanel.jsx');
const sidebar = read('src/components/docket/DocketSidebar.jsx');
const access = read('src/pages/caseDetail/caseDetailAccess.js');
const summary = read('src/pages/caseDetail/CaseDetailSummaryHeader.jsx');
const activity = read('src/pages/caseDetail/CaseDetailActivityPanel.jsx');
const history = read('src/pages/caseDetail/CaseDetailHistoryPanel.jsx');

assert.ok(page.includes('isTerminalDocketLifecycle'), 'Terminal lifecycle policy should be explicit.');
assert.ok(page.includes("badges.push('Assigned Worklist')"), 'Location badges should differentiate assigned worklist vs my worklist.');
assert.ok(page.includes('showFileAction={!routedTeamCannotResolve && !isQcContext && !isUnassignedWorkbasket && !isTerminalDocketLifecycle(caseInfo?.lifecycle || lifecycleStatus)}'), 'File action should be hidden in routed/QC/unassigned/terminal contexts.');
assert.ok(overview.includes('unassigned in a workbasket'), 'Unassigned WB guidance should be visible.');
assert.ok(overview.includes('QC context active'), 'QC-specific guidance should be visible.');
assert.ok(overview.includes('Record view only; active queue actions are hidden.'), 'Terminal state record-view guidance should be visible outside action panel gating.');
assert.ok(overview.includes('Recent dockets'), 'Overview should render compact recent dockets card.');
assert.ok(overview.includes('View all in History'), 'Overview should include a shortcut to History for full client docket list.');
assert.ok(overview.includes('No description provided for this docket.'), 'Description empty state should be explicit.');
assert.ok(modals.includes("This sends the docket to another team's Workbasket."), 'Route modal copy should be explicit.');
assert.ok(modals.includes('disabled={!routeTeamId || !String(routingNote || \'\').trim() || routeSubmitting}'), 'Route should require target WB + comment.');
assert.ok(attachmentsPanel.includes('No attachments yet.'), 'Attachments empty state should be explicit.');
assert.ok(attachmentsPanel.includes('Loading attachments…'), 'Attachments loading copy should be explicit.');
assert.ok(sidebar.includes('You can continue working this docket while CFS data is missing'), 'Missing CFS state should be non-blocking and helpful.');
assert.ok(access.includes('isTerminalDocketLifecycle'), 'Terminal lifecycle helper should be reusable for action visibility hardening.');
assert.ok(summary.includes('locationBadges'), 'Header should show explicit location/context badges.');
assert.ok(activity.includes('<h2 id="comments-heading">Activity</h2>'), 'Activity tab should remain distinct and available.');
assert.ok(history.includes('<h2>Change History</h2>'), 'History tab should remain distinct and available.');

console.log('caseDetailUiUxHardening.test.mjs passed');
