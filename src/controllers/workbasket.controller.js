const Team = require('../models/Team.model');
const User = require('../models/User.model');
const { mapUserResponse } = require('../mappers/user.mapper');
const mongoose = require('mongoose');
const { createPrimaryWithQc, isValidObjectId } = require('../services/workbasketGuardrails.service');
const { resolveFirmScopedTeams, normalizeMembership, buildWorkbasketVisibilityQuery, normalizeObjectIdStrings } = require('../services/userWorkbasketMembership.service');

const buildWorkbasketWarnings = async (firmId, workbasketIds = []) => {
  if (!firmId || workbasketIds.length === 0) return {};

  // ⚡ Bolt: Optimize workbasket user counts
  // 💡 What: Replaced Promise.all(workbasketIds.map(...countDocuments)) with a single aggregate pipeline.
  // 🎯 Why: Reduces DB network round-trips from N (one per workbasket) to 1 and improves database concurrency limits.
  // 📊 Impact: O(1) query time instead of O(N) when a firm has many workbaskets.
  const aggResult = await User.aggregate([
    {
      $match: {
        firmId,
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
};

const listWorkbaskets = async (req, res) => {
  try {
    const includeInactive = String(req.query?.includeInactive || '').toLowerCase() === 'true';
    const visibility = buildWorkbasketVisibilityQuery({ user: req.user });
    if (visibility.denyAll) return res.json({ success: true, data: [] });

    const query = { firmId: req.user?.firmId };
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
    const warnings = await buildWorkbasketWarnings(req.user?.firmId, teams.map((entry) => entry._id));
    return res.json({
      success: true,
      data: teams.map((team) => ({
        ...team,
        warnings: warnings[String(team._id)] || [],
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load workbaskets' });
  }
};

const createWorkbasket = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Workbasket name is required' });

    const { primary: created, qc: qcWorkbasket } = await createPrimaryWithQc({
      firmId: req.user?.firmId,
      name,
      managerId: req.body?.managerId || null,
    });

    return res.status(201).json({
      success: true,
      data: created,
      qcWorkbasket,
      warnings: ['No users assigned to this workbasket'],
      message: 'Workbasket created',
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to create workbasket' });
  }
};

const getCoreWork = async (req, res) => {
  try {
    const teamIds = Array.isArray(req.user?.teamIds) && req.user.teamIds.length > 0
      ? req.user.teamIds
      : (req.user?.teamId ? [req.user.teamId] : []);

    const workbaskets = await Team.find({
      _id: { $in: teamIds },
      firmId: req.user?.firmId,
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
    const workbasket = await Team.findOne({ _id: workbasketId, firmId: req.user?.firmId });
    if (!workbasket) return res.status(404).json({ success: false, message: 'Workbasket not found' });

    const duplicate = await Team.findOne({
      _id: { $ne: workbasket._id },
      firmId: req.user?.firmId,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (duplicate) return res.status(409).json({ success: false, message: 'Workbasket already exists' });

    workbasket.name = name;
    await workbasket.save();
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
    const workbasket = await Team.findOne({ _id: workbasketId, firmId: req.user?.firmId });
    if (!workbasket) return res.status(404).json({ success: false, message: 'Workbasket not found' });

    workbasket.isActive = isActive;
    await workbasket.save();

    if (!isActive) {
      await User.updateMany(
        { firmId: req.user?.firmId, teamIds: workbasket._id },
        { $pull: { teamIds: workbasket._id } },
      );
      const usersWithoutTeam = await User.find({
        firmId: req.user?.firmId,
        status: { $ne: 'deleted' },
        $or: [
          { teamIds: { $exists: false } },
          { teamIds: { $size: 0 } },
        ],
      }).select('_id').lean();
      if (usersWithoutTeam.length > 0) {
        const fallback = await Team.findOne({ firmId: req.user?.firmId, isActive: true }).select('_id').lean();
        if (fallback?._id) {
          await User.updateMany(
            { _id: { $in: usersWithoutTeam.map((entry) => entry._id) } },
            { $set: { teamId: fallback._id, teamIds: [fallback._id] } },
          );
        }
      }
      await User.updateMany(
        { firmId: req.user?.firmId, teamId: workbasket._id },
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

    const user = await User.findOne({ xID, firmId: req.user?.firmId, status: { $ne: 'deleted' } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const requirePrimary = user.status === 'active' && String(user.role || '').toUpperCase() !== 'SUPER_ADMIN';
    if (requirePrimary && normalizedTeamIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one PRIMARY workbasket is required for active users' });
    }

    const teams = await resolveFirmScopedTeams({ firmId: req.user?.firmId, teamIds: normalizedTeamIds });
    const membership = normalizeMembership({
      role: user.role,
      teams,
      qcExplicitTeamIds: user.qcExplicitTeamIds || [],
      requirePrimary,
    });

    user.teamIds = membership.teamIds;
    user.teamId = membership.teamId;
    user.qcExplicitTeamIds = membership.qcExplicitTeamIds;
    await user.save();

    return res.json({ success: true, message: 'User workbaskets updated', data: mapUserResponse(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update user workbaskets' });
  }
};

const addQcMember = async (req, res) => {
  try {
    const { workbasketId } = req.params;
    const { userId } = req.body || {};
    if (!isValidObjectId(workbasketId) || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const qcWorkbasket = await Team.findOne({
      _id: workbasketId,
      firmId: req.user?.firmId,
      type: 'QC',
      parentWorkbasketId: { $ne: null },
    }).lean();
    if (!qcWorkbasket) return res.status(404).json({ success: false, message: 'QC workbasket not found' });

    const actorRole = String(req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'PRIMARY_ADMIN'].includes(actorRole)) {
      const parent = await Team.findOne({ _id: qcWorkbasket.parentWorkbasketId, firmId: req.user?.firmId }).lean();
      const isManager = parent?.managerId && String(parent.managerId) === String(req.user?._id);
      if (!isManager) return res.status(403).json({ success: false, message: 'Not allowed to add QC members' });
    }

    const user = await User.findOne({ _id: userId, firmId: req.user?.firmId, status: { $ne: 'deleted' } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await User.updateOne({ _id: user._id }, { $addToSet: { teamIds: qcWorkbasket._id, qcExplicitTeamIds: qcWorkbasket._id } });
    return res.json({ success: true, message: 'QC member added' });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to add QC member' });
  }
};

module.exports = {
  listWorkbaskets,
  createWorkbasket,
  getCoreWork,
  renameWorkbasket,
  toggleWorkbasketStatus,
  updateUserWorkbaskets,
  addQcMember,
};
