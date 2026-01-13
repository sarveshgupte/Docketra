const Case = require('../models/Case.model');
const Task = require('../models/Task');
const Client = require('../models/Client.model');
const Attachment = require('../models/Attachment.model');
const Comment = require('../models/Comment.model');
const Category = require('../models/Category.model');
const User = require('../models/User.model');
const { recordAdminAudit } = require('./adminAudit.service');

const getActorXID = (req) => req?.user?.xID || req?.user?.xid || req?.actorXID || null;
const getFirmId = (req, fallbackDoc) => req?.firmId || req?.user?.firmId || fallbackDoc?.firmId || null;
const getSession = (req, explicitSession) => explicitSession || req?.transactionSession?.session || req?.mongoSession || null;

const emitAudit = async ({ action, modelName, doc, req, reason }) => {
  if (!req) return;
  try {
    await recordAdminAudit({
      actor: getActorXID(req) || 'UNKNOWN_ACTOR',
      firmId: getFirmId(req, doc) || 'UNKNOWN_FIRM',
      userId: req.user?._id || null,
      action: `${action} ${modelName}`,
      target: doc?._id?.toString?.() || null,
      scope: 'admin',
      requestId: req.requestId || req.headers?.['x-request-id'] || null,
      status: req.transactionCommitted ? 200 : (req.res?.statusCode || 200),
      durationMs: req.requestDurationMs,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
      reason,
    });
  } catch (err) {
    console.warn('[SOFT_DELETE][AUDIT] Failed to record audit:', err.message);
  }
};

const applyDocumentDeleteMarkers = async (doc, { actorXID, reason, session }) => {
  if (!doc) return null;
  if (!doc.deletedAt) {
    doc.deletedAt = new Date();
    doc.deletedByXID = actorXID || null;
    doc.deleteReason = reason || null;
  }
  return doc.save({ session });
};

const restoreMany = async ({ model, filter, req, session }) => {
  const query = model.find({ ...filter, includeDeleted: true });
  if (session) query.session(session);
  const docs = await query.exec();
  const restoredBy = getActorXID(req);
  for (const doc of docs) {
    if (!doc.deletedAt) continue;
    doc.restoreHistory = Array.isArray(doc.restoreHistory) ? doc.restoreHistory : [];
    doc.restoreHistory.push({ restoredAt: new Date(), restoredByXID: restoredBy || null });
    doc.deletedAt = null;
    doc.deletedByXID = null;
    doc.deleteReason = null;
    await doc.save({ session });
  }
  return docs;
};

const softDeleteMany = async ({ model, filter, req, reason, session }) => {
  const query = model.find({ ...filter, includeDeleted: true });
  if (session) query.session(session);
  const docs = await query.exec();
  const actorXID = getActorXID(req);
  for (const doc of docs) {
    await applyDocumentDeleteMarkers(doc, { actorXID, reason, session });
  }
  return docs;
};

const ensureCategoryNotInUse = async (categoryDoc, session) => {
  const inUseCount = await Case.countDocuments(
    { categoryId: categoryDoc._id },
    { session }
  );
  if (inUseCount > 0) {
    const err = new Error('Category is in use by existing cases and cannot be deleted');
    err.statusCode = 400;
    throw err;
  }
};

const cascadeDeletes = async (modelName, doc, req, session, reason) => {
  if (modelName === 'Client') {
    await softDeleteMany({ model: Case, filter: { clientId: doc.clientId, firmId: doc.firmId }, req, reason, session });
    const relatedCases = await Case.find({ clientId: doc.clientId, firmId: doc.firmId, includeDeleted: true }).session(session);
    for (const caseDoc of relatedCases) {
      await cascadeDeletes('Case', caseDoc, req, session, reason);
    }
  }
  if (modelName === 'Case') {
    await softDeleteMany({ model: Task, filter: { case: doc._id, firmId: doc.firmId }, req, reason, session });
    await softDeleteMany({ model: Attachment, filter: { caseId: doc.caseId || doc.caseNumber }, req, reason, session });
    await softDeleteMany({ model: Comment, filter: { caseId: doc.caseId || doc.caseNumber }, req, reason, session });
  }
};

