const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const archiver = require('archiver');
const { googleDriveService } = require('./googleDrive.service');
const User = require('../models/User.model');
const emailService = require('./email.service');

const linkRegistry = new Map();
const LINK_TTL_MS = 30 * 60 * 1000;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

class StorageBackupService {
  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupExpiredLinks(), 5 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  cleanupExpiredLinks() {
    const now = Date.now();
    for (const [token, entry] of linkRegistry.entries()) {
      if (entry.expiresAt <= now) {
        linkRegistry.delete(token);
      }
    }
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

  async runBackupForFirm(firmId) {
    const files = await googleDriveService.listFiles(firmId);
    const exportId = crypto.randomUUID();
    const exportDir = path.join(os.tmpdir(), 'docketra-exports', firmId);
    const docsDir = path.join(exportDir, exportId, 'documents');
    ensureDir(docsDir);

    const zipPath = path.join(exportDir, `${exportId}.zip`);
    const workingDir = path.join(exportDir, exportId);

    for (const file of files) {
      const stream = await googleDriveService.downloadFile(firmId, file.id);
      const safeName = (file.name || `${file.id}.bin`).replace(/[\\/:*?"<>|]/g, '_');
      const outputPath = path.join(docsDir, safeName);
      const output = fs.createWriteStream(outputPath);
      await pipeline(stream, output);
    }

    fs.writeFileSync(
      path.join(workingDir, 'metadata.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          firmId,
          totalFiles: files.length,
          files: files.map((file) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
          })),
        },
        null,
        2
      )
    );

    await this.generateZipArchive(workingDir, zipPath);

    return {
      exportId,
      zipPath,
      fileCount: files.length,
    };
  }

  createSignedDownloadToken({ firmId, zipPath, exportId }) {
    const token = crypto.randomBytes(24).toString('hex');
    linkRegistry.set(token, {
      firmId: String(firmId),
      zipPath,
      exportId,
      expiresAt: Date.now() + LINK_TTL_MS,
    });
    return token;
  }

  resolveSignedDownloadToken(token, firmId) {
    const entry = linkRegistry.get(token);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      linkRegistry.delete(token);
      return null;
    }
    if (String(entry.firmId) !== String(firmId)) return null;
    return entry;
  }

  async emailBackupLinkToPrimaryAdmin(firmId, downloadUrl) {
    const primaryAdmin = await User.findOne({ firmId, isPrimaryAdmin: true }).select('email name').lean();
    if (!primaryAdmin?.email) return;

    await emailService.sendEmail({
      to: primaryAdmin.email,
      subject: 'Your Docketra workspace export is ready',
      html: `<p>Hello ${primaryAdmin.name || 'Admin'},</p><p>Your backup is ready. Download it securely here:</p><p><a href="${downloadUrl}">${downloadUrl}</a></p>`,
      text: `Your backup is ready: ${downloadUrl}`,
    });
  }
}

module.exports = {
  storageBackupService: new StorageBackupService(),
};
