const assert = require('assert');
const crypto = require('crypto');
process.env.STORAGE_TOKEN_SECRET = process.env.STORAGE_TOKEN_SECRET || 'test-storage-secret';

const { encrypt, decrypt } = require('../src/services/storage/services/TokenEncryption.service');
const { resolveFirmStorageState } = require('../src/services/storage/resolveFirmStorageState');
const { getStorageStateDriftIssues } = require('../src/services/storage/storageStateDriftReport');
const middleware = require('../src/middleware/requireStorageConnected');

function legacyCbcEncrypt(text) {
  const key = crypto.createHash('sha256').update(process.env.STORAGE_TOKEN_SECRET).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

(function run() {
  const plainToken = 'ya29.storage-refresh-token';
  const encryptedToken = encrypt(plainToken);
  assert.notStrictEqual(encryptedToken, plainToken);
  assert.ok(encryptedToken.startsWith('storage-token:v2:'), 'new storage token writes must use the authenticated v2 format');
  assert.strictEqual(decrypt(encryptedToken), plainToken);

  const legacyEncryptedToken = legacyCbcEncrypt(plainToken);
  assert.strictEqual(decrypt(legacyEncryptedToken), plainToken, 'legacy AES-CBC storage token blobs must remain readable during migration');

  const tamperedParts = encryptedToken.split(':');
  tamperedParts[4] = `${tamperedParts[4].slice(0, -1)}${tamperedParts[4].endsWith('A') ? 'B' : 'A'}`;
  assert.throws(
    () => decrypt(tamperedParts.join(':')),
    /authenticate|Unsupported state|Invalid encrypted/i,
    'tampered authenticated storage token ciphertext must fail closed'
  );

  assert.strictEqual(resolveFirmStorageState({ storage: { mode: 'docketra_managed' }, storageConfig: null }).connectionStatus, 'ACTIVE_MANAGED');

  const activeByos = resolveFirmStorageState({
    storage: { mode: 'firm_connected' },
    storageConfig: { provider: 'google_drive', credentials: encrypt(JSON.stringify({ refreshToken: 'rt', rootFolderId: 'rfid' })) },
  });
  assert.strictEqual(activeByos.connectionStatus, 'ACTIVE_BYOS');

  const disconnectedByStatus = resolveFirmStorageState({
    storage: { mode: 'firm_connected' },
    storageConfig: { provider: 'google_drive', credentials: encrypt(JSON.stringify({ status: 'DISCONNECTED', refreshToken: 'rt', rootFolderId: 'rfid' })) },
  });
  assert.strictEqual(disconnectedByStatus.connectionStatus, 'DISCONNECTED');

  const errorByStatus = resolveFirmStorageState({
    storage: { mode: 'firm_connected' },
    storageConfig: { provider: 'google_drive', credentials: encrypt(JSON.stringify({ status: 'ERROR', refreshToken: 'rt', rootFolderId: 'rfid' })) },
  });
  assert.strictEqual(errorByStatus.connectionStatus, 'ERROR');

  assert.strictEqual(resolveFirmStorageState({ storageConfig: { provider: 'google_drive', credentials: 'invalid' }, storage: { mode: 'firm_connected' } }).connectionStatus, 'ERROR');
  assert.strictEqual(resolveFirmStorageState({ storageConfig: { provider: 'google_drive' }, storage: { mode: 'firm_connected' } }).connectionStatus, 'DISCONNECTED');
  assert.strictEqual(resolveFirmStorageState({ storageConfig: { provider: 'google-drive' }, storage: { mode: 'firm_connected' } }).canonicalProvider, 'google_drive');
  assert.strictEqual(resolveFirmStorageState({ storageConfig: { provider: 'docketra_drive' } }).canonicalProvider, 'docketra_managed');

  const legacyActive = resolveFirmStorageState({
    storage: { mode: 'firm_connected', provider: 'google_drive', google: { encryptedRefreshToken: 'legacy', rootFolderId: 'rfid' } },
    storageConfig: null,
  });
  assert.strictEqual(legacyActive.connectionStatus, 'ACTIVE_BYOS');

  const legacyIncomplete = resolveFirmStorageState({
    storage: { mode: 'firm_connected', provider: 'google_drive', google: { encryptedRefreshToken: 'legacy' } },
    storageConfig: null,
  });
  assert.strictEqual(legacyIncomplete.connectionStatus, 'DISCONNECTED');

  const drift = getStorageStateDriftIssues({ storage: { mode: 'firm_connected', provider: 'google-drive' }, storageConfig: null });
  assert.ok(drift.includes('FIRM_CONNECTED_WITHOUT_STORAGECONFIG_PROVIDER'));
  assert.strictEqual(middleware.requireStorageConnected, middleware.requireActiveStorageProvider);

  console.log('✓ storage state normalization and drift guardrails');
})();
