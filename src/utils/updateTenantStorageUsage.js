const TenantStorageUsage = require('../models/TenantStorageUsage.model');

const updateTenantStorageUsage = async (tenantId, bytesDelta) => {
  const delta = Number(bytesDelta) || 0;
  if (!tenantId || !Number.isFinite(delta) || delta === 0) {
    return null;
  }

  return TenantStorageUsage.findOneAndUpdate(
    { tenantId: String(tenantId) },
    [
      {
        $set: {
          tenantId: { $ifNull: ['$tenantId', String(tenantId)] },
          totalBytes: {
            $max: [0, { $add: [{ $ifNull: ['$totalBytes', 0] }, delta] }],
          },
          lastUpdatedAt: new Date(),
        },
      },
    ],
    { upsert: true, returnDocument: 'after' }
  );
};

module.exports = {
  updateTenantStorageUsage,
};
