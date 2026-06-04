const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { applyRouteValidation } = require('../middleware/requestValidation.middleware');
const routeSchemas = require('../schemas/complianceCalendar.routes.schema');
const { authorizeFirmPermission, requireAdmin } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');
const { persistTaskNarrative } = require('../services/task.service');
const taskNarrativeStorage = require('../services/taskNarrativeStorage.service');

const router = applyRouteValidation(express.Router(), routeSchemas);
const CALENDAR_TAG = 'compliance-calendar';

const getUserId = (req) => req.userId || req.user?._id;
const normalizeRecurrencePattern = (value) => {
  if (!value || typeof value !== 'object') return null;
  const frequency = String(value.frequency || 'none').trim().toLowerCase();
  if (!frequency || frequency === 'none') return null;
  const interval = Number.isFinite(Number(value.interval)) ? Number(value.interval) : 1;
  const untilDate = value.untilDate ? new Date(value.untilDate) : null;
  return {
    frequency,
    interval: Math.max(1, interval),
    untilDate: untilDate && !Number.isNaN(untilDate.getTime()) ? untilDate : null,
  };
};

router.get('/', authorizeFirmPermission('TASK_VIEW'), userReadLimiter, async (req, res) => {
  try {
    const firmId = req.firmId || req.user?.firmId;
    const records = await Task.find({
      firmId,
      tags: CALENDAR_TAG,
      isDeleted: { $ne: true },
    })
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(1000)
      .lean();

    const hydratedRecords = await Promise.all(records.map(async (record) => {
      if (record.taskRef?.provider) {
        try {
          const hydrated = await taskNarrativeStorage.readNarrative({ firmId, taskRef: record.taskRef });
          const narrative = hydrated?.narrative || {};
          if (narrative.description) record.description = narrative.description;
        } catch (_err) {
          record.taskWarning = 'task_content_unavailable';
        }
      }
      return record;
    }));

    return res.json({
      success: true,
      data: hydratedRecords,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch compliance calendar entries',
      error: error.message,
    });
  }
});

router.post('/', authorizeFirmPermission('TASK_MANAGE'), requireAdmin, userWriteLimiter, wrapWriteHandler(async (req, res) => {
  const firmId = req.firmId || req.user?.firmId;
  const userId = getUserId(req);
  const {
    title,
    description,
    dueDate,
    clientId,
    clientName,
    categoryId,
    categoryName,
    linkedCaseId,
    calendarEntryType,
    reminderDaysBefore,
    recurrencePattern,
  } = req.body || {};

  if (!title || !dueDate) {
    return res.status(400).json({ success: false, message: 'title and dueDate are required' });
  }

  const task = await Task.create({
    firmId,
    title: String(title).trim(),
    dueDate: new Date(dueDate),
    status: 'pending',
    priority: 'high',
    tags: [CALENDAR_TAG],
    clientId: String(clientId || '').trim() || undefined,
    clientName: String(clientName || '').trim() || undefined,
    categoryId: String(categoryId || '').trim() || undefined,
    categoryName: String(categoryName || '').trim() || undefined,
    linkedCaseId: String(linkedCaseId || '').trim() || undefined,
    calendarEntryType: calendarEntryType || 'important_date',
    reminderDaysBefore: Number.isFinite(Number(reminderDaysBefore)) ? Number(reminderDaysBefore) : undefined,
    recurrencePattern: normalizeRecurrencePattern(recurrencePattern) || undefined,
    createdBy: userId,
    updatedBy: userId,
  });

  if (description) {
    await persistTaskNarrative({ firmId, task, payload: { description }, updatedBy: userId });
    task.description = undefined;
    await task.save();
  }

  return res.status(201).json({ success: true, data: task });
}));

router.put('/:id', authorizeFirmPermission('TASK_MANAGE'), requireAdmin, userWriteLimiter, wrapWriteHandler(async (req, res) => {
  const firmId = req.firmId || req.user?.firmId;
  const userId = getUserId(req);
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid entry id' });
  }

  const entry = await Task.findOne({ _id: id, firmId, tags: CALENDAR_TAG, isDeleted: { $ne: true } });
  if (!entry) {
    return res.status(404).json({ success: false, message: 'Entry not found' });
  }

  const {
    title,
    description,
    dueDate,
    status,
    clientId,
    clientName,
    categoryId,
    categoryName,
    linkedCaseId,
    calendarEntryType,
    reminderDaysBefore,
    recurrencePattern,
  } = req.body || {};
  if (title !== undefined) entry.title = String(title).trim();
  if (dueDate !== undefined) entry.dueDate = new Date(dueDate);
  if (status !== undefined) entry.status = status;
  if (clientId !== undefined) entry.clientId = String(clientId || '').trim() || undefined;
  if (clientName !== undefined) entry.clientName = String(clientName || '').trim() || undefined;
  if (categoryId !== undefined) entry.categoryId = String(categoryId || '').trim() || undefined;
  if (categoryName !== undefined) entry.categoryName = String(categoryName || '').trim() || undefined;
  if (linkedCaseId !== undefined) entry.linkedCaseId = String(linkedCaseId || '').trim() || undefined;
  if (calendarEntryType !== undefined) entry.calendarEntryType = calendarEntryType;
  if (reminderDaysBefore !== undefined) entry.reminderDaysBefore = Number(reminderDaysBefore);
  if (recurrencePattern !== undefined) entry.recurrencePattern = normalizeRecurrencePattern(recurrencePattern);
  entry.updatedBy = userId;

  if (description !== undefined) {
    await persistTaskNarrative({ firmId, task: entry, payload: { description }, updatedBy: userId });
    entry.description = undefined;
  }

  await entry.save();
  return res.json({ success: true, data: entry });
}));

router.delete('/:id', authorizeFirmPermission('TASK_MANAGE'), requireAdmin, userWriteLimiter, wrapWriteHandler(async (req, res) => {
  const firmId = req.firmId || req.user?.firmId;
  const userId = getUserId(req);
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid entry id' });
  }

  const entry = await Task.findOne({ _id: id, firmId, tags: CALENDAR_TAG, isDeleted: { $ne: true } });
  if (!entry) {
    return res.status(404).json({ success: false, message: 'Entry not found' });
  }

  entry.isDeleted = true;
  entry.deletedAt = new Date();
  entry.deletedBy = userId;
  await entry.save();

  return res.json({ success: true, message: 'Entry deleted' });
}));

module.exports = router;
