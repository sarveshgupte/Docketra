const mongoose = require('mongoose');
const Team = require('../models/Team.model');
const { resolveCanonicalTenantFromFirmId } = require('./tenantIdentity.service');

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

const validateCategoryMappedWorkbasket = async ({ workbasketId, firmId, candidateFirmIds, req }) => {
  if (!workbasketId || !mongoose.Types.ObjectId.isValid(workbasketId)) {
    return { valid: false, message: 'Valid active primary workbasket is required' };
  }

  const rawCandidateStrings = resolveCandidateFirmIds({ firmId, candidateFirmIds, req });

  // 1. Direct query: standard active PRIMARY workbasket matching firm
  const primaryQuery = {
    _id: workbasketId,
    isActive: true,
    type: 'PRIMARY',
  };
  if (firmId) {
    primaryQuery.firmId = firmId;
  }

  let workbasket = await Team.findOne(primaryQuery).select('_id type isActive firmId');

  // 2. Resilient fallback for unmigrated workbaskets where type may be null/undefined
  if (!workbasket) {
    const fallbackQuery = {
      _id: workbasketId,
      isActive: { $ne: false },
      $or: [
        { type: 'PRIMARY' },
        { type: { $ne: 'QC' } },
        { type: { $exists: false } },
        { type: null },
      ],
    };
    if (firmId) {
      fallbackQuery.firmId = firmId;
    }

    const fallbackWorkbasket = await Team.findOne(fallbackQuery).select('_id type isActive firmId');
    if (fallbackWorkbasket) {
      if (fallbackWorkbasket.type !== 'PRIMARY') {
        await Team.updateOne({ _id: fallbackWorkbasket._id }, { $set: { type: 'PRIMARY' } }).catch(() => {});
      }
      workbasket = fallbackWorkbasket;
    }
  }

  // 3. Multi-tenant ID resolution fallback (handling tenantId vs ownershipFirmId representations)
  if (!workbasket && rawCandidateStrings.length > 0) {
    const candidateObjectIds = rawCandidateStrings
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const candidateQuery = {
      _id: workbasketId,
      isActive: { $ne: false },
      $or: [
        { type: 'PRIMARY' },
        { type: { $ne: 'QC' } },
        { type: { $exists: false } },
        { type: null },
      ],
      firmId: { $in: [...rawCandidateStrings, ...candidateObjectIds] },
    };

    const candidateWorkbasket = await Team.findOne(candidateQuery).select('_id type isActive firmId');
    if (candidateWorkbasket) {
      if (candidateWorkbasket.type !== 'PRIMARY') {
        await Team.updateOne({ _id: candidateWorkbasket._id }, { $set: { type: 'PRIMARY' } }).catch(() => {});
      }
      workbasket = candidateWorkbasket;
    }
  }

  // 4. Canonical tenant mapping fallback for legacy/migrated firm topologies
  if (!workbasket && rawCandidateStrings.length > 0) {
    try {
      const workbasketDoc = await Team.findOne({
        _id: workbasketId,
        isActive: { $ne: false },
        type: { $ne: 'QC' },
      }).select('_id type isActive firmId');

      if (workbasketDoc) {
        if (!workbasketDoc.firmId) {
          // Unassigned legacy workbasket: associate with firm and heal
          if (firmId && mongoose.Types.ObjectId.isValid(firmId)) {
            await Team.updateOne({ _id: workbasketDoc._id }, { $set: { firmId } }).catch(() => {});
          }
          workbasket = workbasketDoc;
        } else {
          const tenantInfo = await resolveCanonicalTenantFromFirmId(workbasketDoc.firmId);
          if (tenantInfo) {
            const canonicalKeys = [
              tenantInfo.tenantId,
              tenantInfo.defaultClientId,
              tenantInfo.ownershipFirmId,
              tenantInfo.legacyFirmId,
              tenantInfo.firmSlug,
            ].filter(Boolean).map(String);

            const isSameTenant = canonicalKeys.some((k) => rawCandidateStrings.includes(k));
            if (isSameTenant) {
              if (workbasketDoc.type !== 'PRIMARY') {
                await Team.updateOne({ _id: workbasketDoc._id }, { $set: { type: 'PRIMARY' } }).catch(() => {});
              }
              workbasket = workbasketDoc;
            }
          }
        }
      }
    } catch (_) {
      // Best-effort tenant resolution
    }
  }

  if (!workbasket) {
    return { valid: false, message: 'Valid active primary workbasket is required' };
  }

  return { valid: true, workbasket };
};

module.exports = {
  validateCategoryMappedWorkbasket,
};
