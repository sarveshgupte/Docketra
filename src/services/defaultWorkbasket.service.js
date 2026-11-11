const Team = require('../models/Team.model');

const DEFAULT_PRIMARY_WORKBASKET_NAME = 'Default Workbasket';

async function ensureDefaultWorkbasketForFirm(firmId, { session } = {}) {
  if (!firmId) return null;

  const existingPrimary = await Team.findOne({
    firmId,
    type: 'PRIMARY',
  }).session(session || null);

  if (existingPrimary) return existingPrimary;

  const [createdPrimary] = await Team.create([{
    firmId,
    name: DEFAULT_PRIMARY_WORKBASKET_NAME,
    isActive: true,
    type: 'PRIMARY',
    parentWorkbasketId: null,
  }], session ? { session } : undefined);

  await Team.findOneAndUpdate(
    { firmId, type: 'QC', parentWorkbasketId: createdPrimary._id },
    {
      $setOnInsert: {
        firmId,
        name: `${DEFAULT_PRIMARY_WORKBASKET_NAME} - QC`,
        isActive: true,
        type: 'QC',
        parentWorkbasketId: createdPrimary._id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, session: session || undefined },
  );

  return createdPrimary;
}

module.exports = {
  DEFAULT_PRIMARY_WORKBASKET_NAME,
  ensureDefaultWorkbasketForFirm,
};
