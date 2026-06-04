import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pageSource = fs.readFileSync(path.resolve('ui/src/pages/ComplianceCalendarPage.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.resolve('ui/src/api/dashboard.api.js'), 'utf8');
const protectedRoutesSource = fs.readFileSync(path.resolve('ui/src/routes/ProtectedRoutes.jsx'), 'utf8');

assert.ok(pageSource.includes('title="Calendar"'), 'Compliance page should use the shared Calendar label.');
assert.ok(pageSource.includes('Shared firm events and reminders.'), 'Calendar page should describe the shared workspace view.');
assert.ok(pageSource.includes('react-big-calendar'), 'Calendar page should render a real month-view calendar.');
assert.ok(pageSource.includes('defaultView="month"'), 'Calendar page should default to month view.');
assert.ok(pageSource.includes('Add entry'), 'Calendar page should expose the admin create form.');
assert.ok(pageSource.includes('Edit'), 'Calendar page should expose row edit controls for admins.');
assert.ok(pageSource.includes('Delete'), 'Calendar page should expose row delete controls for admins.');
assert.ok(pageSource.includes('calendarApi.listEntries'), 'Calendar page should load shared calendar entries from the calendar API.');
assert.ok(pageSource.includes('canEditCalendar'), 'Calendar page should keep edit permissions separate from view access.');
assert.ok(pageSource.includes('Repeat every'), 'Calendar page should expose repeat frequency controls.');
assert.ok(pageSource.includes('Repetition ends'), 'Calendar page should expose repeat end controls.');
assert.ok(!pageSource.includes('Operations Command Dashboard'), 'Calendar page should not expose the old control-room dashboard copy.');
assert.ok(!pageSource.includes('Partner Morning Dashboard'), 'Calendar page should not use partner role language.');

assert.ok(apiSource.includes('/dashboard/partner-morning'), 'Dashboard API should still keep partner morning endpoint for other surfaces.');
assert.ok(apiSource.includes('compactParams'), 'Dashboard API should still strip empty filter params before strict validation.');
const calendarRouteStart = protectedRoutesSource.indexOf('path="compliance-calendar"');
const calendarRouteEnd = protectedRoutesSource.indexOf('path="clients"', calendarRouteStart);
const calendarRouteSource = calendarRouteStart >= 0
  ? protectedRoutesSource.slice(calendarRouteStart, calendarRouteEnd >= 0 ? calendarRouteEnd : undefined)
  : '';
assert.ok(calendarRouteSource.includes('<ProtectedRoute>'), 'Calendar route should be open to all authenticated firm roles.');
assert.ok(calendarRouteSource.includes('<ComplianceCalendarPage />'), 'Calendar route should render the shared calendar page.');
assert.ok(!calendarRouteSource.includes('requireManagerOrAbove'), 'Calendar route should not require manager access.');
assert.ok(protectedRoutesSource.includes('path="compliance-control"'), 'Legacy calendar URL should still redirect to the renamed route.');
assert.ok(protectedRoutesSource.includes('Navigate to="../compliance-calendar" replace'), 'Legacy calendar URL should redirect to the renamed route.');

console.log('shared calendar UI contract passed');
