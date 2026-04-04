const express = require('express');
const mongoose = require('mongoose');
const Task = require('../models/Task');
const { authorizeFirmPermission, requireAdmin } = require('../middleware/permission.middleware');
const { userReadLimiter, userWriteLimiter } = require('../middleware/rateLimiters');
const wrapWriteHandler = require('../middleware/wrapWriteHandler');

const router = express.Router();
const CALENDAR_TAG = 'compliance-calendar';

const getUserId = (req) => req.userId || req.user?._id;

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

    return res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch compliance calendar entries',
      error: error.message,
    });
  }
});

router.post('/', authorizeFirmPermission('TASK_VIEW'), requireAdmin, userWriteLimiter, wrapWriteHandler(async (req, res) => {
  const firmId = req.firmId || req.user?.firmId;
  const userId = getUserId(req);
  const { title, description, dueDate } = req.body || {};

  if (!title || !dueDate) {
    return res.status(400).json({ success: false, message: 'title and dueDate are required' });
  }

  const task = await Task.create({
    firmId,
    title: String(title).trim(),
    description: String(description || '').trim(),
    dueDate: new Date(dueDate),
    status: 'pending',
    priority: 'high',
    tags: [CALENDAR_TAG],
    createdBy: userId,
    updatedBy: userId,
  });

  return res.status(201).json({ success: true, data: task });
}));

router.put('/:id', authorizeFirmPermission('TASK_VIEW'), requireAdmin, userWriteLimiter, wrapWriteHandler(async (req, res) => {
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

  const { title, description, dueDate, status } = req.body || {};
  if (title !== undefined) entry.title = String(title).trim();
  if (description !== undefined) entry.description = String(description).trim();
  if (dueDate !== undefined) entry.dueDate = new Date(dueDate);
  if (status !== undefined) entry.status = status;
  entry.updatedBy = userId;

  await entry.save();
  return res.json({ success: true, data: entry });
}));

router.delete('/:id', authorizeFirmPermission('TASK_VIEW'), requireAdmin, userWriteLimiter, wrapWriteHandler(async (req, res) => {
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
