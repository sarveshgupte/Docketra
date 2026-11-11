const Team = require('../models/Team.model');
const User = require('../models/User.model');
const { mapUserResponse } = require('../mappers/user.mapper');
const mongoose = require('mongoose');
const { createPrimaryWithQc, isValidObjectId } = require('../services/workbasketGuardrails.service');
const { resolveFirmScopedTeams, normalizeMembership, buildWorkbasketVisibilityQuery, normalizeObjectIdStrings } = require('../services/userWorkbasketMembership.service');
const { ensureDefaultRoutingForFirm } = require('../services/defaultRouting.service');
const { normalizeRole } = require('../utils/role.utils');
const log = require('../utils/log');

const resolveCandidateFirmIds = (req) => {
  const candidates = [
    req?.firmId,
    req?.ownershipFirmId,
    req?.user?.firmId,
    req?.tenant?.id,
    req?.firm?.id,
  ].filter(Boolean);

  return [...new Set(candidates.map((id) => String(id).trim()))];
};

const resolveEffectiveFirmId = (req) => {
  const candidateIds = resolveCandidateFirmIds(req);
  const validId = candidateIds.find((id) => mongoose.Types.ObjectId.isValid(id));
  if (validId) {
    return new mongoose.Types.ObjectId(validId);
  }
  return req?.user?.firmId || req?.firmId || null;
};

const resolveFirmQueryFilter = (req) => {
  const candidateIds = resolveCandidateFirmIds(req);
  if (candidateIds.length === 0) {
    return req?.user?.firmId || null;
  }
  if (candidateIds.length === 1) {
    return candidateIds[0];
  }
  const objectIds = candidateIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  return { $in: [...candidateIds, ...objectIds] };
};

const buildWorkbasketWarnings = async (firmIdOrFilter, workbasketIds = []) => {
  if (!firmIdOrFilter || workbasketIds.length === 0) return {};

  try {
    let firmFilter = firmIdOrFilter;
    if (typeof firmIdOrFilter === 'string' && mongoose.Types.ObjectId.isValid(firmIdOrFilter)) {
      firmFilter = { $in: [firmIdOrFilter, new mongoose.Types.ObjectId(firmIdOrFilter)] };
    }

    const aggResult = await User.aggregate([
      {
        $match: {
          firmId: firmFilter,
          status: { $ne: 'deleted' },
          isActive: true,
          teamIds: { $in: workbasketIds },
        },
      },
      { $unwind: '$teamIds' },
      { $match: { teamIds: { $in: workbasketIds } } },
      { $group: { _id: '$teamIds', count: { $sum: 1 } } },
    ]);

    const countMap = Object.fromEntries(aggResult.map((r) => [String(r._id), r.count]));

    return Object.fromEntries(
      workbasketIds.map((id) => [
        String(id),
        (countMap[String(id)] || 0) === 0 ? ['No users assigned to this workbasket'] : [],
      ]),
    );
  } catch (err) {
    log.warn('[WORKBASKET] Failed to build workbasket warnings', { error: err.message });
    return {};
  }
};

