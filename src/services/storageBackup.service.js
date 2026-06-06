const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const archiver = require('archiver');
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const BackupJob = require('../models/BackupJob.model');
const AuditLog = require('../models/AuditLog.model');
const emailService = require('./email.service');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const log = require('../utils/log');

const LINK_TTL_SECONDS = 30 * 60;
const NIGHTLY_RUN_EVERY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BACKUP_FOLDER = 'Backups';
const BACKUP_PATH_PREFIX = 'backups/nightly';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeFileName(name) {
  return String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'file.bin';
}

function streamSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
    input.on('error', reject);
  });
}

async function encryptFileGcm(inputPath, outputPath, keyMaterial) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(String(keyMaterial || '')).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const output = fs.createWriteStream(outputPath);
  output.write(iv);
  await pipeline(fs.createReadStream(inputPath), cipher, output);
  const authTag = cipher.getAuthTag();
  await fsp.appendFile(outputPath, authTag);
}

async function writeAudit({
  firmId,
  action,
  entityId,
  metadata = {},
  performedBy = 'SYSTEM',
  performedByRole = 'SYSTEM',
}) {
  try {
    await AuditLog.create({
      tenantId: String(firmId),
      entityType: 'storage_backup',
      entityId: String(entityId || firmId),
      action,
      performedBy,
      performedByRole,
      ipAddress: 'system',
      userAgent: 'system-job',
      metadata,
    });
  } catch (error) {
    log.warn('[BACKUP]', { event: 'audit_write_failed', firmId, action, message: error.message });
  }
}

class StorageBackupService {
  constructor() {
    this.nightlyTimer = null;
  }

