const mongoose = require('mongoose');
const Team = require('../models/Team.model');
const { resolveCanonicalTenantFromFirmId } = require('./tenantIdentity.service');
const { ensureLinkedQcWorkbasket } = require('./workbasketGuardrails.service');

const NON_QC_FILTER = {
  isActive: { $ne: false },
  $or: [
    { type: 'PRIMARY' },
    { type: { $ne: 'QC' } },
    { type: { $exists: false } },
    { type: null },
  ],
};

const resolveCandidateFirmIds = ({ firmId, candidateFirmIds, req }) => {
  const candidates = [
    ...(Array.isArray(candidateFirmIds) ? candidateFirmIds : []),
    firmId,
    req?.firmId,
    req?.ownershipFirmId,
    req?.user?.firmId,
    req?.tenant?.id,
    req?.firm?.id,
    req?.firm?.ownershipFirmId,
  ].filter(Boolean);

  return [...new Set(candidates.map((id) => String(id).trim()))];
};

const healLegacyPrimaryType = async (workbasketDoc) => {
  if (!workbasketDoc || workbasketDoc.type === 'PRIMARY') return workbasketDoc;
  await Team.updateOne({ _id: workbasketDoc._id }, { $set: { type: 'PRIMARY' } }).catch(() => {});
  return workbasketDoc;
};

const findPrimaryWorkbasket = async ({ workbasketId, firmId, rawCandidateStrings }) => {
  const selectFields = '_id name type isActive firmId';
  const directQuery = { _id: workbasketId, isActive: true, type: 'PRIMARY' };
  if (firmId) directQuery.firmId = firmId;

  const directMatch = await Team.findOne(directQuery).select(selectFields);
  if (directMatch) return directMatch;

  const legacyQuery = { _id: workbasketId, ...NON_QC_FILTER };
  if (firmId) legacyQuery.firmId = firmId;

  const legacyMatch = await Team.findOne(legacyQuery).select(selectFields);
  if (legacyMatch) return healLegacyPrimaryType(legacyMatch);

  if (rawCandidateStrings.length > 0) {
    const candidateObjectIds = rawCandidateStrings
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const candidateMatch = await Team.findOne({
      _id: workbasketId,
      ...NON_QC_FILTER,
      firmId: { $in: [...rawCandidateStrings, ...candidateObjectIds] },
    }).select(selectFields);
    if (candidateMatch) return healLegacyPrimaryType(candidateMatch);

    try {
      const workbasketDoc = await Team.findOne({
        _id: workbasketId,
        isActive: { $ne: false },
        type: { $ne: 'QC' },
      }).select(selectFields);

      if (!workbasketDoc) return null;

      if (!workbasketDoc.firmId) {
        if (firmId && mongoose.Types.ObjectId.isValid(firmId)) {
          await Team.updateOne({ _id: workbasketDoc._id }, { $set: { firmId } }).catch(() => {});
        }
        return healLegacyPrimaryType(workbasketDoc);
      }

      const tenantInfo = await resolveCanonicalTenantFromFirmId(workbasketDoc.firmId);
      const canonicalKeys = [
        tenantInfo?.tenantId,
        tenantInfo?.defaultClientId,
        tenantInfo?.ownershipFirmId,
        tenantInfo?.legacyFirmId,
        tenantInfo?.firmSlug,
      ].filter(Boolean).map(String);

      if (canonicalKeys.some((k) => rawCandidateStrings.includes(k))) {
        return healLegacyPrimaryType(workbasketDoc);
      }
    } catch (_) {
      // Best-effort tenant resolution
    }
  }

  return null;
};

const resolveLinkedQcWorkbasket = async ({ primaryWorkbasket, qcWorkbasketId, firmId }) => {
  const selectFields = '_id name type isActive firmId parentWorkbasketId';
  const resolvedFirmId = primaryWorkbasket.firmId || firmId || null;
  const firmScope = resolvedFirmId ? { firmId: resolvedFirmId } : {};

  if (qcWorkbasketId) {
    if (!mongoose.Types.ObjectId.isValid(qcWorkbasketId)) {
      return { valid: false, message: 'Valid active linked QC workbasket is required' };
    }
    const explicitQc = await Team.findOne({
      _id: qcWorkbasketId,
      ...firmScope,
    }).select(selectFields);

    const isLinkedToPrimary = explicitQc
      && String(explicitQc.type || '').toUpperCase() === 'QC'
      && String(explicitQc.parentWorkbasketId || '') === String(primaryWorkbasket._id)
      && explicitQc.isActive !== false;

    if (!isLinkedToPrimary) {
      return {
        valid: false,
        message: 'Linked QC workbasket must be active and linked to the selected primary workbasket',
      };
    }
    return { valid: true, qcWorkbasket: explicitQc };
  }

  const linkedQc = await Team.findOne({
    ...firmScope,
    type: 'QC',
    parentWorkbasketId: primaryWorkbasket._id,
  }).select(selectFields);

  if (linkedQc) {
    if (linkedQc.isActive === false) {
      return {
        valid: false,
        message: 'Linked QC workbasket is inactive; activate or select a workbasket with an active QC workbasket',
      };
    }
    return { valid: true, qcWorkbasket: linkedQc };
  }

  // Self-heal missing QC workbasket only when backed by an active database connection
  if (mongoose.connection?.readyState === 1 && resolvedFirmId) {
    const ensuredQc = await ensureLinkedQcWorkbasket({
      firmId: resolvedFirmId,
      primaryWorkbasket,
    }).catch(() => null);
    if (ensuredQc && ensuredQc.isActive !== false) {
      return { valid: true, qcWorkbasket: ensuredQc };
    }
    return {
      valid: false,
      message: 'Valid active linked QC workbasket is required',
    };
  }

  return { valid: true, qcWorkbasket: null };
};

const validateCategoryMappedWorkbasket = async ({ workbasketId, qcWorkbasketId = null, firmId, candidateFirmIds, req }) => {
  if (!workbasketId || !mongoose.Types.ObjectId.isValid(workbasketId)) {
    return { valid: false, message: 'Valid active primary workbasket is required' };
  }

  const rawCandidateStrings = resolveCandidateFirmIds({ firmId, candidateFirmIds, req });
  const workbasket = await findPrimaryWorkbasket({ workbasketId, firmId, rawCandidateStrings });

  if (!workbasket) {
    return { valid: false, message: 'Valid active primary workbasket is required' };
  }

  const qcResolution = await resolveLinkedQcWorkbasket({
    primaryWorkbasket: workbasket,
    qcWorkbasketId,
    firmId,
  });

  if (!qcResolution.valid) {
    return { valid: false, message: qcResolution.message };
  }

  return {
    valid: true,
    workbasket,
    qcWorkbasket: qcResolution.qcWorkbasket,
  };
};

module.exports = {
  validateCategoryMappedWorkbasket,
};
