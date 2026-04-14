const Attachment = require('../models/Attachment.model');
const Case = require('../models/Case.model');
const Firm = require('../models/Firm.model');
const { googleDriveService } = require('./googleDrive.service');
const { decrypt } = require('./storage/services/TokenEncryption.service');

class DocketFileStorageService {
  async assertFirmStorageConnected(firmId) {
    const firm = await Firm.findById(firmId).select('storageConfig storage').lean();
    const encrypted = firm?.storageConfig?.credentials;
    const credentials = encrypted ? JSON.parse(decrypt(encrypted)) : {};
    const refreshToken = credentials.refreshToken || credentials.googleRefreshToken;
    const rootFolderId = credentials.rootFolderId || firm?.storage?.google?.rootFolderId;
    if (!refreshToken || !rootFolderId) {
      const error = new Error('Cloud storage must be connected');
      error.code = 'STORAGE_NOT_CONNECTED';
      error.status = 400;
      throw error;
    }
  }

  static toPublicAttachment(attachment) {
    return {
      id: attachment._id,
      docketId: attachment.caseId,
      firmId: attachment.firmId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      storageProvider: attachment.storageProvider,
      uploadedBy: attachment.uploadedBy || attachment.createdByXID,
      uploadedByName: attachment.uploadedByName || attachment.createdByName || 'Unknown',
      uploadedAtReadable: attachment.uploadedAtReadable,
      createdAt: attachment.createdAt,
      version: attachment.version || 1,
      webViewLink: attachment.webViewLink || null,
    };
  }

  async assertDocketOwnership({ docketId, firmId }) {
    const caseRecord = await Case.findOne({
      firmId: String(firmId),
      $or: [{ caseId: String(docketId) }, { caseNumber: String(docketId) }],
    }).select('_id caseId caseNumber firmId').lean();

    if (!caseRecord) {
      const error = new Error('Docket not found for firm');
      error.code = 'DOCKET_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return caseRecord;
  }

  async uploadFile({ file, fileName, fileType, docketId, firmId, uploadedBy, uploadedByName }) {
    await this.assertFirmStorageConnected(firmId);
    const caseRecord = await this.assertDocketOwnership({ docketId, firmId });
    const normalizedDocketId = caseRecord.caseId;

    const latest = await Attachment.findOne({
      caseId: normalizedDocketId,
      firmId: String(firmId),
      fileName,
    })
      .sort({ version: -1, createdAt: -1 })
      .select('version')
      .lean();

    const version = Number(latest?.version || 0) + 1;

    const uploadResult = await googleDriveService.uploadFile(firmId, {
      buffer: file,
      originalname: fileName,
      mimetype: fileType,
    });

    const createdAt = new Date();
    const metadata = await Attachment.create({
      caseId: normalizedDocketId,
      firmId: String(firmId),
      fileName: uploadResult.name || fileName,
      mimeType: uploadResult.mimeType || fileType,
      size: Number(uploadResult.size || file.length || 0),
      storageFileId: uploadResult.id,
      storageProvider: 'google-drive',
      driveFileId: uploadResult.id,
      uploadedBy,
      uploadedByName,
      createdBy: `${uploadedBy || 'unknown'}@docketra.internal`,
      createdByXID: uploadedBy,
      createdByName: uploadedByName,
      description: `Attachment uploaded to docket ${normalizedDocketId}`,
      uploadedAtReadable: createdAt.toISOString(),
      webViewLink: uploadResult.webViewLink || null,
      createdAt,
      version,
    });

    return DocketFileStorageService.toPublicAttachment(metadata.toObject());
  }

  async listAttachments({ docketId, firmId }) {
    await this.assertFirmStorageConnected(firmId);
    const caseRecord = await this.assertDocketOwnership({ docketId, firmId });
    const attachments = await Attachment.find({
      caseId: caseRecord.caseId,
      firmId: String(firmId),
      storageProvider: 'google-drive',
    })
      .sort({ createdAt: -1 })
      .lean();

    return attachments.map((item) => DocketFileStorageService.toPublicAttachment(item));
  }

  async getFile({ attachmentId, firmId }) {
    await this.assertFirmStorageConnected(firmId);
    const metadata = await Attachment.findOne({ _id: attachmentId, firmId: String(firmId) }).lean();
    if (!metadata || !metadata.storageFileId) {
      const error = new Error('Attachment metadata not found');
      error.code = 'ATTACHMENT_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    await this.assertDocketOwnership({ docketId: metadata.caseId, firmId });

    const stream = await googleDriveService.downloadFile(firmId, metadata.storageFileId);

    return {
      metadata: DocketFileStorageService.toPublicAttachment(metadata),
      stream,
    };
  }
}

module.exports = new DocketFileStorageService();
