'use strict';

const assert = require('assert');
const { Readable } = require('stream');
const Client = require('../src/models/Client.model');
const { clientProfileStorageService } = require('../src/services/clientProfileStorage.service');
const { StorageProviderFactory } = require('../src/services/storage/StorageProviderFactory');
const { S3Client } = require('@aws-sdk/client-s3');

async function testSensitivePersistenceBlocked() {
  const client = new Client({
    clientId: 'C999001',
    firmId: '507f1f77bcf86cd799439011',
    businessName: 'Test Client',
    businessEmail: 'test@example.com',
    primaryContactNumber: '9999999999',
    PAN: 'ABCDE1234F',
  });

  let blocked = false;
  try {
    await client.validate();
  } catch (error) {
    const messages = [
      error?.message,
      ...(error?.errors ? Object.values(error.errors).map((entry) => entry?.message) : []),
    ]
      .filter(Boolean)
      .join(' | ');
    blocked = messages.includes('BYOS_SENSITIVE_FIELD_PERSISTENCE_BLOCKED:PAN');
  }

  assert.equal(blocked, true, 'PAN persistence must be blocked at schema validation');
}

async function testManagedFallbackReadUsesProfileRef() {
  const originalGetProvider = StorageProviderFactory.getProvider;
  const originalSend = S3Client.prototype.send;
  const originalEnv = {
    bucket: process.env.MANAGED_STORAGE_S3_BUCKET,
    region: process.env.MANAGED_STORAGE_S3_REGION,
    prefix: process.env.MANAGED_STORAGE_S3_PREFIX,
  };

  process.env.MANAGED_STORAGE_S3_BUCKET = 'unit-test-bucket';
  process.env.MANAGED_STORAGE_S3_REGION = 'us-east-1';
  process.env.MANAGED_STORAGE_S3_PREFIX = 'managed';

  StorageProviderFactory.getProvider = async () => ({ providerName: 'google-drive' });
  S3Client.prototype.send = async () => ({
    Body: Readable.from(JSON.stringify({ profile: { identifiers: { pan: 'ABCDE1234F' } } })),
  });

  const client = {
    clientId: 'C999002',
    firmId: '507f1f77bcf86cd799439012',
    profileRef: {
      provider: 'docketra_managed',
      mode: 'managed_fallback',
      objectKey: 'managed/firms/f1/client-profiles/C999002/v1.json',
    },
  };

  const profile = await clientProfileStorageService.getClientProfile({ firmId: client.firmId, client });
  assert.equal(profile.profile.identifiers.pan, 'ABCDE1234F');

  StorageProviderFactory.getProvider = originalGetProvider;
  S3Client.prototype.send = originalSend;
  process.env.MANAGED_STORAGE_S3_BUCKET = originalEnv.bucket;
  process.env.MANAGED_STORAGE_S3_REGION = originalEnv.region;
  process.env.MANAGED_STORAGE_S3_PREFIX = originalEnv.prefix;
}

async function testHydrationBackwardCompatibility() {
  const client = {
    clientId: 'C999003',
    businessName: 'Hydration Co',
    businessEmail: 'ops@hydro.test',
    primaryContactNumber: '11111',
  };
  const profile = {
    profile: {
      identifiers: { pan: 'ABCDE1234F', gstin: '22AAAAA0000A1Z5', tan: 'ABCD12345E', cin: 'L12345' },
      contacts: {
        primaryEmail: 'legal@hydro.test',
        primaryPhone: '22222',
        secondaryPhone: '33333',
        contactPerson: { name: 'Owner', designation: 'Director', phone: '44444', email: 'owner@hydro.test' },
      },
      addresses: { businessAddress: 'Hydration Street' },
      factSheet: { description: 'Migrated data' },
    },
  };

  const hydrated = clientProfileStorageService.hydrateClientWithProfile(client, profile);
  assert.equal(hydrated.PAN, 'ABCDE1234F');
  assert.equal(hydrated.clientFactSheet.description, 'Migrated data');
}

(async () => {
  await testSensitivePersistenceBlocked();
  await testManagedFallbackReadUsesProfileRef();
  await testHydrationBackwardCompatibility();
  console.log('client.byosEnforcement.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
