process.env.STORAGE_TOKEN_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345678901234567890';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock_client_id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret';
process.env.GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/storage/google/callback';
process.env.FRONTEND_URL = 'http://localhost:5173';

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Firm = require('../src/models/Firm.model');
const { googleDriveService } = require('../src/services/googleDrive.service');
const { resolveFirmStorageState } = require('../src/services/storage/resolveFirmStorageState');
const { encrypt } = require('../src/services/storage/services/TokenEncryption.service');

async function runByosTests() {
  console.log('Starting BYOS Storage Reliability Tests...');
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  try {
    // Test 1: HTTP 403 / Permission error DOES NOT disconnect storage
    {
      const firmId = new mongoose.Types.ObjectId();
      const initialCredentials = {
        refreshToken: 'valid-refresh-token-123',
        rootFolderId: 'folder-root-456',
        connectedEmail: 'admin@firm.com',
        status: 'ACTIVE',
      };

      await Firm.create({
        _id: firmId,
        name: 'Test Firm OPC',
        slug: 'test-firm-opc',
        firmSlug: 'test-firm-opc',
        firmId: 'FIRM001',
        storage: { mode: 'firm_connected', provider: 'google_drive', google: { rootFolderId: 'folder-root-456' } },
        storageConfig: {
          provider: 'google_drive',
          credentials: encrypt(JSON.stringify(initialCredentials)),
        },
      });

      const permError = new Error('The caller does not have permission');
      permError.status = 403;

      await googleDriveService.handleProviderError(firmId, permError);

      const updatedFirm = await Firm.findById(firmId).lean();
      const state = resolveFirmStorageState(updatedFirm, { includeCredentials: true });

      assert.strictEqual(state.connectionStatus, 'ERROR', '403 error marks status as ERROR instead of DISCONNECTED');
      assert.strictEqual(state.rootFolderId, 'folder-root-456', 'rootFolderId remains preserved after 403');
      assert.strictEqual(state.credentials.refreshToken, 'valid-refresh-token-123', 'refreshToken remains preserved after 403');
      console.log('✓ Test 1 Passed: HTTP 403 & Permission errors DO NOT disconnect BYOS storage.');
      await Firm.deleteMany({});
    }

    // Test 2: HTTP 401 invalid_grant MUST disconnect storage but preserve rootFolderId
    {
      const firmId = new mongoose.Types.ObjectId();
      const initialCredentials = {
        refreshToken: 'stale-refresh-token',
        rootFolderId: 'folder-root-789',
        connectedEmail: 'admin@firm.com',
        status: 'ACTIVE',
      };

      await Firm.create({
        _id: firmId,
        name: 'Test Firm 2',
        slug: 'test-firm-2',
        firmSlug: 'test-firm-2',
        firmId: 'FIRM002',
        storage: { mode: 'firm_connected', provider: 'google_drive', google: { rootFolderId: 'folder-root-789' } },
        storageConfig: {
          provider: 'google_drive',
          credentials: encrypt(JSON.stringify(initialCredentials)),
        },
      });

      const grantError = new Error('invalid_grant: Token has been expired or revoked.');
      grantError.status = 401;

      await googleDriveService.handleProviderError(firmId, grantError);

      const updatedFirm = await Firm.findById(firmId).lean();
      const state = resolveFirmStorageState(updatedFirm, { includeCredentials: true });

      assert.strictEqual(state.connectionStatus, 'DISCONNECTED', 'invalid_grant marks status as DISCONNECTED');
      assert.strictEqual(state.rootFolderId, 'folder-root-789', 'rootFolderId is preserved for seamless reconnection');
      assert.strictEqual(state.credentials.refreshToken, null, 'refreshToken is cleared on 401 revocation');
      console.log('✓ Test 2 Passed: HTTP 401 invalid_grant disconnects storage while preserving rootFolderId.');
      await Firm.deleteMany({});
    }

    // Test 3: handleTokenRefresh auto-persists refreshed tokens
    {
      const firmId = new mongoose.Types.ObjectId();
      const initialCredentials = {
        refreshToken: 'old-refresh-token',
        rootFolderId: 'folder-root-999',
        connectedEmail: 'admin@firm.com',
        status: 'ACTIVE',
      };

      await Firm.create({
        _id: firmId,
        name: 'Test Firm 3',
        slug: 'test-firm-3',
        firmSlug: 'test-firm-3',
        firmId: 'FIRM003',
        storage: { mode: 'firm_connected', provider: 'google_drive', google: { rootFolderId: 'folder-root-999' } },
        storageConfig: {
          provider: 'google_drive',
          credentials: encrypt(JSON.stringify(initialCredentials)),
        },
      });

      const newTokens = {
        access_token: 'new-access-token-abc',
        refresh_token: 'new-refresh-token-xyz',
        expiry_date: Date.now() + 3600 * 1000,
      };

      await googleDriveService.handleTokenRefresh(firmId, newTokens);

      const updatedFirm = await Firm.findById(firmId).lean();
      const state = resolveFirmStorageState(updatedFirm, { includeCredentials: true });

      assert.strictEqual(state.credentials.refreshToken, 'new-refresh-token-xyz', 'Refreshed refreshToken updated');
      assert.strictEqual(state.credentials.accessToken, 'new-access-token-abc', 'Refreshed accessToken saved');
      assert.strictEqual(state.rootFolderId, 'folder-root-999', 'rootFolderId preserved');
      assert.strictEqual(state.connectedEmail, 'admin@firm.com', 'connectedEmail preserved');
      console.log('✓ Test 3 Passed: handleTokenRefresh auto-persists refreshed OAuth tokens.');
      await Firm.deleteMany({});
    }

    // Test 4: getClient falls back to legacy encryptedRefreshToken
    {
      const firmId = new mongoose.Types.ObjectId();
      const legacyToken = 'legacy-encrypted-refresh-token-123';

      await Firm.create({
        _id: firmId,
        name: 'Legacy Firm',
        slug: 'legacy-firm',
        firmSlug: 'legacy-firm',
        firmId: 'FIRM004',
        storage: {
          mode: 'firm_connected',
          provider: 'google_drive',
          google: {
            rootFolderId: 'folder-legacy-111',
            encryptedRefreshToken: encrypt(legacyToken),
          },
        },
        storageConfig: {
          provider: 'google_drive',
          credentials: encrypt(JSON.stringify({ rootFolderId: 'folder-legacy-111' })),
        },
      });

      const client = await googleDriveService.getClient(firmId);
      assert.ok(client.drive, 'Drive client created via legacy fallback');
      assert.strictEqual(client.rootFolderId, 'folder-legacy-111', 'Root folder ID resolved correctly');
      console.log('✓ Test 4 Passed: getClient falls back to legacy encryptedRefreshToken when needed.');
      await Firm.deleteMany({});
    }

    console.log('All BYOS Storage Reliability Tests Passed Successfully!');
  } catch (err) {
    console.error('BYOS Test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runByosTests();
