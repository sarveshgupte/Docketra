const Case = require('../models/Case.model');
const Task = require('../models/Task');
const Team = require('../models/Team.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const Firm = require('../models/Firm.model');
const { createNotification, NotificationTypes } = require('./notification.service');
const { normalizeFirmSettings } = require('./adminController.service');
const log = require('../utils/log');

const DUE_SOON_WINDOW_HOURS = Number(process.env.DUE_SOON_WINDOW_HOURS || 24);
const TERMINAL_STATUSES = new Set(['RESOLVED', 'FILED', 'CANCELLED', 'TERMINATED', 'CLOSED', 'ARCHIVED']);
const CALENDAR_TAG = 'compliance-calendar';

function toDueDateKey(dueDate) {
  if (!dueDate) return '';
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

function isDueSoon(dueDate, now) {
  const dueMs = new Date(dueDate).getTime();
  const nowMs = now.getTime();
  return dueMs > nowMs && dueMs <= (nowMs + (DUE_SOON_WINDOW_HOURS * 60 * 60 * 1000));
}

function isOverdue(dueDate, now) {
  return new Date(dueDate).getTime() <= now.getTime();
}

async function hasExistingDueNotification({ firmId, userId, docketId, type, dueDateKey }) {
  const existing = await Notification.findOne({
    firmId,
    userId,
    docketId,
    type,
    'metadata.dueDateKey': dueDateKey,
  }).select('_id').lean();
  return Boolean(existing);
}

async function resolveRecipientsForDocket(docket) {
  if (docket.assignedToXID) {
    return [String(docket.assignedToXID).toUpperCase().trim()];
  }

  if (!docket.workbasketId) return [];

  const workbasket = await Team.findOne({ _id: docket.workbasketId, firmId: docket.firmId, isActive: true })
    .select('_id')
    .lean();
  if (!workbasket) return [];

  const workbasketId = String(docket.workbasketId);
  const users = await User.find({
    firmId: docket.firmId,
    status: { $ne: 'deleted' },
    isActive: true,
    $or: [
      { teamIds: workbasketId },
      { teamId: workbasketId },
    ],
  }).select('xID').lean();

  return users.map((u) => String(u.xID || '').toUpperCase().trim()).filter(Boolean);
}

async function processDocketDueNotifications({ now = new Date() } = {}) {
  const docketQuery = Case.find({
    dueDate: { $exists: true, $ne: null },
    isDeleted: { $ne: true },
    isArchived: { $ne: true },
  });
  const dockets = typeof docketQuery.select === 'function'
    ? await docketQuery.select('caseId firmId dueDate status assignedToXID workbasketId').lean()
    : await docketQuery;

  let created = 0;
  let scanned = 0;

  for (const docket of dockets) {
    scanned += 1;
    const status = String(docket.status || '').toUpperCase();
    if (TERMINAL_STATUSES.has(status)) continue;

    const dueDateKey = toDueDateKey(docket.dueDate);
    if (!dueDateKey) continue;

    const recipients = await resolveRecipientsForDocket(docket);
    if (!recipients.length) continue;

    const type = isOverdue(docket.dueDate, now)
      ? NotificationTypes.DOCKET_OVERDUE
      : (isDueSoon(docket.dueDate, now) ? NotificationTypes.DOCKET_DUE_SOON : null);
    if (!type) continue;

    for (const userId of recipients) {
      try {
        const exists = await hasExistingDueNotification({
          firmId: docket.firmId,
          userId,
          docketId: docket.caseId,
          type,
          dueDateKey,
        });
        if (exists) continue;

        const createdNotification = await createNotification({
          firmId: docket.firmId,
          recipientXID: userId,
          type,
          docketId: docket.caseId,
          metadata: { dueDate: docket.dueDate, dueDateKey },
          title: type === NotificationTypes.DOCKET_DUE_SOON ? 'Docket due soon' : 'Docket overdue',
          message: type === NotificationTypes.DOCKET_DUE_SOON
            ? `Docket ${docket.caseId} is due soon.`
            : `Docket ${docket.caseId} is overdue.`,
          group: false,
        });
        if (createdNotification) created += 1;
      } catch (error) {
        log.warn('DOCKET_DUE_NOTIFICATION_CREATE_FAILED', { docketId: docket.caseId, userId, error: error?.message });
      }
    }
  }

  return { scanned, created };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + Number(days || 0));
  return next;
}

async function processFirmCalendarReminders({ now = new Date() } = {}) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const maxEnd = addDays(start, 30);
  maxEnd.setUTCHours(23, 59, 59, 999);

  const entries = await Task.find({
    tags: CALENDAR_TAG,
    dueDate: { $gte: start, $lte: maxEnd },
    isDeleted: { $ne: true },
    status: { $ne: 'cancelled' },
  }).select('_id firmId title description dueDate calendarEntryType reminderDaysBefore').lean();

  let scanned = 0;
  let created = 0;

  // ⚡ Bolt: Prevent N+1 Query on Firm lookup
  // 💡 What: Pre-fetch firm settings for all calendar entries outside of the loop.
  // 🎯 Why: Replaced iterative O(N) `Firm.findById` queries inside the loop with a single O(1) query using `$in` to drastically improve performance and reduce DB roundtrips.
  const uniqueFirmIds = [...new Set(entries.map((entry) => String(entry.firmId)))];
  const firms = await Firm.find({ _id: { $in: uniqueFirmIds } }).select('_id settings.firm').lean();
  const firmMap = new Map(firms.map((f) => [String(f._id), f]));

  for (const entry of entries) {
    scanned += 1;
    const firm = firmMap.get(String(entry.firmId));
    const firmSettings = normalizeFirmSettings(firm?.settings?.firm || {});
    const leadDays = Number.isFinite(Number(entry.reminderDaysBefore))
      ? Number(entry.reminderDaysBefore)
      : Number(firmSettings.calendarReminderLeadDays || 0);
    const reminderDate = addDays(new Date(entry.dueDate), -leadDays);
    reminderDate.setUTCHours(0, 0, 0, 0);
    if (reminderDate.getTime() !== start.getTime()) continue;

    const users = await User.find({
      firmId: entry.firmId,
      status: { $ne: 'deleted' },
      isActive: true,
    }).select('xID').lean();
    const dueDateKey = toDueDateKey(entry.dueDate);
    const calendarEntryId = String(entry._id);

    for (const user of users) {
      const recipientXID = String(user.xID || '').toUpperCase().trim();
      if (!recipientXID) continue;
      const existing = await Notification.findOne({
        firmId: entry.firmId,
        userId: recipientXID,
        type: NotificationTypes.FIRM_CALENDAR_REMINDER,
        'metadata.calendarEntryId': calendarEntryId,
        'metadata.dueDateKey': dueDateKey,
      }).select('_id').lean();
      if (existing) continue;

      const notification = await createNotification({
        firmId: entry.firmId,
        recipientXID,
        type: NotificationTypes.FIRM_CALENDAR_REMINDER,
        title: entry.calendarEntryType === 'birthday' ? 'Birthday reminder' : 'Important date reminder',
        message: `${entry.title} is on ${dueDateKey.slice(0, 10)}.`,
        metadata: {
          calendarEntryId,
          calendarEntryType: entry.calendarEntryType || 'important_date',
          dueDate: entry.dueDate,
          dueDateKey,
          reminderDaysBefore: leadDays,
        },
        group: false,
      });
      if (notification) created += 1;
    }
  }

  return { scanned, created };
}

module.exports = { processDocketDueNotifications, processFirmCalendarReminders, DUE_SOON_WINDOW_HOURS };
