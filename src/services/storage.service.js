const Attachment = require('../models/Attachment.model');
const Case = require('../models/Case.model');
const Firm = require('../models/Firm.model');
const StorageConfiguration = require('../models/StorageConfiguration.model');
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');

class StorageService {
  /**
   * Resolve firm-scoped provider from server-side firm identity.
   * Security note: firmId must come from authenticated request context, never client payload.
   * @param {string} firmId
   * @returns {Promise<object>}
   */
  async getProvider(firmId) {
    return StorageProviderFactory.getProvider(firmId);
  }

  /**
   * Ensure required case folders exist for attachment writes.
   * @param {string} firmId
   * @param {string} caseId
   * @param {object} provider
   * @returns {Promise<string>} attachments folder id
   */
  async ensureCaseFolderExists(firmId, caseId, provider) {
    const caseDoc = await Case.findOne({ caseId, firmId }).select('drive storage').lean();
    if (!caseDoc) {
      throw new Error('Case not found');
    }

    if (caseDoc.drive?.attachmentsFolderId) {
      return caseDoc.drive.attachmentsFolderId;
    }

    const activeConfig = await StorageConfiguration.findOne({ firmId, isActive: true }).lean();
    const rootFolderId = activeConfig?.rootFolderId || null;
    const firm = await Firm.findById(firmId).select('name').lean();
    const firmName = (firm?.name || `Firm-${firmId}`).trim();

    const docketraFolderId = await provider.getOrCreateFolder(rootFolderId, 'Docketra');
    const firmFolderId = await provider.getOrCreateFolder(docketraFolderId, firmName);
    const casesFolderId = await provider.getOrCreateFolder(firmFolderId, 'Cases');
    const caseFolderId = await provider.getOrCreateFolder(casesFolderId, String(caseId));
    const attachmentsFolderId = await provider.getOrCreateFolder(caseFolderId, 'Attachments');

    await Case.updateOne(
      { caseId, firmId },
      {
        $set: {
          'drive.firmRootFolderId': firmFolderId,
          'drive.cfsRootFolderId': caseFolderId,
          'drive.attachmentsFolderId': attachmentsFolderId,
        },
      }
    );

    return attachmentsFolderId;
  }

  /**
   * Upload case attachment to active storage provider.
   * @param {string} firmId
   * @param {string} caseId
   * @param {string} filename
   * @param {ReadableStream} stream
   * @param {string} mimeType
   * @returns {Promise<{fileId:string, webViewLink?:string}>}
   */
  async uploadCaseAttachment(firmId, caseId, filename, stream, mimeType = 'application/octet-stream') {
    const provider = await this.getProvider(firmId);
    const folderId = await this.ensureCaseFolderExists(firmId, caseId, provider);
    return provider.uploadFile(folderId, filename, stream, mimeType);
  }

  /**
   * Download case attachment from active/legacy provider.
   * @param {string} firmId
   * @param {string} attachmentId
   * @returns {Promise<ReadableStream>}
   */
  async downloadCaseAttachment(firmId, attachmentId) {
    const attachment = await Attachment.findOne({ _id: attachmentId, firmId }).lean();
    if (!attachment) throw new Error('Attachment not found');
    if (!attachment.storageFileId && !attachment.driveFileId) {
      throw new Error('Invalid attachment: no storage reference');
    }
    const provider = await this.getProvider(firmId);
    return provider.downloadFile(attachment.storageFileId || attachment.driveFileId);
  }
}

module.exports = new StorageService();
