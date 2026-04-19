const mongoose = require('mongoose');
const User = require('../models/User.model');
const SuperadminAudit = require('../models/SuperadminAudit.model');
const log = require('../utils/log');

const ADMIN_ROLE_VALUES = ['ADMIN', 'PRIMARY_ADMIN', 'Admin'];

const findFirmAdmin = async (firmObjectId) => {
  return User.findOne({
    firmId: firmObjectId,
    isSystem: true,
    role: { $in: ADMIN_ROLE_VALUES },
    status: { $ne: 'deleted' },
  });
};

const findFirmAdminById = async (firmObjectId, adminId) => {
  if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
    return null;
  }
  return User.findOne({
    _id: adminId,
    firmId: firmObjectId,
    role: { $in: ADMIN_ROLE_VALUES },
    status: { $ne: 'deleted' },
  });
};

const isAdminCurrentlyLocked = (admin) => {
  if (!admin?.lockUntil) return false;
  return admin.lockUntil instanceof Date && admin.lockUntil > new Date();
};

const normalizeAdminLifecycleStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'disabled' || normalized === 'suspended') {
    return 'disabled';
  }
  if (normalized === 'active') {
    return 'active';
  }
  return null;
};

const isAdminDisabledStatus = (status) => normalizeAdminLifecycleStatus(status) === 'disabled';

const resolveSessionQuery = (query, session) => {
  if (session && query && typeof query.session === 'function') {
    query = query.session(session);
  }
  if (query && typeof query.exec === 'function') {
    return query.exec();
  }
  return Promise.resolve(query);
};

const logSuperadminAction = async ({ actionType, description, performedBy, performedById, targetEntityType, targetEntityId, metadata = {}, req, session = null }) => {
  try {
    const isSystemAction = !performedById
      || (typeof performedById === 'string' && !mongoose.Types.ObjectId.isValid(performedById));

    const auditEntry = {
      actionType,
      description,
      performedBy,
      targetEntityType,
      targetEntityId,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
      metadata,
    };

    if (isSystemAction) {
      auditEntry.performedBySystem = true;
      auditEntry.performedById = null;
    } else {
      auditEntry.performedById = performedById;
      auditEntry.performedBySystem = false;
    }

    if (session) {
      await SuperadminAudit.create([auditEntry], { session });
    } else {
      await SuperadminAudit.create(auditEntry);
    }
  } catch (error) {
    log.error('[SUPERADMIN_AUDIT] Failed to log action:', error.message);
  }
};

module.exports = {
  ADMIN_ROLE_VALUES,
  findFirmAdmin,
  findFirmAdminById,
  isAdminCurrentlyLocked,
  normalizeAdminLifecycleStatus,
  isAdminDisabledStatus,
  resolveSessionQuery,
  logSuperadminAction,
};
