const toDate = (value, fieldName) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} must be a valid date`);
    error.code = 'DEADLINE_VALIDATION_ERROR';
    throw error;
  }
  return date;
};

const addCalendarDays = (source, days) => {
  const date = new Date(source);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date;
};

function calculateDeadlineFromRule({ rule = {}, createdAt = new Date(), manualDueDate, eventDate, calendarConfig } = {}) {
  const normalizedRule = rule || {};
  const mode = normalizedRule.mode || 'NONE';
  const warnings = [];

  if (mode === 'NONE') return { dueDate: null, source: 'NONE', warnings };

  const createdAtDate = toDate(createdAt, 'createdAt') || new Date();

  if (mode === 'TAT_DAYS') {
    if (!Number.isFinite(normalizedRule.tatDays) || Number(normalizedRule.tatDays) < 0) {
      const error = new Error('tatDays is required and must be >= 0 for TAT_DAYS');
      error.code = 'DEADLINE_VALIDATION_ERROR';
      throw error;
    }
    return {
      dueDate: calculateFallbackDueDateFromDays(createdAtDate, normalizedRule.tatDays, { calendarConfig })
        || addCalendarDays(createdAtDate, normalizedRule.tatDays),
      source: 'TAT_DAYS',
      warnings,
    };
  }

  if (mode === 'FIXED_DAY_NEXT_MONTH') {
    const day = Number(normalizedRule.fixedDayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      const error = new Error('fixedDayOfMonth must be between 1 and 31 for FIXED_DAY_NEXT_MONTH');
      error.code = 'DEADLINE_VALIDATION_ERROR';
      throw error;
    }
    const y = createdAtDate.getUTCFullYear();
    const m = createdAtDate.getUTCMonth();
    const nextMonthStart = new Date(Date.UTC(y, m + 1, 1));
    const lastDay = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
    const clamped = Math.min(day, lastDay);
    if (clamped !== day) warnings.push(`Fixed day ${day} exceeds target month length; clamped to ${clamped}.`);
    return { dueDate: new Date(Date.UTC(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth(), clamped)), source: 'FIXED_DAY_NEXT_MONTH', warnings };
  }

  if (mode === 'MANUAL_DATE_REQUIRED') {
    const manual = toDate(manualDueDate, 'manualDueDate');
    if (!manual) {
      const error = new Error('Due date is required for MANUAL_DATE_REQUIRED');
      error.code = 'DEADLINE_VALIDATION_ERROR';
      throw error;
    }
    return { dueDate: manual, source: 'MANUAL_DATE_REQUIRED', warnings };
  }

  if (mode === 'EVENT_DATE_OFFSET') {
    if (!Number.isFinite(normalizedRule.eventOffsetDays)) {
      const error = new Error('eventOffsetDays is required for EVENT_DATE_OFFSET');
      error.code = 'DEADLINE_VALIDATION_ERROR';
      throw error;
    }
    const baseDate = toDate(eventDate, 'eventDate');
    if (!baseDate) {
      const error = new Error('Event date is required for EVENT_DATE_OFFSET');
      error.code = 'DEADLINE_VALIDATION_ERROR';
      throw error;
    }
    return { dueDate: addCalendarDays(baseDate, normalizedRule.eventOffsetDays), source: 'EVENT_DATE_OFFSET', warnings };
  }

  const error = new Error(`Unsupported deadline mode: ${mode}`);
  error.code = 'DEADLINE_VALIDATION_ERROR';
  throw error;
}

module.exports = { calculateDeadlineFromRule };
const { calculateFallbackDueDateFromDays } = require('../../services/sla.service');
