const Case = require('../models/Case.model');
const SlaRule = require('../models/SlaRule.model');
const { DEFAULT_SLA_CONFIG, calculateDueDate } = require('./caseSla.service');
const { createNotification, NotificationTypes } = require('./notification.service');
const { enqueueSlaBreachCheckJob } = require('../queues/sla.queue');
const log = require('../utils/log');

const MS_PER_HOUR = 60 * 60 * 1000;
const DEFAULT_WORKDAY_HOURS = 8;
const TERMINAL_STATUSES = new Set(['RESOLVED', 'FILED', 'CLOSED']);
const ACTIVE_STATUS_EXCLUSIONS = Array.from(TERMINAL_STATUSES);

const normalizeString = (value) => {
  const normalized = String(value || '').trim();
  return normalized ? normalized.toLowerCase() : null;
};

const normalizeIdentifier = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const getWorkbasketId = (docket = {}) => (
  normalizeIdentifier(docket.workbasketId)
  || normalizeIdentifier(docket.ownerTeamId)
  || normalizeIdentifier(docket.routedToTeamId)
  || null
);

const getRuleSelectorCount = (rule = {}) => ([
  normalizeString(rule.subcategory),
  normalizeString(rule.category),
  normalizeIdentifier(rule.workbasketId),
].filter(Boolean).length);

const getRulePriority = (rule = {}) => {
  if (normalizeString(rule.subcategory)) return 4;
  if (normalizeString(rule.category)) return 3;
  if (normalizeIdentifier(rule.workbasketId)) return 2;
  return 1;
};

const isRuleEligible = (rule = {}, docket = {}) => {
  const docketCategory = normalizeString(docket.category);
  const docketSubcategory = normalizeString(docket.subcategory);
  const docketWorkbasketId = getWorkbasketId(docket);

  if (normalizeString(rule.category) && normalizeString(rule.category) !== docketCategory) return false;
  if (normalizeString(rule.subcategory) && normalizeString(rule.subcategory) !== docketSubcategory) return false;
  if (normalizeIdentifier(rule.workbasketId) && normalizeIdentifier(rule.workbasketId) !== docketWorkbasketId) return false;
  return true;
};

const compareRules = (left = {}, right = {}) => {
  const priorityDiff = getRulePriority(right) - getRulePriority(left);
  if (priorityDiff !== 0) return priorityDiff;

  // Break priority ties by preferring rules that also scope additional matching selectors.
  const selectorDiff = getRuleSelectorCount(right) - getRuleSelectorCount(left);
  if (selectorDiff !== 0) return selectorDiff;

  const updatedAtDiff = new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
  if (updatedAtDiff !== 0) return updatedAtDiff;

  return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
};

const normalizeSlaHours = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

async function resolveSlaRule(docket = {}, options = {}) {
  const firmId = normalizeIdentifier(docket.firmId || options.firmId);
  if (!firmId) return null;

  const rules = Array.isArray(options.rules)
    ? options.rules
    : await SlaRule.find({ firmId, isActive: true }).lean();

  const eligibleRules = rules.filter((rule) => isRuleEligible(rule, docket));
  if (!eligibleRules.length) return null;

  return [...eligibleRules].sort(compareRules)[0] || null;
}

async function calculateSlaDueDate(docket = {}, options = {}) {
  const startAt = docket.createdAt || docket.updatedAt || options.now || new Date();
  const rule = options.rule || await resolveSlaRule(docket, options);
  const slaHours = normalizeSlaHours(rule?.slaHours);
  if (!slaHours) return null;

  return calculateDueDate(startAt, Math.round(slaHours * 60), options.calendarConfig || DEFAULT_SLA_CONFIG);
}

function calculateFallbackDueDateFromDays(startAt, days, options = {}) {
  const normalizedDays = Number(days);
  if (!Number.isFinite(normalizedDays) || normalizedDays <= 0) return null;
  return calculateDueDate(
    startAt,
    Math.round(normalizedDays * DEFAULT_WORKDAY_HOURS * 60),
    options.calendarConfig || DEFAULT_SLA_CONFIG,
  );
}

function getSlaStatus(docket = {}, options = {}) {
  const dueAt = docket.slaDueAt || docket.slaDueDate;
  const dueTs = new Date(dueAt || '').getTime();
  const nowTs = new Date(options.now || new Date()).getTime();
  const status = String(docket.status || '').trim().toUpperCase();

  if (!Number.isFinite(dueTs) || TERMINAL_STATUSES.has(status)) {
    return 'GREEN';
  }
  if (dueTs < nowTs) {
    return 'RED';
  }
  if ((dueTs - nowTs) < (24 * MS_PER_HOUR)) {
    return 'YELLOW';
  }
  return 'GREEN';
}

