const { DateTime } = require('luxon');
const CaseStatus = require('../domain/case/caseStatus');
const { normalizeStatus } = require('../domain/case/caseStateMachine');
const TenantSlaConfig = require('../models/TenantSlaConfig.model');

const DEFAULT_SLA_CONFIG = Object.freeze({
  tatDurationMinutes: 8 * 60,
  businessStartTime: '10:00',
  businessEndTime: '18:00',
  workingDays: [1, 2, 3, 4, 5],
  timezone: 'UTC',
});

const MAX_CALENDAR_DAYS_LOOKAHEAD = 370;
const MS_PER_MINUTE = 60 * 1000;

const clampMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
};

const parseTime = (value, fallback) => {
  const safe = typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
  const [hourStr, minuteStr] = safe.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    const [fHour, fMinute] = fallback.split(':').map(Number);
    return { hour: fHour, minute: fMinute };
  }
  return { hour, minute };
};

const normalizeWorkingDays = (days) => {
  if (!Array.isArray(days) || days.length === 0) {
    return DEFAULT_SLA_CONFIG.workingDays;
  }
  const normalized = [...new Set(days.map((day) => Number(day)).filter((day) => day >= 1 && day <= 7))];
  return normalized.length ? normalized : DEFAULT_SLA_CONFIG.workingDays;
};

const normalizeConfig = (config = {}) => {
  const start = parseTime(config.businessStartTime, DEFAULT_SLA_CONFIG.businessStartTime);
  const end = parseTime(config.businessEndTime, DEFAULT_SLA_CONFIG.businessEndTime);
  const safeEnd = (end.hour * 60) + end.minute > (start.hour * 60) + start.minute
    ? end
    : parseTime(DEFAULT_SLA_CONFIG.businessEndTime, DEFAULT_SLA_CONFIG.businessEndTime);
  const timezone = typeof config.timezone === 'string' && DateTime.now().setZone(config.timezone).isValid
    ? config.timezone
    : DEFAULT_SLA_CONFIG.timezone;

  return {
    tatDurationMinutes: clampMinutes(config.tatDurationMinutes || DEFAULT_SLA_CONFIG.tatDurationMinutes),
    businessStartTime: `${String(start.hour).padStart(2, '0')}:${String(start.minute).padStart(2, '0')}`,
    businessEndTime: `${String(safeEnd.hour).padStart(2, '0')}:${String(safeEnd.minute).padStart(2, '0')}`,
    businessStart: start,
    businessEnd: safeEnd,
    workingDays: normalizeWorkingDays(config.workingDays),
    timezone,
  };
};

const atBusinessStart = (dateTime, config) => dateTime
  .set({
    hour: config.businessStart.hour,
    minute: config.businessStart.minute,
    second: 0,
    millisecond: 0,
  });

const atBusinessEnd = (dateTime, config) => dateTime
  .set({
    hour: config.businessEnd.hour,
    minute: config.businessEnd.minute,
    second: 0,
    millisecond: 0,
  });

const moveToNextWorkingDayStart = (dateTime, config) => {
  let next = atBusinessStart(dateTime.plus({ days: 1 }).startOf('day'), config);
  let attempts = 0;
  while (!config.workingDays.includes(next.weekday) && attempts < 14) {
    next = atBusinessStart(next.plus({ days: 1 }).startOf('day'), config);
    attempts += 1;
  }
  return next;
};

const alignToBusinessTime = (jsDate, config) => {
  let current = DateTime.fromJSDate(new Date(jsDate), { zone: config.timezone });
  let attempts = 0;
  while (attempts < MAX_CALENDAR_DAYS_LOOKAHEAD) {
    if (!config.workingDays.includes(current.weekday)) {
      current = moveToNextWorkingDayStart(current, config);
      attempts += 1;
      continue;
    }
    const dayStart = atBusinessStart(current, config);
    const dayEnd = atBusinessEnd(current, config);
    if (current < dayStart) return dayStart;
    if (current >= dayEnd) {
      current = moveToNextWorkingDayStart(current, config);
      attempts += 1;
      continue;
    }
    return current;
  }
  return atBusinessStart(current, config);
};

const calculateDueDate = (startTime, durationMinutes, configInput = DEFAULT_SLA_CONFIG) => {
  const config = normalizeConfig(configInput);
  let remainingMinutes = clampMinutes(durationMinutes);
  let current = alignToBusinessTime(startTime, config);
  if (remainingMinutes === 0) return current.toUTC().toJSDate();

  let safetyCounter = MAX_CALENDAR_DAYS_LOOKAHEAD + Math.ceil(remainingMinutes / Math.max(1, ((config.businessEnd.hour * 60) + config.businessEnd.minute) - ((config.businessStart.hour * 60) + config.businessStart.minute)));
  while (remainingMinutes > 0 && safetyCounter > 0) {
    const dayEnd = atBusinessEnd(current, config);
    const available = Math.max(0, Math.floor(dayEnd.diff(current, 'minutes').minutes));
    if (available === 0) {
      current = moveToNextWorkingDayStart(current, config);
      safetyCounter -= 1;
      continue;
    }
    const consumed = Math.min(remainingMinutes, available);
    current = current.plus({ minutes: consumed });
    remainingMinutes -= consumed;
    if (remainingMinutes > 0) {
      current = moveToNextWorkingDayStart(current, config);
    }
    safetyCounter -= 1;
  }

  return current.toUTC().toJSDate();
};

