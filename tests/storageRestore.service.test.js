#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const archiver = require('archiver');

const state = {
  uploadedFiles: [],
  uploadedContent: {},
  dbUpdates: [],
  auditLogs: [],
  encryptedBackupPath: null,
};

// Setup Mock Environment
const mocks = {
  '../models/Firm.model': {
    findById() {
      return {
        select() {
          return {
            lean: async () => ({
              _id: 'firm-123',
              storageConfig: { provider: 'mock-provider' },
            }),
          };
        },
      };
    },
  },
  '../models/BackupJob.model': {
    findOne() {
      return {
        lean: async () => ({
          jobId: 'backup-123',
          firmId: 'firm-123',
          archiveObjectKey: 'backups/nightly/backup-123.zip.enc',
        }),
      };
    },
  },
  '../models/AuditLog.model': {
    create: async (payload) => {
      state.auditLogs.push(payload);
      return payload;
    },
  },
  'mongoose': {
    connection: {
      db: {
        collection(name) {
          return {
            updateMany: async (filter, update) => {
              state.dbUpdates.push({ name, filter, update });
              return { matchedCount: 1, modifiedCount: 1 };
            },
          };
        },
      },
    },
  },
  './storage/StorageProviderFactory': {
    StorageProviderFactory: {
      async getProvider() {
        return {
          providerName: 'mock-provider',
          async uploadFile(folderId, fileName, fileStream, mimeType) {
            state.uploadedFiles.push({ folderId, fileName, mimeType });
            return new Promise((resolve, reject) => {
              const chunks = [];
              fileStream.on('data', chunk => chunks.push(chunk));
              fileStream.on('end', () => {
                state.uploadedContent[fileName] = Buffer.concat(chunks).toString('utf8');
                resolve({ fileId: `new-${fileName}-id` });
              });
              fileStream.on('error', reject);
            });
          },
          async downloadFile() {
            return fs.createReadStream(state.encryptedBackupPath);
          },
        };
      },
    },
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (mocks[request]) return mocks[request];
  return originalLoad.apply(this, arguments);
};

// Local AES-256-GCM encryption function matching storageBackup.service.js
async function localEncryptFileGcm(inputPath, outputPath, keyMaterial) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(String(keyMaterial || '')).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const output = fs.createWriteStream(outputPath);
  
  // Write IV to beginning
  output.write(iv);
  
  // Pipe data through cipher
  const input = fs.createReadStream(inputPath);
  await new Promise((resolve, reject) => {
    input.pipe(cipher).pipe(output)
      .on('finish', resolve)
      .on('error', reject);
  });
  
  // Append Auth Tag
  const authTag = cipher.getAuthTag();
  await fsp.appendFile(outputPath, authTag);
}

// Generate ZIP package matching storageBackup.service.js
function generateZipArchive(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(path.join(sourceDir, 'documents'), 'documents');
    archive.file(path.join(sourceDir, 'metadata.json'), { name: 'metadata.json' });
    archive.finalize();
  });
}

const { storageRestoreService } = require('../src/services/storageRestore.service');

async function run() {
  console.log('Running storageRestore.service unit tests...');
  const keyMaterial = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'test-secret';
  process.env.BACKUP_ENCRYPTION_KEY = keyMaterial;

  const testTempDir = path.join(os.tmpdir(), 'docketra-restore-test-' + crypto.randomUUID());
  await fsp.mkdir(testTempDir, { recursive: true });

  try {
    // 1. Create mock backup structure
    const sourceDir = path.join(testTempDir, 'source');
    await fsp.mkdir(path.join(sourceDir, 'documents'), { recursive: true });

    // Dummy document file
    const docName = 'document_one.pdf';
    const docContent = 'This is the body of document number one.';
    await fsp.writeFile(path.join(sourceDir, 'documents', docName), docContent, 'utf8');

    // Dummy metadata
    const metadata = {
      generatedAt: new Date().toISOString(),
      firmId: 'firm-123',
      totalFiles: 1,
      files: [
        {
          id: 'old-doc-1-id',
          name: docName,
          mimeType: 'application/pdf',
          size: docContent.length,
        },
      ],
    };
    await fsp.writeFile(path.join(sourceDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    // 2. Zip backup files
    const zipPath = path.join(testTempDir, 'backup.zip');
    await generateZipArchive(sourceDir, zipPath);

    // 3. Encrypt ZIP
    const encryptedPath = path.join(testTempDir, 'backup.zip.enc');
    await localEncryptFileGcm(zipPath, encryptedPath, keyMaterial);
    state.encryptedBackupPath = encryptedPath;

    // Verify file format layout: length >= 28 (12-byte IV + payload + 16-byte Auth Tag)
    const stat = await fsp.stat(encryptedPath);
    assert.ok(stat.size >= 28, 'Encrypted archive is too small');

    // 4. Run Restore background execution directly to catch all logic steps synchronously
    console.log('  Executing _executeRestoreBackground...');
    await storageRestoreService._executeRestoreBackground('firm-123', 'job-123', {
      exportId: 'backup-123',
      uploadedZipPath: null,
      performedBy: 'ADMIN_USER',
      performedByRole: 'Admin',
    });

    // 5. Verify outcomes
    console.log('  Verifying restore operations...');

    // A. Assert provider re-uploaded files properly
    assert.strictEqual(state.uploadedFiles.length, 1);
    assert.strictEqual(state.uploadedFiles[0].fileName, docName);
    assert.strictEqual(state.uploadedFiles[0].mimeType, 'application/pdf');
    assert.strictEqual(state.uploadedContent[docName], docContent, 'Decrypted/Restored file content mismatch!');

    // B. Assert DB update calls (direct mongo collections updateMany bypassing mongoose middleware)
    assert.strictEqual(state.dbUpdates.length, 2, 'Expected exactly 2 collection updates');
    
    // First update: attachments collection, storageFileId lookup
    assert.strictEqual(state.dbUpdates[0].name, 'attachments');
    assert.strictEqual(state.dbUpdates[0].filter.storageFileId, 'old-doc-1-id');
    assert.strictEqual(state.dbUpdates[0].update.$set.storageFileId, `new-${docName}-id`);

    // Second update: attachments collection, driveFileId lookup
    assert.strictEqual(state.dbUpdates[1].name, 'attachments');
    assert.strictEqual(state.dbUpdates[1].filter.driveFileId, 'old-doc-1-id');
    assert.strictEqual(state.dbUpdates[1].update.$set.driveFileId, `new-${docName}-id`);

    // C. Assert Audit Logs successfully generated
    assert.strictEqual(state.auditLogs.length, 1);
    assert.strictEqual(state.auditLogs[0].action, 'RESTORE_COMPLETED');
    assert.strictEqual(state.auditLogs[0].tenantId, 'firm-123');
    assert.strictEqual(state.auditLogs[0].performedBy, 'ADMIN_USER');
    assert.strictEqual(state.auditLogs[0].metadata.restoredFileCount, 1);

    console.log('  ✓ Storage restore service fully tested & correct.');
    console.log('All tests passed successfully.');

  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    // Cleanup filesystem
    await fsp.rm(testTempDir, { recursive: true, force: true }).catch(() => {});
    Module._load = originalLoad;
  }
}

run();
