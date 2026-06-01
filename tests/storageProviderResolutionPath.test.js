#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Readable } = require('stream');

const originalLoad = Module._load;
let providerResolutionCalls = 0;

Module._load = function(request, parent, isMain) {
  if (request === '../models/Firm.model') {
    return { findById: () => ({ select: () => ({ lean: async () => ({ storageConfig: { provider: 'google_drive' }, settings: {} }) }) }) };
  }
  if (request === '../models/BackupJob.model') {
    return {
      create: async () => ({ _id: 'job1' }),
      updateOne: async () => ({}),
    };
  }
  if (request === '../models/AuditLog.model') return { create: async () => ({}) };
  if (request === '../models/User.model') return {};
  if (request === './email.service') return {};
  if (request === './storage/StorageProviderFactory') {
    return {
      StorageProviderFactory: {
        async getProvider() {
          providerResolutionCalls += 1;
          return {
            providerName: 'google-drive',
            async getOrCreateFolder() { return 'folder'; },
            async uploadFile() { return { fileId: 'file-1' }; },
            async listFiles() { return []; },
            async downloadFile() { return null; },
            async generateDownloadUrl() { return 'https://example.com'; },
          };
        },
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

(async () => {
  let archiveProbe = null;
  try {
    const { getStorageAdapter } = require('../src/services/storageAdapter.service');
    await getStorageAdapter('firm-1');
    assert.strictEqual(providerResolutionCalls, 1);

    const { storageBackupService: backupService } = require('../src/services/storageBackup.service');
    const originalCreateBackupArchiveOnTempDisk = backupService.createBackupArchiveOnTempDisk.bind(backupService);
    const originalUploadBackupToProvider = backupService.uploadBackupToProvider.bind(backupService);
    const testZipPath = path.join(os.tmpdir(), 'docketra-resolution-test-a.zip');
    const testExportDir = path.join(os.tmpdir(), 'docketra-resolution-test-a');
    fs.writeFileSync(testZipPath, 'backup-bytes');
    backupService.createBackupArchiveOnTempDisk = async () => ({ zipPath: testZipPath, fileCount: 0, exportDir: testExportDir });
    backupService.uploadBackupToProvider = async () => ({ archiveObjectKey: 'backups/nightly/a.zip.enc', providerFileId: 'file-1' });
    await backupService.runBackupForFirm('firm-1', {});
    assert.strictEqual(providerResolutionCalls, 2);

    archiveProbe = await originalCreateBackupArchiveOnTempDisk('firm-1', 'export-meta-probe', {
      async listFiles() {
        return [{ fileId: 'f-1', name: 'one.txt', mimeType: 'text/plain', size: 3 }];
      },
      async downloadFile() {
        return Readable.from(Buffer.from('abc'));
      },
    });
    const metadataPath = path.join(archiveProbe.exportDir, 'metadata.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    assert.strictEqual(metadata.files[0].id, 'f-1');
    const folderUploaded = await originalUploadBackupToProvider({
      provider: {
        providerName: 'google-drive',
        async getOrCreateFolder() { return 'folder'; },
        async uploadFile(parent, fileName, stream) {
          if (stream?.on) {
            await new Promise((resolve, reject) => {
              stream.on('error', reject);
              stream.on('end', resolve);
              stream.resume();
            });
          }
          return { fileId: `${parent}/${fileName}` };
        },
      },
      firmId: 'firm-1',
      archivePath: archiveProbe.zipPath,
      objectKey: 'backups/nightly/2026-01-01/sample.zip.enc',
    });
    assert.ok(folderUploaded.providerFileId);

    const s3Uploaded = await originalUploadBackupToProvider({
      provider: {
        providerName: 's3',
        async uploadFile(parent, fileName, stream) {
          if (stream?.on) {
            await new Promise((resolve, reject) => {
              stream.on('error', reject);
              stream.on('end', resolve);
              stream.resume();
            });
          }
          return { fileId: `${parent || ''}${fileName}` };
        },
      },
      firmId: 'firm-1',
      archivePath: archiveProbe.zipPath,
      objectKey: 'backups/nightly/2026-01-01/sample.zip.enc',
    });
    assert.strictEqual(s3Uploaded.archiveObjectKey, 'backups/nightly/2026-01-01/sample.zip.enc');

    console.log('✓ backup metadata mapping uses per-file id without loop-scope reference errors');
    console.log('✓ backup upload supports folder-style and object-key-style providers');

    console.log('✓ storage adapter delegates to StorageProviderFactory');
    console.log('✓ backup flow resolves provider via StorageProviderFactory');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    if (archiveProbe?.zipPath) fs.rmSync(archiveProbe.zipPath, { force: true });
    if (archiveProbe?.exportDir) fs.rmSync(archiveProbe.exportDir, { recursive: true, force: true });
    const testZipPath = path.join(os.tmpdir(), 'docketra-resolution-test-a.zip');
    const testExportDir = path.join(os.tmpdir(), 'docketra-resolution-test-a');
    fs.rmSync(testZipPath, { force: true });
    fs.rmSync(testExportDir, { recursive: true, force: true });
    Module._load = originalLoad;
  }
})();
