const assert = require('assert');
const path = require('path');

process.env.MANAGED_STORAGE_S3_BUCKET = 'b';
process.env.MANAGED_STORAGE_S3_REGION = 'us-east-1';
process.env.MANAGED_STORAGE_S3_PREFIX = 'p';

const servicePath = path.join(__dirname, '..', 'src', 'services', 'docketNarrativeStorage.service.js');
const strictPath = path.join(__dirname, '..', 'src', 'services', 'strictStoragePolicy.service.js');
const storageFactoryPath = path.join(__dirname, '..', 'src', 'services', 'storage', 'StorageProviderFactory.js');

require.cache[require.resolve(strictPath)] = { exports: { requireWritableBusinessStorage: async () => ({ strictFirmOwnedStorage: false, byosWritable: true }) } };
require.cache[require.resolve(storageFactoryPath)] = { exports: { StorageProviderFactory: { getProvider: async () => { throw new Error('no byos'); } } } };

const { S3Client } = require('@aws-sdk/client-s3');
S3Client.prototype.send = async function send() { return {}; };
const svc = require(servicePath);

(async () => {
  const payload = { narrative: { description: 'hello', checklist: [] } };
  const ref = await svc.uploadNarrative({ firmId: 'f1', docketId: 'D1', payload });
  assert.strictEqual(ref.mode, 'managed_fallback');
  assert.ok(ref.objectKey.includes('firms/f1/dockets/D1/docket.json'));
  console.log('docket cloud-first upload test passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
