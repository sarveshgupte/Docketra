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

  // ⚡ Bolt: Optimize firm calendar reminders notification loop
  // 💡 What: Pre-fetch firms and users for valid entries instead of querying Firm and User per entry loop.
  // 🎯 Why: Replaces O(N) database queries with O(1) batched queries, mitigating network latency overhead.
  // 📊 Impact: Substantially reduces DB round-trips from 2N to 2 queries for fetching firms and users.
  const firmIds = [...new Set(entries.map((e) => String(e.firmId)))];
  const firms = await Firm.find({ _id: { $in: firmIds } }).select('_id settings.firm').lean();
  const firmMap = new Map(firms.map((f) => [String(f._id), f]));

  const validEntries = [];
  const validFirmIds = new Set();

  for (const entry of entries) {
    scanned += 1;
    const firm = firmMap.get(String(entry.firmId));
    const firmSettings = normalizeFirmSettings(firm?.settings?.firm || {});
    const leadDays = Number.isFinite(Number(entry.reminderDaysBefore))
      ? Number(entry.reminderDaysBefore)
      : Number(firmSettings.calendarReminderLeadDays || 0);
    const reminderDate = addDays(new Date(entry.dueDate), -leadDays);
    reminderDate.setUTCHours(0, 0, 0, 0);
    if (reminderDate.getTime() === start.getTime()) {
      validEntries.push(entry);
      validFirmIds.add(String(entry.firmId));
    }
  }

  const usersByFirm = new Map();
  if (validFirmIds.size > 0) {
    const users = await User.find({ firmId: { $in: [...validFirmIds] }, status: { $ne: 'deleted' }, isActive: true }).select('firmId xID').lean();
    for (const user of users) {
      const fId = String(user.firmId);
      if (!usersByFirm.has(fId)) usersByFirm.set(fId, []);
      usersByFirm.get(fId).push(user);
    }
  }

  for (const entry of validEntries) {
    const firmUsers = usersByFirm.get(String(entry.firmId)) || [];
    const leadDays = Number.isFinite(Number(entry.reminderDaysBefore))
      ? Number(entry.reminderDaysBefore)
      : Number(normalizeFirmSettings(firmMap.get(String(entry.firmId))?.settings?.firm || {}).calendarReminderLeadDays || 0);
    const dueDateKey = toDueDateKey(entry.dueDate);
    const calendarEntryId = String(entry._id);

    for (const user of firmUsers) {
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
