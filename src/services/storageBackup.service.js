const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { googleDriveService } = require('./googleDrive.service');
const User = require('../models/User.model');
const emailService = require('./email.service');
const execFileAsync = promisify(execFile);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

class StorageBackupService {
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

    await execFileAsync('python3', ['-m', 'zipfile', '-c', zipPath, 'documents', 'metadata.json'], { cwd: workingDir });

    return {
      exportId,
      zipPath,
      fileCount: files.length,
    };
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
