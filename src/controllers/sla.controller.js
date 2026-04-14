const mongoose = require('mongoose');
const Team = require('../models/Team.model');
const SlaRule = require('../models/SlaRule.model');

const normalizeOptionalString = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const parseRulePayload = (payload = {}) => ({
  category: normalizeOptionalString(payload.category),
  subcategory: normalizeOptionalString(payload.subcategory),
  workbasketId: normalizeOptionalString(payload.workbasketId),
  slaHours: Number(payload.slaHours),
  isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
});

const mapRules = async (firmId, rules) => {
  const workbasketIds = [...new Set(rules.map((rule) => String(rule.workbasketId || '').trim()).filter(Boolean))]
    .filter((value) => mongoose.Types.ObjectId.isValid(value));
  const workbaskets = workbasketIds.length > 0
    ? await Team.find({ _id: { $in: workbasketIds }, firmId }).select('_id name').lean()
    : [];
  const workbasketMap = new Map(workbaskets.map((team) => [String(team._id), team.name]));

  return rules.map((rule) => ({
    ...rule,
    workbasketName: rule.workbasketId ? (workbasketMap.get(String(rule.workbasketId)) || null) : null,
  }));
};

async function listRules(req, res) {
  try {
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const query = { firmId: req.user.firmId };
    if (!includeInactive) query.isActive = true;

    const rules = await SlaRule.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
    const data = await mapRules(req.user.firmId, rules);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load SLA rules' });
  }
}

async function saveRule(req, res) {
  try {
    const payload = parseRulePayload(req.body || {});
    if (!Number.isFinite(payload.slaHours) || payload.slaHours <= 0) {
      return res.status(400).json({ success: false, message: 'slaHours must be a positive number' });
    }

    if (!payload.category && !payload.subcategory && !payload.workbasketId) {
      payload.category = null;
      payload.subcategory = null;
      payload.workbasketId = null;
    }

    if (payload.workbasketId) {
      if (!mongoose.Types.ObjectId.isValid(payload.workbasketId)) {
        return res.status(400).json({ success: false, message: 'workbasketId must be a valid workbasket id' });
      }
      const workbasket = await Team.findOne({ _id: payload.workbasketId, firmId: req.user.firmId }).select('_id').lean();
      if (!workbasket) {
        return res.status(404).json({ success: false, message: 'Workbasket not found' });
      }
    }

    const ruleId = String(req.body?._id || req.body?.id || '').trim();
    let rule;
    if (ruleId) {
      rule = await SlaRule.findOneAndUpdate(
        { _id: ruleId, firmId: req.user.firmId },
        { $set: payload },
        { new: true },
      ).lean();
      if (!rule) {
        return res.status(404).json({ success: false, message: 'SLA rule not found' });
      }
    } else {
      rule = await SlaRule.create({ firmId: req.user.firmId, ...payload });
      rule = rule.toObject();
    }

    const [mappedRule] = await mapRules(req.user.firmId, [rule]);
    return res.status(ruleId ? 200 : 201).json({
      success: true,
      data: mappedRule,
      message: ruleId ? 'SLA rule updated' : 'SLA rule created',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save SLA rule' });
  }
}

async function deleteRule(req, res) {
  try {
    const deleted = await SlaRule.findOneAndDelete({ _id: req.params.ruleId, firmId: req.user.firmId }).lean();
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'SLA rule not found' });
    }
    return res.json({ success: true, message: 'SLA rule deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete SLA rule' });
  }
}

module.exports = {
  deleteRule,
  listRules,
  saveRule,
};