const listWorkbaskets = async (req, res) => {
  try {
    const includeInactive = String(req.query?.includeInactive || '').toLowerCase() === 'true';
    const visibility = buildWorkbasketVisibilityQuery({ user: req.user });
    if (visibility.denyAll) return res.json({ success: true, data: [] });

    const effectiveFirmId = resolveEffectiveFirmId(req);
    const firmFilter = resolveFirmQueryFilter(req);

    // Self-healing guard: ensure all PRIMARY workbaskets have a linked QC workbasket
    if (effectiveFirmId) {
      try {
        const allPrimary = await Team.find({ firmId: firmFilter, type: 'PRIMARY' });
        if (allPrimary.length > 0) {
          const primaryIds = allPrimary.map((p) => p._id);
          const existingQcs = await Team.find({
            firmId: firmFilter,
            type: 'QC',
            parentWorkbasketId: { $in: primaryIds },
          }).select('parentWorkbasketId').lean();
          const existingQcParentIds = new Set(existingQcs.map((qc) => String(qc.parentWorkbasketId)));

          const missingQcs = allPrimary
            .filter((primary) => !existingQcParentIds.has(String(primary._id)))
            .map((primary) => ({
              firmId: primary.firmId || effectiveFirmId,
              name: `${primary.name} — QC`,
              type: 'QC',
              parentWorkbasketId: primary._id,
              isActive: primary.isActive,
            }));

          if (missingQcs.length > 0) {
            try {
              await Team.insertMany(missingQcs, { ordered: false });
            } catch (bulkErr) {
              log.warn('[WORKBASKET] Bulk QC self-healing encountered duplicate/error', { error: bulkErr.message });
            }
          }
        }
      } catch (selfHealingErr) {
        log.warn('[WORKBASKET] Self-healing QC check encountered error', { error: selfHealingErr.message });
      }
    }

    const query = { firmId: firmFilter };
    if (!includeInactive) query.isActive = true;
    if (!visibility.firmWide) {
      const orClauses = [];
      if (Array.isArray(visibility.linkedIds) && visibility.linkedIds.length > 0) {
        orClauses.push({ _id: { $in: visibility.linkedIds } });
      }
      if (visibility.managerId) orClauses.push({ managerId: visibility.managerId });
      if (orClauses.length === 0) return res.json({ success: true, data: [] });
      query.$or = orClauses;
    }

    const teams = await Team.find(query).sort({ name: 1 }).lean();
    const warnings = await buildWorkbasketWarnings(firmFilter, teams.map((entry) => entry._id));
    return res.json({
      success: true,
      data: teams.map((team) => ({
        ...team,
        warnings: warnings[String(team._id)] || [],
      })),
    });
  } catch (error) {
    log.error('[WORKBASKET] Failed to load workbaskets', error);
    return res.status(500).json({ success: false, message: 'Failed to load workbaskets' });
  }
};

const createDefaultRouting = async (req, res) => {
  try {
    const effectiveFirmId = resolveEffectiveFirmId(req);
    if (!effectiveFirmId) {
      return res.status(400).json({ success: false, message: 'Firm context is required' });
    }
    const result = await ensureDefaultRoutingForFirm(effectiveFirmId);
    return res.status(201).json({
      success: true,
      data: result,
      message: result?.created ? 'Default routing configured' : 'Default routing already configured',
    });
  } catch (error) {
    log.error('[WORKBASKET] Failed to configure default routing', error);
    return res.status(500).json({ success: false, message: 'Failed to configure default routing' });
  }
};

const createWorkbasket = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Workbasket name is required' });

    const effectiveFirmId = resolveEffectiveFirmId(req);
    if (!effectiveFirmId) {
      return res.status(400).json({ success: false, message: 'Firm context is required' });
    }

    const { primary: created, qc: qcWorkbasket } = await createPrimaryWithQc({
      firmId: effectiveFirmId,
      name,
      managerId: req.body?.managerId || null,
      candidateFirmIds: resolveCandidateFirmIds(req),
    });

    return res.status(201).json({
      success: true,
      data: created,
      qcWorkbasket,
      warnings: ['No users assigned to this workbasket'],
      message: 'Workbasket created',
    });
  } catch (error) {
    const isDuplicate = error.statusCode === 409 || error.code === 11000 || error.message?.includes('duplicate key') || error.message?.includes('already exists');
    const statusCode = isDuplicate ? 409 : (error.statusCode || 500);
    const message = isDuplicate ? (error.message || 'A workbasket with this name already exists for this firm') : (error.message || 'Failed to create workbasket');
    log.error('[WORKBASKET] createWorkbasket error', { error: error.message, code: error.code, statusCode });
    return res.status(statusCode).json({ success: false, message });
  }
};

