import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pageSource = fs.readFileSync(path.resolve('ui/src/pages/ComplianceCalendarPage.jsx'), 'utf8');

assert.ok(pageSource.includes('Repeat every'), 'Calendar editor should support repeat frequency settings.');
assert.ok(pageSource.includes('Repeat until'), 'Calendar editor should support repeat end dates.');
assert.ok(pageSource.includes('recurrencePattern'), 'Calendar page should persist recurrence metadata.');
assert.ok(pageSource.includes("...(form.recurrenceUntil ? { untilDate:"), 'Calendar payload should omit repeat-until when no end date is provided.');
assert.ok(pageSource.includes('Optional end date.'), 'Calendar copy should stay focused on simple repeat settings.');
assert.ok(pageSource.includes('Calendar entry added.'), 'Calendar page should confirm a successful create action.');
assert.ok(pageSource.includes('Entry added.'), 'Calendar form should keep a visible local success message after create.');
assert.ok(pageSource.includes('Add a title and date.'), 'Calendar form should show a direct validation message when required fields are missing.');

console.log('calendar recurrence panel contract passed');
