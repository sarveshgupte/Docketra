const Team = require('../models/Team.model');
const User = require('../models/User.model');
const { mapUserResponse } = require('../mappers/user.mapper');

const buildWorkbasketWarnings = async (firmId, workbasketIds = []) => {
  if (!firmId || workbasketIds.length === 0) return {};
  const counts = await Promise.all(workbasketIds.map((id) => User.countDocuments({
    firmId,
    status: { $ne: 'deleted' },
    isActive: true,
    teamIds: id,
  })));
  return Object.fromEntries(
    workbasketIds.map((id, index) => [
      String(id),
      Number(counts[index] || 0) === 0 ? ['No users assigned to this workbasket'] : [],
    ]),
  );
};

const listWorkbaskets = async (req, res) => {
  try {
    const includeInactive = String(req.query?.includeInactive || '').toLowerCase() === 'true';
    const query = { firmId: req.user?.firmId };
    if (!includeInactive) query.isActive = true;

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

    const existing = await Team.findOne({ firmId: req.user?.firmId, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (existing) return res.status(409).json({ success: false, message: 'Workbasket already exists' });

    const created = await Team.create({
      firmId: req.user?.firmId,
      name,
      isActive: true,
      type: 'PRIMARY',
      parentWorkbasketId: null,
    });
    const qcWorkbasket = await Team.create({
      firmId: req.user?.firmId,
      name: `${name} - QC`,
      isActive: true,
      type: 'QC',
      parentWorkbasketId: created._id,
    });

    return res.status(201).json({
      success: true,
      data: created,
      qcWorkbasket,
      warnings: ['No users assigned to this workbasket'],
      message: 'Workbasket created',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create workbasket' });
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
    const normalizedTeamIds = Array.isArray(req.body?.teamIds)
      ? [...new Set(req.body.teamIds.map((entry) => String(entry || '').trim()).filter(Boolean))]
      : [];

    if (normalizedTeamIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one workbasket is required' });
    }

    const user = await User.findOne({ xID, firmId: req.user?.firmId, status: { $ne: 'deleted' } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const teams = await Team.find({
      _id: { $in: normalizedTeamIds },
      firmId: req.user?.firmId,
      isActive: true,
    }).select('_id type').lean();

    if (teams.length !== normalizedTeamIds.length) {
      return res.status(400).json({ success: false, message: 'One or more selected workbaskets are invalid or inactive' });
    }

    const resolvedTeamIds = teams.map((entry) => entry._id);
    const primaryTeamIds = teams
      .filter((entry) => String(entry?.type || 'PRIMARY').toUpperCase() !== 'QC')
      .map((entry) => entry._id);

    if (primaryTeamIds.length > 0) {
      const linkedQcTeams = await Team.find({
        firmId: req.user?.firmId,
        isActive: true,
        type: 'QC',
        parentWorkbasketId: { $in: primaryTeamIds },
      }).select('_id').lean();

      for (const qcTeam of linkedQcTeams) {
        resolvedTeamIds.push(qcTeam._id);
      }
    }

    user.teamIds = [...new Set(resolvedTeamIds.map((entry) => String(entry)))];
    user.teamId = user.teamIds[0] || null;
    await user.save();

    return res.json({ success: true, message: 'User workbaskets updated', data: mapUserResponse(user) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update user workbaskets' });
  }
};

module.exports = {
  listWorkbaskets,
  createWorkbasket,
  getCoreWork,
  renameWorkbasket,
  toggleWorkbasketStatus,
  updateUserWorkbaskets,
};
