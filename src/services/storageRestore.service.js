const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const unzipper = require('unzipper');
const Firm = require('../models/Firm.model');
const BackupJob = require('../models/BackupJob.model');
const AuditLog = require('../models/AuditLog.model');
const mongoose = require('mongoose');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const log = require('../utils/log');

const BACKUP_PATH_PREFIX = 'backups/nightly';

// Active restore jobs map to support real-time progress polling
const activeRestores = new Map();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function decryptFileGcm(inputPath, outputPath, keyMaterial) {
  const stat = await fsp.stat(inputPath);
  const size = stat.size;
  if (size < 28) {
    throw new Error('Encrypted backup file is truncated or invalid');
  }

  // Read IV (first 12 bytes)
  const ivFd = await fsp.open(inputPath, 'r');
  const ivBuffer = Buffer.alloc(12);
  await ivFd.read(ivBuffer, 0, 12, 0);
  await ivFd.close();

  // Read Auth Tag (last 16 bytes)
  const tagFd = await fsp.open(inputPath, 'r');
  const tagBuffer = Buffer.alloc(16);
  await tagFd.read(tagBuffer, 0, 16, size - 16);
  await tagFd.close();

  const key = crypto.createHash('sha256').update(String(keyMaterial || '')).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  const input = fs.createReadStream(inputPath, { start: 12, end: size - 17 });
  const output = fs.createWriteStream(outputPath);

  await pipeline(input, decipher, output);
}

class StorageRestoreService {
  getActiveRestore(jobId) {
    return activeRestores.get(jobId) || null;
  }

  async runRestoreForFirm(firmId, { exportId, uploadedZipPath = null, performedBy = 'SYSTEM', performedByRole = 'SYSTEM' } = {}) {
    const jobId = exportId || crypto.randomUUID();
    const startedAt = new Date();
    
    // Register active job progress
    activeRestores.set(jobId, {
      jobId,
      firmId,
      progress: 0,
      status: 'downloading',
      error: null,
      startedAt,
    });

    // Run async restore in the background
    this._executeRestoreBackground(firmId, jobId, { exportId, uploadedZipPath, performedBy, performedByRole })
      .catch((error) => {
        log.error('[RESTORE]', { event: 'restore_background_failed', firmId, jobId, message: error.message });
      });

    return jobId;
  }

  async _executeRestoreBackground(firmId, jobId, { exportId, uploadedZipPath, performedBy, performedByRole }) {
    const jobState = activeRestores.get(jobId);
    let encryptedPath = uploadedZipPath;
    let zipPath = null;
    let tempDir = null;

    try {
      const provider = await StorageProviderFactory.getProvider(firmId);
      const keyMaterial = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
      
      tempDir = path.join(os.tmpdir(), 'docketra-restores', String(firmId), jobId);
      ensureDir(tempDir);
      zipPath = path.join(tempDir, 'decrypted.zip');

      // Step 1: Download backup if restoring from a past backup job
      if (exportId) {
        const backupJob = await BackupJob.findOne({ jobId: exportId, firmId }).lean();
        if (!backupJob) {
          throw new Error(`Backup job ${exportId} not found`);
        }
        
        encryptedPath = path.join(tempDir, 'encrypted.zip.enc');
        log.info('[RESTORE] Downloading backup file from provider', { firmId, exportId, objectKey: backupJob.archiveObjectKey });
        
        const downloadStream = await provider.downloadFile(backupJob.archiveObjectKey);
        await pipeline(downloadStream, fs.createWriteStream(encryptedPath));
      }

      if (!encryptedPath || !fs.existsSync(encryptedPath)) {
        throw new Error('Encrypted backup archive is missing or could not be retrieved');
      }

      // Step 2: Decrypt backup file
      if (jobState) {
        jobState.status = 'decrypting';
        jobState.progress = 10;
      }
      log.info('[RESTORE] Decrypting encrypted backup file', { firmId, jobId });
      await decryptFileGcm(encryptedPath, zipPath, keyMaterial);

      // Step 3: Unzip and extract metadata
      if (jobState) {
        jobState.status = 'restoring_files';
        jobState.progress = 30;
      }
      
      const directory = await unzipper.Open.file(zipPath);
      const metadataEntry = directory.files.find(f => f.path === 'metadata.json');
      if (!metadataEntry) {
        throw new Error('Invalid backup ZIP: missing metadata.json');
      }

      const metadataContent = await metadataEntry.buffer();
      const metadata = JSON.parse(metadataContent.toString('utf8'));
      const filesToRestore = metadata.files || [];
      const totalFiles = filesToRestore.length;

      log.info('[RESTORE] Starting streaming extraction and re-upload', { firmId, totalFiles });

      let restoredCount = 0;
      for (const file of filesToRestore) {
        const fileName = file.name || `${file.id}.bin`;
        const zipFilePath = `documents/${sanitizeFileName(fileName)}`;
        const entry = directory.files.find(f => f.path === zipFilePath);
        if (!entry) {
          log.warn('[RESTORE] File not found in zip archive', { zipFilePath });
          continue;
        }

        const fileStream = entry.stream();
        log.info('[RESTORE] Re-uploading file to active provider', { fileName, originalId: file.id });
        
        // Re-upload back to active provider
        const uploaded = await provider.uploadFile(null, fileName, fileStream, file.mimeType || 'application/octet-stream');
        const newFileId = uploaded?.fileId || uploaded?.id || file.id;

        // Bypassing Mongoose strict immutability checks via direct MongoDB collection query
        if (file.id && newFileId && file.id !== newFileId) {
          await mongoose.connection.db.collection('attachments').updateMany(
            { firmId: String(firmId), storageFileId: file.id },
            { $set: { storageFileId: newFileId } }
          );
          await mongoose.connection.db.collection('attachments').updateMany(
            { firmId: String(firmId), driveFileId: file.id },
            { $set: { driveFileId: newFileId, storageFileId: newFileId } }
          );
        }

        restoredCount++;
        if (jobState) {
          jobState.progress = Math.round(30 + (restoredCount / totalFiles) * 60);
        }
      }

      if (jobState) {
        jobState.status = 'completed';
        jobState.progress = 100;
      }
      
      // Log successful audit trail
      await AuditLog.create({
        tenantId: String(firmId),
        entityType: 'storage_restore',
        entityId: jobId,
        action: 'RESTORE_COMPLETED',
        performedBy,
        performedByRole,
        ipAddress: 'system',
        userAgent: 'system-restore',
        metadata: {
          exportId,
          restoredFileCount: restoredCount,
          totalFileCount: totalFiles,
        },
      });

    } catch (error) {
      if (jobState) {
        jobState.status = 'failed';
        jobState.error = error.message;
      }
      
      // Log failure audit trail
      await AuditLog.create({
        tenantId: String(firmId),
        entityType: 'storage_restore',
        entityId: jobId,
        action: 'RESTORE_FAILED',
        performedBy,
        performedByRole,
        ipAddress: 'system',
        userAgent: 'system-restore',
        metadata: {
          exportId,
          error: error.message,
        },
      });

      throw error;
    } finally {
      // Clean up temporary files on disk
      try {
        if (tempDir && fs.existsSync(tempDir)) {
          await fsp.rm(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        log.warn('[RESTORE] Temp directory cleanup failed', { cleanupError: cleanupError.message });
      }
    }
  }
}

function sanitizeFileName(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'file.bin';
}

module.exports = {
  storageRestoreService: new StorageRestoreService(),
};
