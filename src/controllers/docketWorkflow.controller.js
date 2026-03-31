const Case = require('../models/Case.model');
const User = require('../models/User.model');
const Comment = require('../models/Comment.model');
const DocketAuditLog = require('../models/DocketAuditLog.model');

const TERMINAL_STATES = new Set(['RESOLVED', 'FILED']);
const FILED_REASONS = new Set(['duplicate', 'invalid', 'not_required', 'other']);
const PENDING_REASONS = new Set(['waiting_client', 'waiting_internal', 'blocked', 'other']);

function isValidTransition(from, to, isAssigned) {
  if (from === 'OPEN' && !isAssigned) {
    return to === 'FILED';
  }

  const allowed = {
    OPEN: ['PENDING', 'RESOLVED', 'FILED'],
    PENDING: ['OPEN', 'FILED'],
    RESOLVED: [],
    FILED: [],
  };

  return allowed[from]?.includes(to);
}

function isAdminUser(req) {
  const role = String(req.user?.role || '').toLowerCase();
  return role === 'admin';
}

function assertDocketPermission(req, docket, message = 'Not authorized to update this docket') {
  const isAdmin = isAdminUser(req);
  if (!isAdmin && String(docket.assignedToXID || '').toUpperCase() !== String(req.user?.xID || '').toUpperCase()) {
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
  }
}

function safeMessage(error, fallback = 'Unable to process docket action') {
  const msg = String(error?.message || '').trim();
  if (!msg) return fallback;
  if (msg.includes('Assign docket before starting work')) return 'Assign docket before starting work';
  if (msg.includes('Reason required')) return 'Reason required';
  if (msg.includes('Invalid transition')) return 'Invalid transition';
  if (msg.includes('Not authorized to update this docket')) return 'Not authorized to update this docket';
  if (msg.includes('PENDING requires assignment')) return 'Assign docket before starting work';
  if (msg.includes('FILED requires reason')) return 'Reason required';
  return fallback;
}

async function writeAudit({ docketId, userId, action, metadata = {}, firmId }) {
  await DocketAuditLog.create({
    docketId,
    performedBy: userId,
    action,
    metadata,
    timestamp: new Date(),
    firmId,
  });
}

async function assignDocket(req, res) {
  try {
    const { caseId } = req.params;
    const assigneeXID = (req.body?.assigneeXID || req.user?.xID || '').toUpperCase();
    const actorXID = String(req.user?.xID || '').toUpperCase();

    if (!assigneeXID) {
      return res.status(400).json({ success: false, message: 'Assignee is required' });
    }

    const docket = await Case.findOne({ caseId, firmId: req.user.firmId });
    if (!docket) return res.status(404).json({ success: false, message: 'Docket not found' });

    assertDocketPermission(req, docket);

    if (TERMINAL_STATES.has(docket.status)) {
      return res.status(400).json({ success: false, message: 'Docket is terminal and cannot be assigned' });
    }

    const assignee = await User.findOne({ xID: assigneeXID, firmId: req.user.firmId }).select('_id xID');
    if (!assignee) return res.status(404).json({ success: false, message: 'Assignee not found' });

    docket.assignedToXID = assigneeXID;
    docket.assignedTo = assignee._id;
    docket.assignedBy = req.user?._id || null;
    docket.assignedAt = new Date();
    docket.lastActionByXID = actorXID;
    docket.lastActionAt = new Date();
    await docket.save();

    await writeAudit({
      docketId: docket.caseId,
      userId: actorXID,
      action: 'assigned',
      metadata: { assigneeXID },
      firmId: req.user.firmId,
    });

    return res.json({ success: true, data: docket, message: 'Docket assigned' });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    return res.status(statusCode).json({ success: false, message: safeMessage(error) });
  }
}

async function unassignDocket(req, res) {
  try {
    const { caseId } = req.params;
    const docket = await Case.findOne({ caseId, firmId: req.user.firmId });
    if (!docket) return res.status(404).json({ success: false, message: 'Docket not found' });

    assertDocketPermission(req, docket);

    if (docket.status !== 'OPEN') {
      return res.status(400).json({ success: false, message: 'Only OPEN dockets can be unassigned' });
    }

    docket.assignedToXID = null;
    docket.assignedTo = null;
    docket.assignedBy = null;
    docket.assignedAt = null;
    docket.lastActionByXID = req.user.xID;
    docket.lastActionAt = new Date();
    await docket.save();

    await writeAudit({
      docketId: docket.caseId,
      userId: req.user.xID,
      action: 'unassigned',
      metadata: {},
      firmId: req.user.firmId,
    });

    return res.json({ success: true, data: docket, message: 'Docket moved to backlog' });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    return res.status(statusCode).json({ success: false, message: safeMessage(error) });
  }
}

