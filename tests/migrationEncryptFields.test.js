const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createMongoMemoryOrNull } = require('./utils/mongoMemory');
const { migrateCollection } = require('../scripts/migrations/encrypt_existing_plaintext_fields');
const Client = require('../src/models/Client.model');
const Case = require('../src/models/Case.model');
const { encrypt, ensureTenantKey } = require('../src/security/encryption.service');
const { looksEncrypted } = require('../src/security/encryption.utils');

let mongoServer;

async function setupDatabase() {
  process.env.MASTER_ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex');
  mongoServer = await createMongoMemoryOrNull(
    () => MongoMemoryServer.create(),
    'Skipping DB-dependent migration tests (Mongo binary unavailable)'
  );
  if (!mongoServer) {
    return false;
  }

  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  return true;
}

async function teardownDatabase() {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

async function testClientMigration() {
  console.log('Testing Client migration...');
  const firmId = new mongoose.Types.ObjectId();
  await ensureTenantKey(firmId.toString());

  // Insert a client without encryption directly to DB
  const rawClient = {
    _id: new mongoose.Types.ObjectId(),
    firmId,
    businessName: 'Acme Corp',
    businessEmail: ' TEST@ACME.COM ',
    primaryContactNumber: ' 1234567890 ',
    businessAddress: '123 Main St',
    createdByXid: 'X000001',
    isActive: true,
    status: 'active',
    clientId: 'C000001'
  };

  const rawDeletedClient = {
    _id: new mongoose.Types.ObjectId(),
    firmId,
    businessName: 'Deleted Corp',
    businessEmail: ' deleted@ACME.COM ',
    primaryContactNumber: ' 0987654321 ',
    businessAddress: '123 Deleted St',
    createdByXid: 'X000001',
    isActive: false,
    status: 'inactive',
    clientId: 'C000002',
    deletedAt: new Date()
  };

  await Client.collection.insertMany([rawClient, rawDeletedClient]);

  await migrateCollection(Client, ['primaryContactNumber', 'businessEmail']);

  const migratedClient = await Client.collection.findOne({ _id: rawClient._id });
  assert.ok(looksEncrypted(migratedClient.businessEmail), 'Business email should be encrypted');
  assert.ok(looksEncrypted(migratedClient.primaryContactNumber), 'Primary contact should be encrypted');

  const migratedDeletedClient = await Client.collection.findOne({ _id: rawDeletedClient._id });
  assert.ok(looksEncrypted(migratedDeletedClient.businessEmail), 'Deleted client email should be encrypted');
  assert.ok(looksEncrypted(migratedDeletedClient.primaryContactNumber), 'Deleted client contact should be encrypted');

  console.log('Client migration tests passed.');
}

async function run() {
  try {
    const isDbReady = await setupDatabase();
    if (!isDbReady) {
      return;
    }
    await testClientMigration();
    console.log('All migration tests passed.');
  } catch (err) {
    console.error('Migration test failed:', err);
    process.exit(1);
  } finally {
    await teardownDatabase();
  }
}

run();
