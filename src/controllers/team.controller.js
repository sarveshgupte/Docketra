const Team = require('../models/Team.model');
const User = require('../models/User.model');
const { assertPrimaryAdmin } = require('../utils/hierarchy.utils');
const { logAuditEvent } = require('../services/adminActionAudit.service');
const { createPrimaryWithQc, isValidObjectId, isDuplicateKeyError } = require('../services/workbasketGuardrails.service');

const resolveCreateTeamError = (error) => {
  if (isDuplicateKeyError(error)) {
    return { statusCode: 409, message: error.message || 'A workbasket with this name already exists for this firm' };
  }
  if (/Only PRIMARY_ADMIN/i.test(String(error?.message || ''))) {
    return { statusCode: 403, message: error.message };
  }
  const statusCode = error?.statusCode || 500;
  return {
    statusCode,
    message: statusCode >= 500 ? 'Failed to create team' : (error?.message || 'Failed to create team'),
  };
};

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
    const effectiveFirmId = req.user?.firmId || req.ownershipFirmId || req.firmId || req.tenant?.id;
    if (!effectiveFirmId) {
      return res.status(400).json({ success: false, message: 'Firm context is required' });
    }
    const { primary: team, qc: qcWorkbasket } = await createPrimaryWithQc({
      firmId: effectiveFirmId,
      name: req.body?.name,
      managerId: req.body?.managerId || null,
    });
    return res.status(201).json({ success: true, data: team, qcWorkbasket });
  } catch (error) {
    const { statusCode, message } = resolveCreateTeamError(error);
    return res.status(statusCode).json({ success: false, message });
  }
};

const updateTeam = async (req, res) => {
  try {
    assertPrimaryAdmin(req.user);
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid team id' });
    const team = await Team.findOne({ _id: req.params.id, firmId: req.user.firmId });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    if (req.body?.name) team.name = String(req.body.name).trim();
    const previousManagerId = team.managerId ? String(team.managerId) : null;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'managerId')) {
      if (req.body.managerId && !isValidObjectId(req.body.managerId)) return res.status(400).json({ success: false, message: 'Invalid managerId' });
      team.managerId = req.body.managerId || null;
    }

    if (team.managerId) {
      const manager = await User.findOne({ _id: team.managerId, firmId: req.user.firmId, status: { $ne: 'deleted' } });
      if (!manager) {
        return res.status(400).json({ success: false, message: 'Manager must belong to same firm' });
      }
    }

    await team.save();
    if (team.type === 'PRIMARY' && Object.prototype.hasOwnProperty.call(req.body || {}, 'managerId')) {
      const qcTeam = await Team.findOne({ firmId: req.user.firmId, type: 'QC', parentWorkbasketId: team._id });
      if (qcTeam) {
        if (team.managerId) {
          await User.updateOne({ _id: team.managerId, firmId: req.user.firmId }, { $addToSet: { teamIds: qcTeam._id } });
        }
        if (previousManagerId && (!team.managerId || String(team.managerId) !== previousManagerId)) {
          const oldManager = await User.findOne({ _id: previousManagerId, firmId: req.user.firmId }).lean();
          if (oldManager) {
            const explicitSet = oldManager.qcExplicitTeamIds || [];
            const explicitRetained = explicitSet.map(String).includes(String(qcTeam._id));
            if (!explicitRetained) {
              await User.updateOne({ _id: previousManagerId }, { $pull: { teamIds: qcTeam._id } });
            }
          }
        }
      }
    }
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
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.body?.userId)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const team = await Team.findOne({ _id: req.params.id, firmId: actor.firmId });
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const user = await User.findOne({ _id: req.body?.userId, firmId: actor.firmId, status: { $ne: 'deleted' } });
    if (!user || !ensureSameFirm(user, actor.firmId)) {
      return res.status(404).json({ success: false, message: 'User not found in firm' });
    }

    user.teamId = team._id;
    await user.save();
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

module.exports = {
  listTeams,
  createTeam,
  updateTeam,
  assignUserToTeam,
};
