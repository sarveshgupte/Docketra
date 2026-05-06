const mongoose = require('mongoose');
const Client = require('../models/Client.model');
const { tenantKeyExists, ensureTenantKey } = require('../security/encryption.service');
const { looksEncrypted } = require('../security/encryption.utils');

async function run() {
  const [firmId, applyFlag] = process.argv.slice(2);
  if (!firmId) throw new Error('Usage: node src/scripts/tenantKeyRepairAudit.js <firmId> [--apply-safe-create]');

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const keyExists = await tenantKeyExists(String(firmId));
  const docs = await Client.find({ firmId }).select('businessEmail primaryContactNumber').lean();
  const hasEncryptedClientFields = docs.some((doc) => looksEncrypted(doc.businessEmail) || looksEncrypted(doc.primaryContactNumber));

  const report = { firmId: String(firmId), keyExists, clientCount: docs.length, hasEncryptedClientFields };

  if (!keyExists && !hasEncryptedClientFields && applyFlag === '--apply-safe-create') {
    await ensureTenantKey(String(firmId));
    report.createdKey = true;
  } else {
    report.createdKey = false;
    if (!keyExists && hasEncryptedClientFields) {
      report.manualRecoveryRequired = true;
      report.message = 'Encrypted client data exists without tenant key; do not auto-create key. Manual recovery/reset required.';
    }
  }

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
