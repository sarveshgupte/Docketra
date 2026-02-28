const CaseStatus = require('../domain/case/caseStatus');
const { normalizeStatus } = require('../domain/case/caseStateMachine');
const TenantSlaConfig = require('../models/TenantSlaConfig.model');

const DEFAULT_SLA_CONFIG = Object.freeze({
  tatDurationMinutes: 8 * 60,
  businessStartTime: '10:00',
  businessEndTime: '18:00',
  workingDays: [1, 2, 3, 4, 5],
});

const MINUTES_IN_DAY = 24 * 60;
const MS_PER_MINUTE = 60 * 1000;

const parseTimeToMinutes = (value, fallback) => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return fallback;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return fallback;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return (hours * 60) + minutes;
};

const clampMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
};

const toIsoDay = (date) => {
  const utcDay = date.getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
};

const startOfUtcDay = (date) => new Date(Date.UTC(
  date.getUTCFullYear(),
  date.getUTCMonth(),
  date.getUTCDate(),
  0,
  0,
  0,
  0
));

const addUtcDays = (date, days) => {
  const base = startOfUtcDay(date);
  base.setUTCDate(base.getUTCDate() + days);
  return base;
};

const setUtcMinutesInDay = (date, minuteOfDay) => {
  const minutes = Math.min(Math.max(minuteOfDay, 0), MINUTES_IN_DAY - 1);
  const next = startOfUtcDay(date);
  next.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next;
};

const normalizeWorkingDays = (days) => {
  if (!Array.isArray(days) || days.length === 0) {
    return DEFAULT_SLA_CONFIG.workingDays;
  }
  const normalized = [...new Set(days.map((day) => Number(day)).filter((day) => day >= 1 && day <= 7))];
  return normalized.length ? normalized : DEFAULT_SLA_CONFIG.workingDays;
};

const normalizeConfig = (config = {}) => {
  const businessStartMinute = parseTimeToMinutes(config.businessStartTime, parseTimeToMinutes(DEFAULT_SLA_CONFIG.businessStartTime, 600));
  const businessEndMinute = parseTimeToMinutes(config.businessEndTime, parseTimeToMinutes(DEFAULT_SLA_CONFIG.businessEndTime, 1080));
  const safeEndMinute = businessEndMinute > businessStartMinute
    ? businessEndMinute
    : parseTimeToMinutes(DEFAULT_SLA_CONFIG.businessEndTime, 1080);

  return {
    tatDurationMinutes: clampMinutes(config.tatDurationMinutes || DEFAULT_SLA_CONFIG.tatDurationMinutes),
    businessStartMinute,
    businessEndMinute: safeEndMinute,
    workingDays: normalizeWorkingDays(config.workingDays),
  };
};

const moveToNextWorkingDayStart = (date, config) => {
  let nextDay = addUtcDays(date, 1);
  let attempts = 0;
  while (!config.workingDays.includes(toIsoDay(nextDay)) && attempts < 14) {
    nextDay = addUtcDays(nextDay, 1);
    attempts += 1;
  }
  return setUtcMinutesInDay(nextDay, config.businessStartMinute);
};

const alignToBusinessTime = (inputDate, config) => {
  let current = new Date(inputDate);
  let attempts = 0;
  while (attempts < 370) {
    const day = toIsoDay(current);
    if (!config.workingDays.includes(day)) {
      current = moveToNextWorkingDayStart(current, config);
      attempts += 1;
      continue;
    }

    const currentMinute = (current.getUTCHours() * 60) + current.getUTCMinutes();
    if (currentMinute < config.businessStartMinute) {
      return setUtcMinutesInDay(current, config.businessStartMinute);
    }
    if (currentMinute >= config.businessEndMinute) {
      current = moveToNextWorkingDayStart(current, config);
      attempts += 1;
      continue;
    }
    return current;
  }
  return setUtcMinutesInDay(current, config.businessStartMinute);
};

const calculateDueDate = (startTime, durationMinutes, configInput = DEFAULT_SLA_CONFIG) => {
  const config = normalizeConfig(configInput);
  let remainingMinutes = clampMinutes(durationMinutes);
  let current = alignToBusinessTime(startTime, config);

  if (remainingMinutes === 0) return current;

  const minutesPerBusinessDay = Math.max(1, config.businessEndMinute - config.businessStartMinute);
  let safetyCounter = Math.ceil(remainingMinutes / minutesPerBusinessDay) + 370;

  while (remainingMinutes > 0 && safetyCounter > 0) {
    const currentMinute = (current.getUTCHours() * 60) + current.getUTCMinutes();
    const availableToday = Math.max(0, config.businessEndMinute - currentMinute);
    if (availableToday === 0) {
      current = moveToNextWorkingDayStart(current, config);
      safetyCounter -= 1;
      continue;
    }

    const consumed = Math.min(remainingMinutes, availableToday);
    current = new Date(current.getTime() + (consumed * MS_PER_MINUTE));
    remainingMinutes -= consumed;

    if (remainingMinutes > 0) {
      current = moveToNextWorkingDayStart(current, config);
    }
    safetyCounter -= 1;
  }

  return current;
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
    const newTat = previousTat + elapsed;
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

  if (toStatus === CaseStatus.OPEN && (fromStatus === CaseStatus.PENDED || caseDoc?.tatPaused)) {
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
    const newTat = previousTat + elapsed;
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
