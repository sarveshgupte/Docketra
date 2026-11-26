const mongoose = require('mongoose');
const Team = require('../models/Team.model');
const User = require('../models/User.model');

const WORKBASKET_NAME_MAX_LENGTH = 80;
const RESERVED_QC_SUFFIX_REGEX = /\s*[-—–]\s*qc$/i;
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isDuplicateKeyError = (error) => (
  error?.statusCode === 409
  || error?.code === 11000
  || /duplicate key|E11000|already exists/i.test(String(error?.message || ''))
);

const normalizeWorkbasketName = (rawName) => String(rawName || '').replace(/\s+/g, ' ').trim();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFirmQueryScope = ({ firmId, candidateFirmIds = [] }) => {
  const allFirmIds = [...new Set([String(firmId), ...(candidateFirmIds || []).map(String)].filter(Boolean))];
  const objectIds = allFirmIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  return allFirmIds.length > 1 ? { $in: [...allFirmIds, ...objectIds] } : firmId;
};

const validateWorkbasketName = (rawName) => {
  if (CONTROL_CHAR_REGEX.test(String(rawName || ''))) {
    throw createHttpError('Workbasket name contains invalid characters', 400);
  }
  const normalized = normalizeWorkbasketName(rawName);
  if (!normalized) {
    throw createHttpError('Workbasket name is required', 400);
  }
  if (normalized.length > WORKBASKET_NAME_MAX_LENGTH) {
    throw createHttpError(`Workbasket name must be ${WORKBASKET_NAME_MAX_LENGTH} characters or fewer`, 400);
  }
  if (RESERVED_QC_SUFFIX_REGEX.test(normalized)) {
    throw createHttpError('Workbasket name cannot end with "- QC"; linked QC workbaskets are created automatically', 400);
  }
  return normalized;
};

const buildWhitespaceNormalizedPattern = (normalizedName) => (
  normalizedName.split(' ').map(escapeRegex).join('\\s+')
);

const findConflictingWorkbasket = async ({ firmFilter, normalizedName, session = null }) => {
  const namePattern = buildWhitespaceNormalizedPattern(normalizedName);
  return Team.findOne(
    {
      firmId: firmFilter,
      $or: [
        { name: new RegExp(`^${namePattern}$`, 'i') },
        { name: new RegExp(`^${namePattern}\\s*[-—–]\\s*QC$`, 'i') },
      ],
    },
    null,
    session ? { session } : undefined,
  );
};

async function ensureLinkedQcWorkbasket({ firmId, primaryWorkbasket, session = null } = {}) {
  if (!firmId || !primaryWorkbasket?._id) return null;
  const baseName = normalizeWorkbasketName(primaryWorkbasket.name || 'Workbasket');
  return Team.findOneAndUpdate(
    { firmId, type: 'QC', parentWorkbasketId: primaryWorkbasket._id },
    {
      $setOnInsert: {
        firmId,
        name: `${baseName} — QC`,
        isActive: primaryWorkbasket.isActive !== false,
        type: 'QC',
        parentWorkbasketId: primaryWorkbasket._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, session: session || undefined },
  );
}

const isUnsupportedTransactionError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('transaction')
    || message.includes('replica set')
    || message.includes('standalone')
    || message.includes('topology')
  );
};

const cleanupOrphanWorkbaskets = async ({ firmId, ids = [] }) => {
  const validIds = ids.filter(Boolean);
  if (validIds.length === 0) return;
  try {
    if (typeof Team.deleteMany === 'function') {
      await Team.deleteMany({ _id: { $in: validIds }, firmId });
    } else if (typeof Team.deleteOne === 'function') {
      await Promise.all(validIds.map((id) => Team.deleteOne({ _id: id, firmId })));
    }
  } catch (_) {
    // Best-effort compensation when running without multi-document transactions
  }
};

async function createPrimaryWithQc({ firmId, name, managerId = null, candidateFirmIds = [] }) {
  if (!firmId) throw createHttpError('Firm context is required', 400);
  const trimmedName = validateWorkbasketName(name);
  if (managerId && !isValidObjectId(managerId)) {
    throw createHttpError('Invalid managerId', 400);
  }

  const firmFilter = buildFirmQueryScope({ firmId, candidateFirmIds });

  if (managerId) {
    const manager = await User.findOne({
      _id: managerId,
      firmId: firmFilter,
      status: { $ne: 'deleted' },
    });
    if (!manager || manager.isActive === false) {
      throw createHttpError('Selected manager must be an active user in this firm', 400);
    }
  }

  const preflightConflict = await findConflictingWorkbasket({ firmFilter, normalizedName: trimmedName });
  if (preflightConflict) {
    throw createHttpError('A workbasket with this name or linked QC already exists', 409);
  }

  const session = await mongoose.startSession();
  let primary = null;
  let qc = null;

  const createPair = async (activeSession = null) => {
    const createOpts = activeSession ? { session: activeSession } : undefined;
    const inTxConflict = activeSession
      ? await findConflictingWorkbasket({ firmFilter, normalizedName: trimmedName, session: activeSession })
      : null;
    if (inTxConflict) {
      throw createHttpError('A workbasket with this name or linked QC already exists', 409);
    }

    try {
      [primary] = await Team.create(
        [{ firmId, name: trimmedName, managerId: managerId || null, type: 'PRIMARY', parentWorkbasketId: null, isActive: true }],
        createOpts,
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw createHttpError('A workbasket with this name already exists', 409);
      }
      throw error;
    }

    try {
      [qc] = await Team.create(
        [{ firmId, name: `${trimmedName} — QC`, type: 'QC', parentWorkbasketId: primary._id, isActive: true }],
        createOpts,
      );
    } catch (error) {
      if (!activeSession) {
        await cleanupOrphanWorkbaskets({ firmId, ids: [primary?._id] });
      }
      if (isDuplicateKeyError(error)) {
        throw createHttpError('A linked QC workbasket with this name already exists', 409);
      }
      throw error;
    }

    if (managerId) {
      try {
        await User.updateOne(
          { _id: managerId, firmId: firmFilter, status: { $ne: 'deleted' } },
          { $addToSet: { teamIds: qc._id } },
          createOpts,
        );
      } catch (error) {
        if (!activeSession) {
          await cleanupOrphanWorkbaskets({ firmId, ids: [qc?._id, primary?._id] });
        }
        throw error;
      }
    }
  };

  try {
    const transactionSupported = typeof session.withTransaction === 'function';
    if (transactionSupported) {
      try {
        await session.withTransaction(async () => createPair(session));
      } catch (error) {
        if (!isUnsupportedTransactionError(error)) {
          if (isDuplicateKeyError(error)) error.statusCode = 409;
          throw error;
        }
        primary = null;
        qc = null;
        await createPair(null);
      }
    } else {
      await createPair(null);
    }
  } catch (outerErr) {
    if (isDuplicateKeyError(outerErr)) {
      outerErr.statusCode = 409;
    }
    throw outerErr;
  } finally {
    await session.endSession();
  }

  return { primary, qc };
}

module.exports = {
  WORKBASKET_NAME_MAX_LENGTH,
  RESERVED_QC_SUFFIX_REGEX,
  isValidObjectId,
  createHttpError,
  isDuplicateKeyError,
  normalizeWorkbasketName,
  validateWorkbasketName,
  ensureLinkedQcWorkbasket,
  createPrimaryWithQc,
};
