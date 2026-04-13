const mongoose = require('mongoose');
const Team = require('../models/Team.model');
const User = require('../models/User.model');
const { isAdminRole, isManagerRole } = require('../utils/role.utils');
const { assertPrimaryAdmin } = require('../utils/hierarchy.utils');
const log = require('../utils/log');

const ensureSameFirm = (doc, firmId) => doc && String(doc.firmId) === String(firmId);

const listTeams = async (req, res) => {
  try {
    const teams = await Team.find({ firmId: req.user?.firmId, isActive: true }).sort({ name: 1 }).lean();
    return res.json({ success: true, data: teams });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch teams' });
  }
};

const createTeam = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);
    const name = String(req.body?.name || '').trim();
    const managerId = req.body?.managerId || null;
    if (!name) return res.status(400).json({ success: false, message: 'Team name is required' });

    const team = await Team.create({ name, firmId: req.user.firmId, managerId });
    return res.status(201).json({ success: true, data: team });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create team' });
  }
};

const updateTeam = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);
    const team = await Team.findOne({ _id: req.params.id, firmId: req.user.firmId });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    if (req.body?.name) team.name = String(req.body.name).trim();
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'managerId')) team.managerId = req.body.managerId || null;

    if (team.managerId) {
      const manager = await User.findOne({ _id: team.managerId, firmId: req.user.firmId, teamId: team._id, status: { $ne: 'deleted' } });
      if (!manager) {
        return res.status(400).json({ success: false, message: 'Manager must belong to same team and firm' });
      }
    }

    await team.save();
    log.info('HIERARCHY_UPDATED', { actorId: req.user?._id, targetId: team._id, changes: { managerId: team.managerId } });
    return res.json({ success: true, data: team });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to update team' });
  }
};

const assignUserToTeam = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);
    const actor = req.user;
    const team = await Team.findOne({ _id: req.params.id, firmId: actor.firmId });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const user = await User.findOne({ _id: req.body?.userId, status: { $ne: 'deleted' } });
    if (!user || !ensureSameFirm(user, actor.firmId)) {
      return res.status(404).json({ success: false, message: 'User not found in firm' });
    }

    if (isManagerRole(actor.role)) {
      if (String(actor.teamId || '') !== String(team._id)) {
        return res.status(403).json({ success: false, message: 'Managers can only assign users within own team' });
      }
      if (String(user.teamId || '') !== String(actor.teamId || '')) {
        return res.status(403).json({ success: false, message: 'Managers cannot perform cross-team assignments' });
      }
    }

    if (!isAdminRole(actor.role) && !isManagerRole(actor.role)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    user.teamId = team._id;
    await user.save();
    log.info('HIERARCHY_UPDATED', { actorId: actor?._id, targetId: user._id, changes: { teamId: team._id } });

    return res.json({ success: true, data: { userId: user._id, teamId: team._id } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to assign user to team' });
  }
};

module.exports = {
  listTeams,
  createTeam,
  updateTeam,
  assignUserToTeam,
};
