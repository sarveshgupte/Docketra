import assert from 'node:assert/strict';
import { formatRelativeDateLabel } from '../src/pages/crm/crmUiUtils.js';

const reference = new Date('2026-04-28T10:30:00.000Z');

assert.equal(formatRelativeDateLabel('', reference), 'Not scheduled');
assert.equal(formatRelativeDateLabel(null, reference), 'Not scheduled');
assert.equal(formatRelativeDateLabel('not-a-date', reference), 'Not scheduled');

assert.equal(formatRelativeDateLabel('2026-04-28T00:15:00.000Z', reference), 'Today');
assert.equal(formatRelativeDateLabel('2026-04-29T08:00:00.000Z', reference), 'Tomorrow');
assert.equal(formatRelativeDateLabel('2026-04-27T23:59:59.000Z', reference), 'Yesterday');
assert.equal(formatRelativeDateLabel('2026-04-24T12:00:00.000Z', reference), '4 days overdue');
assert.equal(formatRelativeDateLabel('2026-05-03T12:00:00.000Z', reference), 'In 5 days');

// Timezone-offset input should still evaluate by local calendar day safely.
assert.equal(formatRelativeDateLabel('2026-04-28T23:30:00-05:00', reference), 'Tomorrow');

console.log('crmRelativeDateLabel.test.mjs passed');
