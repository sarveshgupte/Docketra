const assert = require('assert');
const path = require('path');
const { Readable } = require('stream');

const servicePath = path.join(__dirname, '..', 'src', 'services', 'docketNarrativeStorage.service.js');
const strictPath = path.join(__dirname, '..', 'src', 'services', 'strictStoragePolicy.service.js');
const storageFactoryPath = path.join(__dirname, '..', 'src', 'services', 'storage', 'StorageProviderFactory.js');

function clearServiceCache() {
  delete require.cache[require.resolve(servicePath)];
  delete require.cache[require.resolve(strictPath)];
  delete require.cache[require.resolve(storageFactoryPath)];
}

async function testManagedFallbackUpload() {
  process.env.MANAGED_STORAGE_S3_BUCKET = 'bucket';
  process.env.MANAGED_STORAGE_S3_REGION = 'us-east-1';
  process.env.MANAGED_STORAGE_S3_PREFIX = 'prefix';

  clearServiceCache();
  require.cache[require.resolve(strictPath)] = { exports: { requireWritableBusinessStorage: async () => ({ strictFirmOwnedStorage: false, byosWritable: true }) } };
  require.cache[require.resolve(storageFactoryPath)] = { exports: { StorageProviderFactory: { getProvider: async () => { throw new Error('no byos'); } } } };

  const { S3Client } = require('@aws-sdk/client-s3');
  S3Client.prototype.send = async function send() { return {}; };
  const svc = require(servicePath);

  const payload = { narrative: { description: 'hello', checklist: [] } };
  const ref = await svc.uploadNarrative({ firmId: 'f1', docketId: 'D1', payload });
  assert.strictEqual(ref.mode, 'managed_fallback');
  assert.ok(ref.objectKey.includes('firms/f1/dockets/D1/docket.json'));
  assert.ok(ref.checksum && typeof ref.checksum === 'string');
}

async function testStrictModeBlocksWhenByosUnavailable() {
  clearServiceCache();
  require.cache[require.resolve(strictPath)] = {
    exports: {
      requireWritableBusinessStorage: async () => {
        const error = new Error('Firm-owned storage is required for this workspace.');
        error.code = 'STRICT_STORAGE_UNAVAILABLE';
        throw error;
      },
    },
  };
  require.cache[require.resolve(storageFactoryPath)] = { exports: { StorageProviderFactory: { getProvider: async () => { throw new Error('no byos'); } } } };
  const svc = require(servicePath);

  await assert.rejects(
    () => svc.uploadNarrative({ firmId: 'f1', docketId: 'D2', payload: { narrative: { description: 'x' } } }),
    (error) => error && error.code === 'STRICT_STORAGE_UNAVAILABLE',
  );
}

async function testReadFailureDoesNotLeakSecrets() {
  clearServiceCache();
  require.cache[require.resolve(strictPath)] = { exports: { requireWritableBusinessStorage: async () => ({ strictFirmOwnedStorage: false, byosWritable: true }) } };
  require.cache[require.resolve(storageFactoryPath)] = { exports: { StorageProviderFactory: { getProvider: async () => ({ providerName: 'google-drive', downloadFile: async () => Readable.from('{"narrative": {"description": "ok"}}') }) } } };
  const svc = require(servicePath);

  const data = await svc.readNarrative({ firmId: 'f1', docketRef: { provider: 'google-drive', mode: 'firm_connected', fileId: 'f' } });
  assert.strictEqual(data.narrative.description, 'ok');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(data, 'accessToken'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(data, 'refreshToken'), false);
}

(async () => {
  await testManagedFallbackUpload();
  await testStrictModeBlocksWhenByosUnavailable();
  await testReadFailureDoesNotLeakSecrets();
  console.log('docket narrative cloud-first storage tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
