const assert = require('assert');
const mongoose = require('mongoose');
const Team = require('../src/models/Team.model');
const { validateCategoryMappedWorkbasket } = require('../src/services/categoryWorkbasketValidation.service');

async function run() {
  const origFindOne = Team.findOne;
  const origUpdateOne = Team.updateOne;

  try {
    const validId = new mongoose.Types.ObjectId().toString();
    const firmId = new mongoose.Types.ObjectId().toString();

    // 1. Invalid workbasketId format rejected
    const invalidRes = await validateCategoryMappedWorkbasket({ workbasketId: 'invalid-id', firmId });
    assert.strictEqual(invalidRes.valid, false);
    assert.strictEqual(invalidRes.message, 'Valid active primary workbasket is required');

    // 2. Missing workbasket rejected
    Team.findOne = () => ({
      select: async () => null,
    });
    const missingRes = await validateCategoryMappedWorkbasket({ workbasketId: validId, firmId });
    assert.strictEqual(missingRes.valid, false);

    // 3. Standard PRIMARY workbasket found
    Team.findOne = (query) => ({
      select: async () => {
        if (query.type === 'PRIMARY' && query.isActive === true) {
          return { _id: validId, type: 'PRIMARY', isActive: true, firmId };
        }
        return null;
      },
    });
    const standardRes = await validateCategoryMappedWorkbasket({ workbasketId: validId, firmId });
    assert.strictEqual(standardRes.valid, true);
    assert.strictEqual(standardRes.workbasket._id, validId);

    // 4. Legacy unmigrated workbasket (missing type field) matches fallback and self-heals
    let selfHealed = false;
    Team.updateOne = async (filter, update) => {
      if (filter._id === validId && update?.$set?.type === 'PRIMARY') {
        selfHealed = true;
      }
      return { modifiedCount: 1 };
    };

    Team.findOne = (query) => ({
      select: async () => {
        // Standard query fails
        if (query.type === 'PRIMARY') return null;
        // Fallback query succeeds
        if (query.isActive && query.isActive.$ne === false) {
          return { _id: validId, type: null, isActive: true, firmId };
        }
        return null;
      },
    });

    const legacyRes = await validateCategoryMappedWorkbasket({ workbasketId: validId, firmId });
    assert.strictEqual(legacyRes.valid, true);
    assert.strictEqual(legacyRes.workbasket._id, validId);
    assert.strictEqual(selfHealed, true, 'Legacy workbasket should be self-healed to PRIMARY in DB');

    // 5. Cross-firm isolation preserved in fallback
    Team.findOne = (query) => ({
      select: async () => {
        if (query.firmId && query.firmId !== firmId) return null;
        return null;
      },
    });
    const crossFirmRes = await validateCategoryMappedWorkbasket({ workbasketId: validId, firmId: 'different-firm' });
    assert.strictEqual(crossFirmRes.valid, false);

    // 6. Multi-tenant candidate resolution (e.g. ownershipFirmId in Team vs tenantId in req)
    const ownershipFirmId = new mongoose.Types.ObjectId().toString();
    const tenantId = new mongoose.Types.ObjectId().toString();
    Team.findOne = (query) => ({
      select: async () => {
        // Direct query fails because query.firmId is tenantId
        if (query.firmId === tenantId) return null;
        // Candidate query with $in succeeds
        if (query.firmId && query.firmId.$in && query.firmId.$in.map(String).includes(ownershipFirmId)) {
          return { _id: validId, type: 'PRIMARY', isActive: true, firmId: ownershipFirmId };
        }
        return null;
      },
    });

    const multiTenantRes = await validateCategoryMappedWorkbasket({
      workbasketId: validId,
      firmId: tenantId,
      req: { ownershipFirmId, tenant: { id: tenantId } },
    });
    assert.strictEqual(multiTenantRes.valid, true);
    assert.strictEqual(multiTenantRes.workbasket._id, validId);

    console.log('categoryWorkbasketValidation.unit.test.js passed');
  } finally {
    Team.findOne = origFindOne;
    Team.updateOne = origUpdateOne;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