async function transitionDocket(req, res) {
  try {
    const { caseId } = req.params;
    const { toState, filedReason, filedNote, pendingReason, priority, dueDate } = req.body || {};
    const docket = await Case.findOne({ caseId, firmId: req.user.firmId });

    if (!docket) return res.status(404).json({ success: false, message: 'Docket not found' });

    assertDocketPermission(req, docket);

    const from = docket.status;
    const isAssigned = Boolean(docket.assignedToXID);

    if (!isValidTransition(from, toState, isAssigned)) {
      throw new Error('Invalid transition');
    }

    if (from === 'OPEN' && !isAssigned && toState !== 'FILED') {
      throw new Error('Assign docket before starting work');
    }

    if (toState === 'PENDING') {
      if (!docket.assignedToXID) throw new Error('PENDING requires assignment');
      if (!pendingReason || !PENDING_REASONS.has(pendingReason)) throw new Error('Reason required');
      docket.pendingReason = pendingReason;
    }

    if (toState === 'FILED') {
      if (!filedReason || !FILED_REASONS.has(filedReason)) throw new Error('FILED requires reason');
      docket.filedReason = filedReason;
      docket.filedNote = filedNote || null;
      docket.completionType = 'filed';
      docket.filedAt = new Date();
    }

    if (toState === 'RESOLVED') {
      docket.completionType = 'resolved';
      docket.resolvedAt = new Date();
    }

    if (from === 'PENDING' && toState === 'OPEN') {
      docket.assignedToXID = req.user.xID;
      docket.assignedTo = req.user?._id || docket.assignedTo;
      docket.assignedAt = new Date();
    }

    if (priority) docket.priority = String(priority).toLowerCase();
    if (dueDate !== undefined) docket.dueDate = dueDate || null;

    docket.status = toState;
    docket.lastActionByXID = req.user.xID;
    docket.lastActionAt = new Date();
    await docket.save();

    const action = toState === 'FILED' ? 'filed' : toState === 'RESOLVED' ? 'resolved' : toState === 'PENDING' ? 'pending' : 'status_changed';
    await writeAudit({
      docketId: docket.caseId,
      userId: req.user.xID,
      action,
      metadata: { from, to: toState, filedReason: filedReason || null, pendingReason: pendingReason || null },
      firmId: req.user.firmId,
    });

    return res.json({ success: true, data: docket, message: 'Docket updated successfully' });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    return res.status(statusCode).json({ success: false, message: safeMessage(error) });
  }
}

async function addDocketComment(req, res) {
  try {
    const { caseId } = req.params;
    const text = String(req.body?.text || req.body?.comment || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Comment is required' });

    const docket = await Case.findOne({ caseId, firmId: req.user.firmId }).select('caseId assignedToXID');
    if (!docket) return res.status(404).json({ success: false, message: 'Docket not found' });

    assertDocketPermission(req, docket, 'Not authorized to update this docket');

    const comment = await Comment.create({
      caseId,
      firmId: req.user.firmId,
      text,
      createdBy: req.user.email || `${req.user.xID.toLowerCase()}@local`,
      createdByXID: req.user.xID,
      createdByName: req.user.name,
    });

    await writeAudit({
      docketId: caseId,
      userId: req.user.xID,
      action: 'commented',
      metadata: { commentId: comment._id },
      firmId: req.user.firmId,
    });

    return res.status(201).json({ success: true, data: comment });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    return res.status(statusCode).json({ success: false, message: safeMessage(error) });
  }
}

async function listDocketComments(req, res) {
  try {
    const { caseId } = req.params;
    const docket = await Case.findOne({ caseId, firmId: req.user.firmId }).select('caseId assignedToXID');
    if (!docket) return res.status(404).json({ success: false, message: 'Docket not found' });

    assertDocketPermission(req, docket, 'Not authorized to update this docket');

    const comments = await Comment.find({ caseId, firmId: req.user.firmId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: comments });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    return res.status(statusCode).json({ success: false, message: safeMessage(error) });
  }
}

module.exports = {
  isValidTransition,
  assignDocket,
  unassignDocket,
  transitionDocket,
  addDocketComment,
  listDocketComments,
};
