#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const direction = (process.argv[2] || 'up').toLowerCase();

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI or MONGO_URI is required');
  process.exit(1);
}

async function up(db) {
  await db.collection('firms').updateMany(
    { plan: { $exists: false } },
    { $set: { plan: 'STARTER' } }
  );
  await db.collection('firms').updateMany(
    { maxUsers: { $exists: false } },
    { $set: { maxUsers: 2 } }
  );
  await db.collection('firms').updateMany(
    { billingStatus: { $exists: false } },
    { $set: { billingStatus: null } }
  );
  await db.collection('enterpriseinquiries').createIndex({ createdAt: -1 }, { name: 'idx_enterprise_inquiries_created_desc' });
  console.log('✓ starter plan fields ensured');
}

async function down(db) {
  await db.collection('firms').updateMany({}, { $unset: { plan: '', maxUsers: '', billingStatus: '' } });
  try { await db.collection('enterpriseinquiries').dropIndex('idx_enterprise_inquiries_created_desc'); } catch (_) {}
  console.log('✓ rollback completed');
}

async function run() {
  await mongoose.connect(MONGO_URI);
  try {
    const db = mongoose.connection.db;
    if (direction === 'down') await down(db);
    else await up(db);
  } finally {
    await mongoose.connection.close();
  }
}

run().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
