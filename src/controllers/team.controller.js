const mongoose = require('mongoose');
const Team = require('../models/Team.model');
const User = require('../models/User.model');
const { assertPrimaryAdmin } = require('../utils/hierarchy.utils');
const { logAuditEvent } = require('../services/adminActionAudit.service');

const ensureSameFirm = (doc, firmId) => doc && String(doc.firmId) === String(firmId);

const listTeams = async (req, res) => {
  try {
    const teams = await Team.find({ firmId: req.user?.firmId, isActive: true }).sort({ name: 1 }).lean();
    return res.json({ success: true, data: teams });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch teams' });
  }
};

/**
 * Link a user to a team's teamIds array (idempotent).
 * Preserves existing teamId (primary) if already set.
 */
const linkUserToTeam = async (user, teamId) => {
  const teamIdStr = String(teamId);
  const alreadyLinked = (user.teamIds || []).some((id) => String(id) === teamIdStr);
  if (!alreadyLinked) {
    user.teamIds = [...(user.teamIds || []), teamId];
  }
  if (!user.teamId) {
    user.teamId = teamId;
  }
  await user.save();
};

const createTeam = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);
    const name = String(req.body?.name || '').trim();
    const managerId = req.body?.managerId || null;
    if (!name) return res.status(400).json({ success: false, message: 'Team name is required' });

    // PRIMARY workbaskets auto-get exactly one linked QC workbasket (product rule 4).
    const team = await Team.create({ name, firmId: req.user.firmId, managerId, type: 'PRIMARY' });

    const qcTeam = await Team.create({
      name: `${name} – QC`,
      firmId: req.user.firmId,
      type: 'QC',
      parentWorkbasketId: team._id,
      managerId: managerId || null,
    });

    // Product rule 6: manager of PRIMARY is auto-linked to QC workbasket.
    if (managerId) {
      const manager = await User.findOne({ _id: managerId, firmId: req.user.firmId, status: { $ne: 'deleted' } });
      if (manager) {
        await linkUserToTeam(manager, qcTeam._id);
      }
    }

    await logAuditEvent({
      firmId: req.user?.firmId,
      actorId: req.user?._id,
      targetId: team._id,
      action: 'WORKBASKET_CREATED',
      metadata: { teamId: String(team._id), qcTeamId: String(qcTeam._id), managerId },
    });

    return res.status(201).json({ success: true, data: { team, qcTeam } });
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

    const prevManagerId = team.managerId ? String(team.managerId) : null;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'managerId')) team.managerId = req.body.managerId || null;

    if (team.managerId) {
      const manager = await User.findOne({ _id: team.managerId, firmId: req.user.firmId, status: { $ne: 'deleted' } });
      if (!manager) {
        return res.status(400).json({ success: false, message: 'Manager must belong to the same firm' });
      }

      // Product rule 6: new manager auto-linked to this workbasket's QC child.
      const newManagerId = String(team.managerId);
      if (team.type === 'PRIMARY' && newManagerId !== prevManagerId) {
        const qcTeam = await Team.findOne({ firmId: req.user.firmId, type: 'QC', parentWorkbasketId: team._id, isActive: true });
        if (qcTeam) {
          await linkUserToTeam(manager, qcTeam._id);
        }
      }
    }

    await team.save();
    await logAuditEvent({
      firmId: req.user?.firmId,
      actorId: req.user?._id,
      targetId: team._id,
      action: 'HIERARCHY_UPDATED',
      metadata: { managerId: team.managerId },
    });
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

    await linkUserToTeam(user, team._id);
    await logAuditEvent({
      firmId: actor?.firmId,
      actorId: actor?._id,
      targetId: user._id,
      action: 'HIERARCHY_UPDATED',
      metadata: { teamId: team._id },
    });

    return res.json({ success: true, data: { userId: user._id, teamId: team._id } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to assign user to team' });
  }
};

/**
 * Add a user to a QC workbasket.
 * Product rule 7: admin/primary-admin/manager can add users to the QC workbasket.
 * POST /api/teams/:id/qc/add-user
 */
const addUserToQcWorkbasket = async (req, res) => {
  try {
    const actor = req.user;
    const firmId = actor?.firmId;

    const qcTeam = await Team.findOne({ _id: req.params.id, firmId, type: 'QC', isActive: true });
    if (!qcTeam) return res.status(404).json({ success: false, message: 'QC workbasket not found' });

    // Only admin/primary-admin or the manager of the parent PRIMARY WB may add users.
    const isAdminActor = ['PRIMARY_ADMIN', 'ADMIN'].includes(actor?.role);
    if (!isAdminActor) {
      const parentTeam = await Team.findOne({ _id: qcTeam.parentWorkbasketId, firmId });
      const isManager = parentTeam && String(parentTeam.managerId) === String(actor?._id);
      if (!isManager) {
        return res.status(403).json({ success: false, message: 'Only admins or the PRIMARY workbasket manager may add users to the QC workbasket' });
      }
    }

    const user = await User.findOne({ _id: req.body?.userId, firmId, status: { $ne: 'deleted' } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found in firm' });

    await linkUserToTeam(user, qcTeam._id);
    await logAuditEvent({
      firmId,
      actorId: actor?._id,
      targetId: user._id,
      action: 'HIERARCHY_UPDATED',
      metadata: { qcTeamId: qcTeam._id },
    });

    return res.json({ success: true, data: { userId: user._id, qcTeamId: qcTeam._id } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to add user to QC workbasket' });
  }
};

module.exports = {
  listTeams,
  createTeam,
  updateTeam,
  assignUserToTeam,
  addUserToQcWorkbasket,
};