async function syncSlaBreachNotifications(dockets = [], options = {}) {
  const firmId = normalizeIdentifier(options.firmId);
  if (!firmId || !Array.isArray(dockets) || dockets.length === 0) return;

  const notifications = [];
  for (const docket of dockets) {
    if (getSlaStatus(docket, options) !== 'RED') continue;
    const recipientIds = [...new Set([
      normalizeIdentifier(docket.assignedToXID),
      normalizeIdentifier(docket.createdByXID),
    ].filter(Boolean))];

    for (const userId of recipientIds) {
      notifications.push(createNotification({
        firmId,
        userId,
        type: NotificationTypes.SLA_BREACHED,
        docketId: docket.caseId || docket.caseNumber || docket.docketId || docket._id,
        title: 'SLA breached',
        message: `${docket.caseNumber || docket.caseId || docket.title || 'A docket'} is overdue.`,
      }));
    }
  }

  if (notifications.length > 0) {
    await Promise.allSettled(notifications);
  }
}

function dispatchSlaBreachNotifications(dockets = [], options = {}) {
  const payload = {
    dockets: Array.isArray(dockets) ? dockets : [],
    firmId: normalizeIdentifier(options.firmId),
    now: options.now || new Date(),
  };

  Promise.resolve(enqueueSlaBreachCheckJob(payload))
    .then((result) => {
      if (result?.queued) {
        return result;
      }

      return syncSlaBreachNotifications(payload.dockets, {
        firmId: payload.firmId,
        now: payload.now,
      });
    })
    .catch((error) => {
      log.warn('SLA_BREACH_JOB_DISPATCH_FAILED', {
        error: error.message,
        firmId: payload.firmId,
        docketCount: payload.dockets.length,
      });
      return syncSlaBreachNotifications(payload.dockets, {
        firmId: payload.firmId,
        now: payload.now,
      });
    })
    .catch((error) => {
      log.error('SLA_BREACH_JOB_FAILED', {
        error: error.message,
        firmId: payload.firmId,
        docketCount: payload.dockets.length,
      });
    });
}

function getWeekWindow(now = new Date()) {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  start.setUTCHours(0, 0, 0, 0);

  return { start, end };
}

async function getWeeklySlaSummary(firmId, options = {}) {
  const normalizedFirmId = normalizeIdentifier(firmId);
  if (!normalizedFirmId) {
    return {
      period: getWeekWindow(options.now),
      createdThisWeek: 0,
      currentlyOverdue: 0,
      dueSoon: 0,
      onTrack: 0,
      resolvedWithinSla: 0,
      resolvedAfterBreach: 0,
    };
  }

  const now = new Date(options.now || new Date());
  const { start, end } = getWeekWindow(now);
  const activeQuery = { firmId: normalizedFirmId, status: { $nin: ACTIVE_STATUS_EXCLUSIONS } };

  const [createdThisWeek, currentlyOverdue, dueSoon, onTrack, resolvedWithinSla, resolvedAfterBreach] = await Promise.all([
    Case.countDocuments({ firmId: normalizedFirmId, createdAt: { $gte: start, $lte: end } }),
    Case.countDocuments({ ...activeQuery, slaDueAt: { $lt: now } }),
    Case.countDocuments({ ...activeQuery, slaDueAt: { $gte: now, $lt: new Date(now.getTime() + (24 * MS_PER_HOUR)) } }),
    Case.countDocuments({ ...activeQuery, slaDueAt: { $gte: new Date(now.getTime() + (24 * MS_PER_HOUR)) } }),
    Case.countDocuments({
      firmId: normalizedFirmId,
      status: 'RESOLVED',
      resolvedAt: { $gte: start, $lte: end },
      $expr: { $lte: ['$resolvedAt', '$slaDueAt'] },
    }),
    Case.countDocuments({
      firmId: normalizedFirmId,
      status: 'RESOLVED',
      resolvedAt: { $gte: start, $lte: end },
      $expr: { $gt: ['$resolvedAt', '$slaDueAt'] },
    }),
  ]);

  return {
    period: { start, end },
    createdThisWeek,
    currentlyOverdue,
    dueSoon,
    onTrack,
    resolvedWithinSla,
    resolvedAfterBreach,
  };
}

module.exports = {
  calculateFallbackDueDateFromDays,
  calculateSlaDueDate,
  dispatchSlaBreachNotifications,
  getSlaStatus,
  getWeeklySlaSummary,
  resolveSlaRule,
  syncSlaBreachNotifications,
};
