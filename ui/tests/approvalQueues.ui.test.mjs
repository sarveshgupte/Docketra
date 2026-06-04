import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pageSource = fs.readFileSync(path.resolve('ui/src/pages/ComplianceCalendarPage.jsx'), 'utf8');

assert.ok(pageSource.includes('react-big-calendar'), 'Calendar page should use react-big-calendar for the month view.');
assert.ok(pageSource.includes('defaultView="month"'), 'Calendar page should default to the month grid.');
assert.ok(pageSource.includes('views={['), 'Calendar page should restrict the visible calendar views.');
assert.ok(pageSource.includes('onSelectEvent'), 'Calendar page should support event selection for editing.');
assert.ok(pageSource.includes('onSelectSlot'), 'Calendar page should support slot selection for creating entries.');
assert.ok(pageSource.includes('selectable={canEditCalendar}'), 'Calendar page should only enable calendar selection for editors.');

console.log('calendar month-view contract passed');