const softDelete = async ({ model, filter, req, reason }) => {
  const session = getSession(req);
  if (model.modelName === 'Category') {
    const categoryDoc = await model.findOne({ ...filter, includeDeleted: true }).session(session);
    if (!categoryDoc) return null;
    await ensureCategoryNotInUse(categoryDoc, session);
  }

  const query = model.findOne({ ...filter, includeDeleted: true });
  if (session) query.session(session);
  const doc = await query.exec();
  if (!doc) return null;

  // User deletes disable login rather than removing data
  if (model.modelName === 'User') {
    doc.status = 'DISABLED';
    doc.isActive = false;
  }

  await applyDocumentDeleteMarkers(doc, { actorXID: getActorXID(req), reason, session });
  await cascadeDeletes(model.modelName, doc, req, session, reason);
  await emitAudit({ action: 'SOFT_DELETE', modelName: model.modelName, doc, req, reason });
  return doc;
};

const ensureParentsActive = async (modelName, doc, session) => {
  if (modelName === 'Case' && doc.clientId) {
    const parentClient = await Client.findOne({ clientId: doc.clientId, includeDeleted: true }).session(session);
    if (parentClient?.deletedAt) {
      const err = new Error('Cannot restore case while client is deleted');
      err.statusCode = 400;
      throw err;
    }
  }
  if (modelName === 'Task' && doc.case) {
    const parentCase = await Case.findOne({ _id: doc.case, includeDeleted: true }).session(session);
    if (parentCase?.deletedAt) {
      const err = new Error('Cannot restore task while parent case is deleted');
      err.statusCode = 400;
      throw err;
    }
  }
  if ((modelName === 'Attachment' || modelName === 'Comment') && doc.caseId) {
    const parentCase = await Case.findOne({ $or: [{ caseId: doc.caseId }, { caseNumber: doc.caseId }], includeDeleted: true }).session(session);
    if (parentCase?.deletedAt) {
      const err = new Error('Cannot restore child while parent case is deleted');
      err.statusCode = 400;
      throw err;
    }
  }
};

const restoreDocument = async ({ model, filter, req }) => {
  const session = getSession(req);
  const query = model.findOne({ ...filter, includeDeleted: true });
  if (session) query.session(session);
  const doc = await query.exec();
  if (!doc || !doc.deletedAt) return doc;

  await ensureParentsActive(model.modelName, doc, session);

  doc.restoreHistory = Array.isArray(doc.restoreHistory) ? doc.restoreHistory : [];
  doc.restoreHistory.push({
    restoredAt: new Date(),
    restoredByXID: getActorXID(req) || null,
  });
  doc.deletedAt = null;
  doc.deletedByXID = null;
  doc.deleteReason = null;
  if (model.modelName === 'User') {
    doc.isActive = true;
    if (doc.status === 'DISABLED') {
      doc.status = 'ACTIVE';
    }
  }
  await doc.save({ session });

  // Restore children that were soft-deleted with the parent
  if (model.modelName === 'Case') {
    await restoreMany({
      model: Task,
      filter: { case: doc._id, firmId: doc.firmId, deletedAt: { $ne: null } },
      req,
      session,
    });
    await restoreMany({
      model: Attachment,
      filter: { caseId: doc.caseId || doc.caseNumber, deletedAt: { $ne: null } },
      req,
      session,
    });
    await restoreMany({
      model: Comment,
      filter: { caseId: doc.caseId || doc.caseNumber, deletedAt: { $ne: null } },
      req,
      session,
    });
  }

  await emitAudit({ action: 'RESTORE', modelName: model.modelName, doc, req });
  return doc;
};

const buildDiagnostics = async () => {
  const models = [
    { name: 'User', model: User },
    { name: 'Client', model: Client },
    { name: 'Case', model: Case },
    { name: 'Task', model: Task },
    { name: 'Attachment', model: Attachment },
    { name: 'Comment', model: Comment },
    { name: 'Category', model: Category },
  ];

  const retentionDays = parseInt(process.env.SOFT_DELETE_RETENTION_DAYS || '90', 10);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const summary = [];
  for (const { name, model } of models) {
    const deletedCount = await model.countDocuments({ deletedAt: { $ne: null }, includeDeleted: true });
    const oldest = await model.findOne({ deletedAt: { $ne: null }, includeDeleted: true })
      .sort({ deletedAt: 1 })
      .select({ deletedAt: 1 })
      .lean();
    const eligibleForPurge = await model.countDocuments({
      deletedAt: { $lte: cutoff },
      includeDeleted: true,
    });
    summary.push({
      entity: name,
      deletedCount,
      oldestDeletedAt: oldest?.deletedAt || null,
      eligibleForPurge,
    });
  }

  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    summary,
  };
};

module.exports = {
  softDelete,
  restoreDocument,
  buildDiagnostics,
};
