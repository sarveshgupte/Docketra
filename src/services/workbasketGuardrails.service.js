const mongoose = require('mongoose');
const Team = require('../models/Team.model');
const User = require('../models/User.model');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

async function createPrimaryWithQc({ firmId, name, managerId = null }) {
  if (!name) throw new Error('Workbasket name is required');
  if (managerId && !isValidObjectId(managerId)) throw new Error('Invalid managerId');

  const existing = await Team.findOne({ firmId, name: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (existing) {
    const error = new Error('Workbasket already exists');
    error.statusCode = 409;
    throw error;
  }

  const session = await mongoose.startSession();
  let primary;
  let qc;
  try {
    const transactionSupported = typeof session.withTransaction === 'function';
    const worker = async (opts = {}) => {
      [primary] = await Team.create([{ firmId, name, managerId, type: 'PRIMARY', parentWorkbasketId: null, isActive: true }], opts.session ? opts : undefined);
      try {
        [qc] = await Team.create([{ firmId, name: `${name} — QC`, type: 'QC', parentWorkbasketId: primary._id, isActive: true }], opts.session ? opts : undefined);
      } catch (error) {
        await Team.deleteOne({ _id: primary._id, firmId }, opts.session ? { session: opts.session } : undefined);
        throw error;
      }
      if (managerId) {
        await User.updateOne({ _id: managerId, firmId, status: { $ne: 'deleted' } }, { $addToSet: { teamIds: qc._id } }, opts.session ? { session: opts.session } : undefined);
      }
    };
    if (transactionSupported) {
      try {
        await session.withTransaction(async () => worker({ session }));
      } catch (error) {
        const msg = String(error?.message || '').toLowerCase();
        const unsupported = msg.includes('transaction') || msg.includes('replica set');
        if (!unsupported) throw error;
        primary = null;
        qc = null;
        await worker();
      }
    } else await worker();
  } finally {
    await session.endSession();
  }
  return { primary, qc };
}

module.exports = { isValidObjectId, createPrimaryWithQc };