const getCoreWork = async (req, res) => {
  try {
    const teamIds = Array.isArray(req.user?.teamIds) && req.user.teamIds.length > 0
      ? req.user.teamIds
      : (req.user?.teamId ? [req.user.teamId] : []);

    const firmFilter = resolveFirmQueryFilter(req);
    const workbaskets = await Team.find({
      _id: { $in: teamIds },
      firmId: firmFilter,
      isActive: true,
    })
      .select('_id name type')
      .sort({ name: 1 })
      .lean();

    return res.json({
      success: true,
      workbaskets: workbaskets.map((workbasket) => ({
        id: String(workbasket._id),
        name: workbasket.name,
        type: workbasket.type || 'PRIMARY',
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load core work' });
  }
};

const renameWorkbasket = async (req, res) => {
  try {
    const workbasketId = String(req.params?.workbasketId || '').trim();
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Workbasket name is required' });

    if (!isValidObjectId(workbasketId)) return res.status(400).json({ success: false, message: 'Invalid workbasketId' });
    const firmFilter = resolveFirmQueryFilter(req);
    const workbasket = await Team.findOne({ _id: workbasketId, firmId: firmFilter });
    if (!workbasket) return res.status(404).json({ success: false, message: 'Workbasket not found' });

    const duplicate = await Team.findOne({
      _id: { $ne: workbasket._id },
      firmId: firmFilter,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (duplicate) return res.status(409).json({ success: false, message: 'Workbasket already exists' });

    const previousName = String(workbasket.name || '').trim();
    let linkedQc = null;
    if (String(workbasket.type || 'PRIMARY').toUpperCase() === 'PRIMARY') {
      linkedQc = await Team.findOne({ firmId: firmFilter, type: 'QC', parentWorkbasketId: workbasket._id });
      if (!linkedQc) return res.status(409).json({ success: false, message: 'Primary workbasket must have exactly one linked QC workbasket' });
    }

    workbasket.name = name;
    await workbasket.save();

    if (linkedQc) {
      const previousDefaultQcName = `${previousName} — QC`;
      const previousHyphenQcName = `${previousName} - QC`;
      if (String(linkedQc.name || '').trim() === previousDefaultQcName || String(linkedQc.name || '').trim() === previousHyphenQcName) {
        linkedQc.name = `${name} — QC`;
        await linkedQc.save();
      }
    }

    return res.json({ success: true, data: workbasket, message: 'Workbasket renamed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to rename workbasket' });
  }
};

const toggleWorkbasketStatus = async (req, res) => {
  try {
    const workbasketId = String(req.params?.workbasketId || '').trim();
    const isActive = req.body?.isActive;
    if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive must be boolean' });

    if (!isValidObjectId(workbasketId)) return res.status(400).json({ success: false, message: 'Invalid workbasketId' });
    const firmFilter = resolveFirmQueryFilter(req);
    const workbasket = await Team.findOne({ _id: workbasketId, firmId: firmFilter });
    if (!workbasket) return res.status(404).json({ success: false, message: 'Workbasket not found' });

    let linkedQc = null;
    if (String(workbasket.type || 'PRIMARY').toUpperCase() === 'PRIMARY') {
      linkedQc = await Team.findOne({ firmId: firmFilter, type: 'QC', parentWorkbasketId: workbasket._id });
      if (!linkedQc) return res.status(409).json({ success: false, message: 'Primary workbasket must have exactly one linked QC workbasket' });
    }

    workbasket.isActive = isActive;
    await workbasket.save();

    if (linkedQc && linkedQc.isActive !== isActive) {
      linkedQc.isActive = isActive;
      await linkedQc.save();
    }

    if (!isActive) {
      await User.updateMany(
        { firmId: firmFilter, teamIds: workbasket._id },
        { $pull: { teamIds: workbasket._id } },
      );
      const usersWithoutTeam = await User.find({
        firmId: firmFilter,
        status: { $ne: 'deleted' },
        $or: [
          { teamIds: { $exists: false } },
          { teamIds: { $size: 0 } },
        ],
      }).select('_id').lean();
      if (usersWithoutTeam.length > 0) {
        const fallback = await Team.findOne({ firmId: firmFilter, isActive: true }).select('_id').lean();
        if (fallback?._id) {
          await User.updateMany(
            { _id: { $in: usersWithoutTeam.map((entry) => entry._id) } },
            { $set: { teamId: fallback._id, teamIds: [fallback._id] } },
          );
        }
      }
      await User.updateMany(
        { firmId: firmFilter, teamId: workbasket._id },
        [
          {
            $set: {
              teamId: {
                $ifNull: [{ $arrayElemAt: ['$teamIds', 0] }, null],
              },
            },
          },
        ],
      );
    }

    return res.json({ success: true, data: workbasket, message: `Workbasket ${isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update workbasket status' });
  }
};

const updateUserWorkbaskets = async (req, res) => {
  try {
    const xID = String(req.params?.xID || '').trim().toUpperCase();
    const normalizedTeamIds = normalizeObjectIdStrings(req.body?.teamIds || []);
    const assignQcWorkbaskets = Boolean(req.body?.assignQcWorkbaskets);

    const firmFilter = resolveFirmQueryFilter(req);
    const effectiveFirmId = resolveEffectiveFirmId(req);
    const user = await User.findOne({ xID, firmId: firmFilter, status: { $ne: 'deleted' } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const requirePrimary = user.status === 'active' && normalizeRole(user.role) !== 'SUPER_ADMIN';
    if (requirePrimary && normalizedTeamIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one PRIMARY workbasket is required for active users' });
    }

    const teams = await resolveFirmScopedTeams({ firmId: effectiveFirmId || user.firmId, teamIds: normalizedTeamIds });

    const preservedExplicitQcIds = normalizeObjectIdStrings(user.qcExplicitTeamIds || []);
    const preservedExplicitQcTeams = preservedExplicitQcIds.length > 0
      ? await Team.find({
        _id: { $in: preservedExplicitQcIds },
        firmId: firmFilter,
        isActive: true,
        type: 'QC',
      }).select('_id type').lean()
      : [];

    const selectedPrimaryTeamIds = teams
      .filter((team) => String(team?.type || 'PRIMARY').toUpperCase() !== 'QC')
      .map((team) => String(team._id));

    const linkedQcTeams = (assignQcWorkbaskets && selectedPrimaryTeamIds.length > 0)
      ? await Team.find({
        firmId: firmFilter,
        isActive: true,
        type: 'QC',
        parentWorkbasketId: { $in: selectedPrimaryTeamIds },
      }).select('_id type').lean()
      : [];

    const membership = normalizeMembership({
      role: user.role,
      teams: [...teams, ...preservedExplicitQcTeams, ...linkedQcTeams],
      qcExplicitTeamIds: [
        ...preservedExplicitQcIds,
        ...teams.filter((team) => String(team?.type || '').toUpperCase() === 'QC').map((team) => String(team._id)),
        ...linkedQcTeams.map((team) => String(team._id)),
      ],
      requirePrimary,
    });

    user.teamIds = membership.teamIds;
    user.teamId = membership.teamId;
    user.qcExplicitTeamIds = membership.qcExplicitTeamIds;
    await user.save();

    return res.json({ success: true, message: 'User workbaskets updated', data: mapUserResponse(user) });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const safeMessage = statusCode >= 500
      ? 'Failed to update user workbaskets'
      : (error.message || 'Failed to update user workbaskets');
    return res.status(statusCode).json({ success: false, message: safeMessage });
  }
};

const addQcMember = async (req, res) => {
  try {
    const { workbasketId } = req.params;
    const { userId } = req.body || {};
    if (!isValidObjectId(workbasketId) || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const firmFilter = resolveFirmQueryFilter(req);
    const qcWorkbasket = await Team.findOne({
      _id: workbasketId,
      firmId: firmFilter,
      type: 'QC',
      parentWorkbasketId: { $ne: null },
    }).lean();
    if (!qcWorkbasket) return res.status(404).json({ success: false, message: 'QC workbasket not found' });

    const actorRole = normalizeRole(req.user?.role);
    if (!['ADMIN', 'PRIMARY_ADMIN'].includes(actorRole)) {
      const parent = await Team.findOne({ _id: qcWorkbasket.parentWorkbasketId, firmId: firmFilter }).lean();
      const isManager = parent?.managerId && String(parent.managerId) === String(req.user?._id);
      if (!isManager) return res.status(403).json({ success: false, message: 'Not allowed to add QC members' });
    }

    const user = await User.findOne({ _id: userId, firmId: firmFilter, status: { $ne: 'deleted' } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await User.updateOne({ _id: user._id }, { $addToSet: { teamIds: qcWorkbasket._id, qcExplicitTeamIds: qcWorkbasket._id } });
    return res.json({ success: true, message: 'QC member added' });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to add QC member' });
  }
};

module.exports = {
  listWorkbaskets,
  createDefaultRouting,
  createWorkbasket,
  getCoreWork,
  renameWorkbasket,
  toggleWorkbasketStatus,
  updateUserWorkbaskets,
  addQcMember,
};
