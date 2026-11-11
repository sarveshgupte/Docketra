const mongoose = require('mongoose');
const Team = require('../models/Team.model');
const User = require('../models/User.model');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

async function createPrimaryWithQc({ firmId, name, managerId = null, candidateFirmIds = [] }) {
  if (!name || !String(name).trim()) throw new Error('Workbasket name is required');
  if (managerId && !isValidObjectId(managerId)) throw new Error('Invalid managerId');
  if (!firmId) throw new Error('Firm context is required');

  const trimmedName = String(name).trim();
  const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const allFirmIds = [...new Set([String(firmId), ...(candidateFirmIds || []).map(String)].filter(Boolean))];
  const objectIds = allFirmIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  const firmFilter = allFirmIds.length > 1 ? { $in: [...allFirmIds, ...objectIds] } : firmId;

  // Check if primary or QC with this name already exists for this firm
  const existing = await Team.findOne({
    firmId: firmFilter,
    $or: [
      { name: new RegExp(`^${escapedName}$`, 'i') },
      { name: new RegExp(`^${escapedName}\\s*[-—–]\\s*QC$`, 'i') },
    ],
  });
  if (existing) {
    const error = new Error('A workbasket with this name or linked QC already exists');
    error.statusCode = 409;
    throw error;
  }

  const session = await mongoose.startSession();
  let primary;
  let qc;
  try {
    const transactionSupported = typeof session.withTransaction === 'function';
    const worker = async (opts = {}) => {
      try {
        [primary] = await Team.create(
          [{ firmId, name: trimmedName, managerId: managerId || null, type: 'PRIMARY', parentWorkbasketId: null, isActive: true }],
          opts.session ? opts : undefined,
        );
      } catch (err) {
        if (err.code === 11000 || err.message?.includes('duplicate key') || err.message?.includes('E11000')) {
          const dupErr = new Error('A workbasket with this name already exists');
          dupErr.statusCode = 409;
          throw dupErr;
        }
        throw err;
      }

      try {
        [qc] = await Team.create(
          [{ firmId, name: `${trimmedName} — QC`, type: 'QC', parentWorkbasketId: primary._id, isActive: true }],
          opts.session ? opts : undefined,
        );
      } catch (error) {
        if (!opts.session && primary?._id) {
          try {
            await Team.deleteOne({ _id: primary._id, firmId });
          } catch (_) {}
        }
        if (error.code === 11000 || error.message?.includes('duplicate key') || error.message?.includes('E11000')) {
          const dupErr = new Error('A linked QC workbasket with this name already exists');
          dupErr.statusCode = 409;
          throw dupErr;
        }
        throw error;
      }

      if (managerId) {
        await User.updateOne(
          { _id: managerId, firmId: firmFilter, status: { $ne: 'deleted' } },
          { $addToSet: { teamIds: qc._id } },
          opts.session ? { session: opts.session } : undefined,
        );
      }
    };

    if (transactionSupported) {
      try {
        await session.withTransaction(async () => worker({ session }));
      } catch (error) {
        const msg = String(error?.message || '').toLowerCase();
        const unsupported = msg.includes('transaction') || msg.includes('replica set') || msg.includes('standalone') || msg.includes('topology');
        if (!unsupported) {
          if (error.code === 11000 || error.message?.includes('duplicate key') || error.message?.includes('E11000')) {
            error.statusCode = 409;
          }
          throw error;
        }
        primary = null;
        qc = null;
        await worker();
      }
    } else {
      await worker();
    }
  } catch (outerErr) {
    if (outerErr.code === 11000 || outerErr.message?.includes('duplicate key') || outerErr.message?.includes('E11000')) {
      outerErr.statusCode = 409;
    }
    throw outerErr;
  } finally {
    await session.endSession();
  }
  return { primary, qc };
}

module.exports = { isValidObjectId, createPrimaryWithQc };
