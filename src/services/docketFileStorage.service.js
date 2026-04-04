const DocketAttachmentMetadata = require('../models/DocketAttachmentMetadata.model');
const { resolveFirmStorage, getProviderAdapter } = require('./storageAdapters/providerFactory');

class DocketFileStorageService {
  async uploadFile({ file, fileName, fileType, docketId, firmId, uploadedBy }) {
    const storageConfig = await resolveFirmStorage(firmId);
    const provider = getProviderAdapter(storageConfig);

    const uploadResult = await provider.uploadFile({
      file,
      fileName,
      mimeType: fileType,
      parentFolderId: storageConfig.rootFolderId,
    });

    const metadata = await DocketAttachmentMetadata.create({
      docketId,
      firmId,
      fileName: uploadResult.fileName || fileName,
      fileType: uploadResult.fileType || fileType,
      storageProvider: storageConfig.provider,
      storageConfigId: storageConfig._id,
      fileId: uploadResult.providerFileId,
      uploadedBy,
      createdAt: new Date(),
    });

    return metadata;
  }

  async getFile({ attachmentId, firmId }) {
    const metadata = await DocketAttachmentMetadata.findOne({ _id: attachmentId, firmId }).lean();
    if (!metadata) {
      const error = new Error('Attachment metadata not found');
      error.code = 'ATTACHMENT_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    const storageConfig = await resolveFirmStorage(firmId);
    const provider = getProviderAdapter(storageConfig);

    const file = await provider.getFile({ providerFileId: metadata.fileId });

    return {
      metadata,
      ...file,
    };
  }
}

module.exports = new DocketFileStorageService();
