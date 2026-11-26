const Team = require('../models/Team.model');
const { ensureLinkedQcWorkbasket } = require('./workbasketGuardrails.service');

const DEFAULT_PRIMARY_WORKBASKET_NAME = 'Default Workbasket';

async function ensureDefaultWorkbasketForFirm(firmId, { session } = {}) {
  if (!firmId) return null;

  const existingPrimary = await Team.findOne({
    firmId,
    type: 'PRIMARY',
  }).session(session || null);

  if (existingPrimary) {
    await ensureLinkedQcWorkbasket({ firmId, primaryWorkbasket: existingPrimary, session });
    return existingPrimary;
  }

  const [createdPrimary] = await Team.create([{
    firmId,
    name: DEFAULT_PRIMARY_WORKBASKET_NAME,
    isActive: true,
    type: 'PRIMARY',
    parentWorkbasketId: null,
  }], session ? { session } : undefined);

  await ensureLinkedQcWorkbasket({ firmId, primaryWorkbasket: createdPrimary, session });

  return createdPrimary;
}

module.exports = {
  DEFAULT_PRIMARY_WORKBASKET_NAME,
  ensureDefaultWorkbasketForFirm,
};