const computeElapsedMinutes = (startedAt, now = new Date()) => {
  if (!startedAt) return 0;
  const elapsedMs = new Date(now).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / MS_PER_MINUTE);
};

const getEffectiveTatMinutes = (caseDoc, now = new Date()) => {
  const accumulated = clampMinutes(caseDoc?.tatAccumulatedMinutes);
  if (!caseDoc || caseDoc.tatPaused || !caseDoc.tatLastStartedAt) return accumulated;
  return accumulated + computeElapsedMinutes(caseDoc.tatLastStartedAt, now);
};

const isBreached = (caseDoc, now = new Date()) => {
  if (!caseDoc?.slaDueAt) return false;
  const status = normalizeStatus(caseDoc.status);
  if (status === CaseStatus.RESOLVED) return false;
  return new Date(now).getTime() > new Date(caseDoc.slaDueAt).getTime();
};

const findConfig = async (tenantId, caseType) => {
  if (caseType) {
    const override = await TenantSlaConfig.findOne({ firmId: tenantId, caseType }).lean();
    if (override) return override;
  }
  return TenantSlaConfig.findOne({ firmId: tenantId, caseType: null }).lean();
};

const initializeCaseSla = async ({ tenantId, caseType, now = new Date() }) => {
  const dbConfig = tenantId ? await findConfig(tenantId, caseType || null) : null;
  const config = normalizeConfig(dbConfig || DEFAULT_SLA_CONFIG);
  const startedAt = new Date(now);
  const slaDueAt = calculateDueDate(startedAt, config.tatDurationMinutes, config);
  return {
    slaDueAt,
    tatPaused: false,
    tatLastStartedAt: startedAt,
    tatAccumulatedMinutes: 0,
    tatTotalMinutes: 0,
    slaConfigSnapshot: {
      tatDurationMinutes: config.tatDurationMinutes,
      businessStartTime: config.businessStartTime,
      businessEndTime: config.businessEndTime,
      workingDays: [...config.workingDays],
      timezone: config.timezone,
    },
    config,
  };
};

const handleStatusTransition = (caseDoc, newStatus, options = {}) => {
  const now = options.now ? new Date(options.now) : new Date();
  const fromStatus = normalizeStatus(caseDoc?.status);
  const toStatus = normalizeStatus(newStatus);
  const previousTat = clampMinutes(caseDoc?.tatAccumulatedMinutes);

  if (toStatus === CaseStatus.PENDED && !caseDoc?.tatPaused) {
    const elapsed = computeElapsedMinutes(caseDoc.tatLastStartedAt, now);
    const newTat = Math.max(previousTat + elapsed, 0);
    return {
      patch: {
        tatAccumulatedMinutes: newTat,
        tatTotalMinutes: newTat,
        tatPaused: true,
        tatLastStartedAt: null,
      },
      auditEvent: {
        event: 'SLA_PAUSED',
        previousTat,
        newTat,
        timestamp: now,
        userId: options.userId || null,
      },
    };
  }

  if (toStatus === CaseStatus.OPEN) {
    if (!(fromStatus === CaseStatus.PENDED || caseDoc?.tatPaused)) {
      return { patch: {}, auditEvent: null };
    }
    return {
      patch: {
        tatPaused: false,
        tatLastStartedAt: now,
      },
      auditEvent: {
        event: 'SLA_RESUMED',
        previousTat,
        newTat: previousTat,
        timestamp: now,
        userId: options.userId || null,
      },
    };
  }

  if (toStatus === CaseStatus.RESOLVED) {
    const elapsed = caseDoc?.tatPaused ? 0 : computeElapsedMinutes(caseDoc?.tatLastStartedAt, now);
    const newTat = Math.max(previousTat + elapsed, 0);
    return {
      patch: {
        tatAccumulatedMinutes: newTat,
        tatTotalMinutes: newTat,
        tatPaused: true,
        tatLastStartedAt: null,
      },
      auditEvent: {
        event: 'SLA_FINALIZED',
        previousTat,
        newTat,
        timestamp: now,
        userId: options.userId || null,
      },
    };
  }

  return { patch: {}, auditEvent: null };
};

module.exports = {
  DEFAULT_SLA_CONFIG,
  calculateDueDate,
  getEffectiveTatMinutes,
  isBreached,
  initializeCaseSla,
  handleStatusTransition,
  normalizeConfig,
};