  async generateZipArchive(sourceDir, zipPath) {
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      output.on('error', reject);
      archive.on('warning', reject);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(path.join(sourceDir, 'documents'), 'documents');
      archive.file(path.join(sourceDir, 'metadata.json'), { name: 'metadata.json' });
      archive.finalize();
    });
  }

  async uploadBackupToProvider({ provider, firmId, archivePath, objectKey }) {
    if (provider?.providerName === 's3' && typeof provider.uploadFile === 'function') {
      const uploaded = await provider.uploadFile(null, objectKey, fs.createReadStream(archivePath), 'application/octet-stream');
      return {
        archiveObjectKey: objectKey,
        providerFileId: uploaded?.fileId || uploaded?.id || objectKey,
      };
    }
    if (typeof provider.getOrCreateFolder === 'function' && typeof provider.uploadFile === 'function') {
      try {
        const root = await provider.getOrCreateFolder(null, 'Docketra');
        const firmFolder = await provider.getOrCreateFolder(root, String(firmId));
        const backups = await provider.getOrCreateFolder(firmFolder, DEFAULT_BACKUP_FOLDER);
        const targetName = objectKey.split('/').pop();
        const uploaded = await provider.uploadFile(
          backups,
          targetName,
          fs.createReadStream(archivePath),
          'application/octet-stream'
        );
        return {
          archiveObjectKey: `${BACKUP_PATH_PREFIX}/${targetName}`,
          providerFileId: uploaded?.fileId || null,
        };
      } catch (err) {
        log.warn('[BACKUP] Nested folder creation failed. Falling back to root upload.', { err: err.message });
      }
    }
    if (typeof provider.uploadFile === 'function') {
      const targetName = objectKey.split('/').pop();
      const parent = provider.providerName === 'onedrive' ? 'root' : null;
      const uploaded = await provider.uploadFile(
        parent,
        targetName,
        fs.createReadStream(archivePath),
        'application/octet-stream'
      );
      return {
        archiveObjectKey: targetName,
        providerFileId: uploaded?.fileId || uploaded?.id || targetName,
      };
    }
    throw new Error('Connected storage provider does not support server-side stream uploads yet');
  }

  async createProviderDownloadUrl({ provider, providerFileId }) {
    if (provider && typeof provider.generateDownloadUrl === 'function' && providerFileId) {
      return provider.generateDownloadUrl(providerFileId, LINK_TTL_SECONDS);
    }
    if (provider && (provider.providerName === 'google-drive' || provider.providerName === 'docketra_managed') && providerFileId) {
      return `https://drive.google.com/file/d/${encodeURIComponent(providerFileId)}/view`;
    }
    return null;
  }

  async createBackupArchiveOnTempDisk(firmId, exportId, provider) {
    const files = await provider.listFiles(null);
    const exportDir = path.join(os.tmpdir(), 'docketra-exports', String(firmId), exportId);
    const docsDir = path.join(exportDir, 'documents');
    ensureDir(docsDir);

    for (const file of files) {
      const resolvedFileId = file.fileId || file.id;
      const stream = await provider.downloadFile(resolvedFileId);
      const outputPath = path.join(docsDir, sanitizeFileName(file.name || `${resolvedFileId}.bin`));
      await pipeline(stream, fs.createWriteStream(outputPath));
    }

    await fsp.writeFile(
      path.join(exportDir, 'metadata.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          firmId: String(firmId),
          totalFiles: files.length,
          files: files.map((file) => ({
            id: file.fileId || file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: Number(file.size || 0),
          })),
        },
        null,
        2
      ),
      'utf8'
    );

    const zipPath = path.join(os.tmpdir(), 'docketra-exports', String(firmId), `${exportId}.zip`);
    ensureDir(path.dirname(zipPath));
    await this.generateZipArchive(exportDir, zipPath);
    return { zipPath, fileCount: files.length, exportDir };
  }

  async runBackupForFirm(firmId, options = {}) {
    const exportId = crypto.randomUUID();
    const startedAt = new Date();
    const firm = await Firm.findById(firmId).select('storageConfig settings.storageBackup').lean();
    const provider = await StorageProviderFactory.getProvider(firmId);
    const objectKey = `${BACKUP_PATH_PREFIX}/${startedAt.toISOString().slice(0, 10)}/${exportId}.zip.enc`;

    const backupJob = await BackupJob.create({
      jobId: exportId,
      firmId: String(firmId),
      storageProvider: String(firm?.storageConfig?.provider || provider?.providerName || 'unknown'),
      archiveObjectKey: objectKey,
      checksum: 'pending',
      size: 0,
      status: 'running',
      startedAt,
      emailNotification: {
        status: options.sendEmail ? 'pending' : 'not_requested',
        recipients: options.recipients || [],
      },
    });

    let zipPath = null;
    let encryptedPath = null;
    let exportDir = null;

    try {
      const created = await this.createBackupArchiveOnTempDisk(firmId, exportId, provider);
      zipPath = created.zipPath;
      exportDir = created.exportDir;
      encryptedPath = `${zipPath}.enc`;

      const keyMaterial = process.env.BACKUP_ENCRYPTION_KEY || process.env.JWT_SECRET;
      await encryptFileGcm(zipPath, encryptedPath, keyMaterial);
      const checksum = await streamSha256(encryptedPath);
      const size = (await fsp.stat(encryptedPath)).size;

      const uploaded = await this.uploadBackupToProvider({
        provider,
        firmId,
        archivePath: encryptedPath,
        objectKey,
      });
      const archiveObjectKey = uploaded.archiveObjectKey || objectKey;
      const providerFileId = uploaded.providerFileId || null;

      await BackupJob.updateOne(
        { _id: backupJob._id },
        {
          $set: {
            checksum,
            size,
            status: 'success',
            completedAt: new Date(),
            metadata: {
              providerFileId,
              fileCount: created.fileCount,
              encrypted: true,
            },
          },
        }
      );

      await writeAudit({
        firmId,
        action: 'BACKUP_CREATED',
        entityId: exportId,
        metadata: { archiveObjectKey, checksum, size, providerFileId },
      });

      if (options.sendEmail) {
        try {
          const deliveryPolicy = firm?.settings?.storageBackup?.deliveryPolicy || 'link_only';
          const attachmentPath = deliveryPolicy === 'attachment' ? encryptedPath : null;
          const downloadUrl = await this.createProviderDownloadUrl({ provider, providerFileId });

          await this.emailBackupNotification({
            firmId,
            exportId,
            downloadUrl,
            success: true,
            recipients: options.recipients || [],
            attachmentPath,
          });
        } catch (emailError) {
          log.error('[BACKUP]', { event: 'backup_email_failed', firmId: String(firmId), message: emailError.message });
        }
      }

      return {
        exportId,
        archiveObjectKey,
        providerFileId,
        fileCount: created.fileCount,
        checksum,
        size,
      };
    } catch (error) {
      await BackupJob.updateOne(
        { _id: backupJob._id },
        {
          $set: {
            status: 'failed',
            completedAt: new Date(),
            metadata: { error: error.message },
          },
        }
      );
      await writeAudit({
        firmId,
        action: 'BACKUP_FAILED',
        entityId: exportId,
        metadata: { message: error.message },
      });

      if (options.sendEmail) {
        try {
          await this.emailBackupNotification({
            firmId,
            exportId,
            downloadUrl: null,
            success: false,
            recipients: options.recipients || [],
          });
        } catch (emailError) {
          log.error('[BACKUP]', { event: 'backup_email_failed', firmId: String(firmId), message: emailError.message });
        }
      }

      throw error;
    } finally {
      if (encryptedPath) await fsp.rm(encryptedPath, { force: true }).catch(() => {});
      if (zipPath) await fsp.rm(zipPath, { force: true }).catch(() => {});
      if (exportDir) await fsp.rm(exportDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async listBackups(firmId, limit = 20) {
    return BackupJob.find({ firmId: String(firmId) })
      .sort({ startedAt: -1 })
      .limit(Math.min(Number(limit) || 20, 100))
      .lean();
  }

  async buildBackupAccess({ firmId, exportId }) {
    const backup = await BackupJob.findOne({ firmId: String(firmId), jobId: String(exportId) }).lean();
    if (!backup || backup.status !== 'success') return null;

    const provider = await StorageProviderFactory.getProvider(firmId);
    const providerFileId = backup?.metadata?.providerFileId || null;
    const downloadUrl = await this.createProviderDownloadUrl({ provider, providerFileId });

    await writeAudit({
      firmId,
      action: 'BACKUP_DOWNLOAD_LINK_ISSUED',
      entityId: exportId,
      metadata: { providerFileId, expiresInSeconds: LINK_TTL_SECONDS },
    });

    return {
      ...backup,
      downloadUrl,
      expiresInSeconds: LINK_TTL_SECONDS,
    };
  }

  async emailBackupNotification({ firmId, exportId, downloadUrl, success = true, recipients = [], attachmentPath = null }) {
    const resolvedRecipients = recipients.length
      ? recipients
      : await this.resolveDefaultRecipients(firmId);

    if (!resolvedRecipients.length) return { sent: false, reason: 'no_recipients' };

    const subject = success
      ? 'Docketra backup completed'
      : 'Docketra backup failed';
    
    let text = success
      ? `Backup ${exportId} completed.`
      : `Backup ${exportId} failed. Review backup status in admin settings.`;

    if (downloadUrl) {
      text += ` Retrieve it securely here: ${downloadUrl}`;
    }

    const mailOptions = {
      to: resolvedRecipients.join(','),
      subject,
      text,
      html: `<p>${text}</p>`,
    };

    if (attachmentPath && fs.existsSync(attachmentPath)) {
      try {
        const fileBuffer = await fsp.readFile(attachmentPath);
        const base64Content = fileBuffer.toString('base64');
        const fileName = path.basename(attachmentPath);
        mailOptions.attachments = [
          {
            content: base64Content,
            name: fileName,
          }
        ];
      } catch (err) {
        log.error('[BACKUP] Failed to read backup attachment file', { err: err.message });
      }
    }

    await emailService.sendDirectAuthEmail(mailOptions);
    
    await BackupJob.updateOne(
      { firmId: String(firmId), jobId: String(exportId) },
      {
        $set: {
          'emailNotification.status': 'sent',
          'emailNotification.sentAt': new Date(),
          'emailNotification.recipients': resolvedRecipients,
        },
      }
    );
    return { sent: true, recipients: resolvedRecipients };
  }

  async resolveDefaultRecipients(firmId) {
    const firm = await Firm.findById(firmId).select('settings.storageBackup').lean();
    const configured = firm?.settings?.storageBackup?.notificationRecipients || [];
    if (configured.length) return configured;
    const primaryAdmin = await User.findOne({ firmId, isPrimaryAdmin: true }).select('email').lean();
    return primaryAdmin?.email ? [primaryAdmin.email] : [];
  }

  async runNightlyBackupsOnce() {
    const firms = await Firm.find({
      'settings.storageBackup.enabled': true,
    }).select('_id settings.storageBackup').lean();

    for (const firm of firms) {
      try {
        const frequency = firm?.settings?.storageBackup?.frequency || 'daily';
        if (frequency === 'disabled') continue;

        if (frequency === 'weekly' || frequency === 'monthly') {
          const lastJob = await BackupJob.findOne({
            firmId: String(firm._id),
            status: 'success',
          }).sort({ startedAt: -1 }).lean();

          if (lastJob && lastJob.startedAt) {
            const daysSinceLastBackup = (Date.now() - new Date(lastJob.startedAt).getTime()) / (1000 * 60 * 60 * 24);
            const thresholdDays = frequency === 'weekly' ? 7 : 30;
            if (daysSinceLastBackup < thresholdDays - 0.1) {
              log.info('[BACKUP]', { event: 'scheduled_backup_skipped_frequency', firmId: String(firm._id), frequency, daysSinceLastBackup });
              continue;
            }
          }
        }

        await this.runBackupForFirm(firm._id, {
          sendEmail: true,
          recipients: firm?.settings?.storageBackup?.notificationRecipients || [],
        });
      } catch (error) {
        log.error('[BACKUP]', {
          event: 'nightly_backup_failed',
          firmId: String(firm._id),
          message: error.message,
        });
      }
    }
  }

  scheduleNightlyBackups() {
    if (this.nightlyTimer) return;
    this.nightlyTimer = setInterval(async () => {
      try {
        await this.runNightlyBackupsOnce();
      } catch (error) {
        log.error('[BACKUP]', { event: 'nightly_scheduler_failed', message: error.message });
      }
    }, NIGHTLY_RUN_EVERY_MS);
    this.nightlyTimer.unref?.();
  }
}

module.exports = {
  storageBackupService: new StorageBackupService(),
};
