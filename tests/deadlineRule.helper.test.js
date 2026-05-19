const assert = require('assert');
const { calculateDeadlineFromRule } = require('../src/domain/deadlines/calculateDeadlineFromRule');

const createdAt = new Date('2026-01-31T00:00:00Z');
assert.strictEqual(calculateDeadlineFromRule({ rule: { mode: 'NONE' }, createdAt }).dueDate, null);
assert.strictEqual(calculateDeadlineFromRule({ rule: { mode: 'TAT_DAYS', tatDays: 3 }, createdAt }).dueDate.toISOString(), '2026-02-03T00:00:00.000Z');
const fixed = calculateDeadlineFromRule({ rule: { mode: 'FIXED_DAY_NEXT_MONTH', fixedDayOfMonth: 31 }, createdAt });
assert.strictEqual(fixed.dueDate.toISOString(), '2026-02-28T00:00:00.000Z');
assert.ok(fixed.warnings.length > 0);
assert.strictEqual(calculateDeadlineFromRule({ rule: { mode: 'MANUAL_DATE_REQUIRED' }, manualDueDate: '2026-02-11T00:00:00Z' }).dueDate.toISOString(), '2026-02-11T00:00:00.000Z');
assert.strictEqual(calculateDeadlineFromRule({ rule: { mode: 'EVENT_DATE_OFFSET', eventOffsetDays: 30 }, eventDate: '2026-01-01T00:00:00Z' }).dueDate.toISOString(), '2026-01-31T00:00:00.000Z');
console.log('deadline rule helper tests passed');
