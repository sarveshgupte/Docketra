const TenantStorageUsage = require('../models/TenantStorageUsage.model');

const updateTenantStorageUsage = async (tenantId, bytesDelta) => {
  const delta = Number(bytesDelta) || 0;
  if (!tenantId || !Number.isFinite(delta) || delta === 0) {
    return null;
  }

  return TenantStorageUsage.findOneAndUpdate(
    { tenantId: String(tenantId) },
    {
      $inc: { totalBytes: delta },
      $set: { lastUpdatedAt: new Date() },
      $setOnInsert: { tenantId: String(tenantId) },
    },
    { upsert: true, new: true }
  );
};

module.exports = {
  updateTenantStorageUsage,
};
