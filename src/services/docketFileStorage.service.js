const Attachment = require('../models/Attachment.model');
const Case = require('../models/Case.model');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');

class DocketFileStorageService {
  async assertFirmStorageConnected(firmId) {
    const provider = await StorageProviderFactory.getProvider(firmId);
    await provider.testConnection();
    return provider;
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
    const provider = await this.assertFirmStorageConnected(firmId);
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

    const uploadResult = await provider.uploadFile(null, fileName, file, fileType);
    const storageFileId = uploadResult?.fileId || uploadResult?.id;
    if (!storageFileId) {
      const error = new Error('Provider upload did not return a file id');
      error.code = 'STORAGE_UPLOAD_FAILED';
      error.status = 502;
      throw error;
    }

    const createdAt = new Date();
    const metadata = await Attachment.create({
      caseId: normalizedDocketId,
      firmId: String(firmId),
      fileName: uploadResult.name || fileName,
      mimeType: uploadResult.mimeType || fileType,
      size: Number(uploadResult.size || file.length || 0),
      storageFileId,
      storageProvider: provider.providerName,
      ...(provider.providerName === 'google-drive' ? { driveFileId: storageFileId } : {}),
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
    })
      .sort({ createdAt: -1 })
      .lean();

    return attachments.map((item) => DocketFileStorageService.toPublicAttachment(item));
  }

  async getFile({ attachmentId, firmId }) {
    const provider = await this.assertFirmStorageConnected(firmId);
    const metadata = await Attachment.findOne({ _id: attachmentId, firmId: String(firmId) }).lean();
    if (!metadata || !metadata.storageFileId) {
      const error = new Error('Attachment metadata not found');
      error.code = 'ATTACHMENT_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    await this.assertDocketOwnership({ docketId: metadata.caseId, firmId });

    const stream = await provider.downloadFile(metadata.storageFileId);

    return {
      metadata: DocketFileStorageService.toPublicAttachment(metadata),
      stream,
    };
  }
}

module.exports = new DocketFileStorageService();
