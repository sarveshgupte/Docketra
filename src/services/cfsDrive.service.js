/**
 * CFS (Case File System) Drive Service
 * 
 * Manages the Google Drive folder structure for case files.
 * Implements the mandatory folder architecture:
 * 
 * <DRIVE_ROOT_FOLDER_ID>/
 *  └─ firm_<firmId>/
 *      └─ cfs_<caseId>/
 *          ├─ attachments/
 *          ├─ documents/
 *          ├─ evidence/
 *          └─ internal/
 * 
 * Features:
 * - Idempotent folder creation (safe to call multiple times)
 * - Firm-scoped isolation
 * - Case-scoped CFS roots
 * - Persists folder IDs in database
 * 
 * Security:
 * - Never relies on folder names for access control
 * - Always uses folder IDs for authorization
 */

const path = require('path');
const fs = require('fs').promises;
const { StorageProviderFactory } = require('./storage/StorageProviderFactory');
const ClientRepository = require('../repositories/ClientRepository');
const CaseFile = require('../models/CaseFile.model');
const Attachment = require('../models/Attachment.model');
const { enqueueStorageJob, JOB_TYPES } = require('../queues/storage.queue');
const { softDelete } = require('./softDelete.service');
const log = require('../utils/log');

class CFSDriveService {
  /**
   * CFS subfolder names
   * These are the standard subfolders created for each case
   */
  static CFS_SUBFOLDERS = {
    ATTACHMENTS: 'attachments',
    DOCUMENTS: 'documents',
    EVIDENCE: 'evidence',
    INTERNAL: 'internal',
  };

  /**
   * Client CFS subfolder names
   * These are the standard subfolders created for each client
   */
  static CLIENT_CFS_SUBFOLDERS = {
    DOCUMENTS: 'documents',
    CONTRACTS: 'contracts',
    IDENTITY: 'identity',
    FINANCIALS: 'financials',
    INTERNAL: 'internal',
  };

  /**
   * Ensure firm folder exists under root
   * 
   * @param {string} firmId - Firm identifier
   * @returns {Promise<string>} Firm folder ID
   */
  async ensureFirmFolder(firmId, providerInstance) {
    if (!firmId) {
      throw new Error('Firm ID is required');
    }

    if (!providerInstance) {
      throw new Error('Storage provider instance is required');
    }

    const provider = providerInstance;
    const folderName = `firm_${firmId}`;
    const folderId = await provider.getOrCreateFolder(folderName, null);
    
    return folderId;
  }

  /**
   * Create complete CFS folder structure for a case
   * 
   * Creates the following structure:
   * - firm_<firmId>/cfs_<caseId>/
   *   - attachments/
   *   - documents/
   *   - evidence/
   *   - internal/
   * 
   * @param {string} firmId - Firm identifier
   * @param {string} caseId - Case identifier (human-readable, e.g., CASE-20260111-00001)
   * @returns {Promise<Object>} Folder IDs
   * @throws {Error} If folder creation fails
   */
  async createCFSFolderStructure(firmId, caseId, providerInstance) {
    if (!firmId || !caseId) {
      throw new Error('Firm ID and Case ID are required');
    }

    if (!providerInstance) {
      throw new Error('Storage provider instance is required');
    }
    const provider = providerInstance;
    // Guard folder ID logging in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      log.info(`[CFSDriveService] Creating CFS folder structure for firm=${firmId}, case=${caseId}`);
    }

    try {
      // Step 1: Ensure firm folder exists
      const firmFolderId = await this.ensureFirmFolder(firmId, provider);

      // Step 2: Create CFS root folder for this case
      const cfsRootName = `cfs_${caseId}`;
      const cfsRootFolderId = await provider.getOrCreateFolder(cfsRootName, firmFolderId);

      // Step 3: Create all subfolders in parallel
      const [attachmentsFolderId, documentsFolderId, evidenceFolderId, internalFolderId] = 
        await Promise.all([
          provider.getOrCreateFolder(CFSDriveService.CFS_SUBFOLDERS.ATTACHMENTS, cfsRootFolderId),
          provider.getOrCreateFolder(CFSDriveService.CFS_SUBFOLDERS.DOCUMENTS, cfsRootFolderId),
          provider.getOrCreateFolder(CFSDriveService.CFS_SUBFOLDERS.EVIDENCE, cfsRootFolderId),
          provider.getOrCreateFolder(CFSDriveService.CFS_SUBFOLDERS.INTERNAL, cfsRootFolderId),
        ]);

      const folderIds = {
        firmRootFolderId: firmFolderId,
        cfsRootFolderId: cfsRootFolderId,
        attachmentsFolderId: attachmentsFolderId,
        documentsFolderId: documentsFolderId,
        evidenceFolderId: evidenceFolderId,
        internalFolderId: internalFolderId,
      };

      if (isDevelopment) {
        log.info(`[CFSDriveService] Successfully created CFS structure for case ${caseId}`);
      }

      return folderIds;
    } catch (error) {
      log.error(`[CFSDriveService] Error creating CFS structure:`, error.message);
      throw new Error(`Failed to create CFS folder structure: ${error.message}`);
    }
  }

  /**
   * Get the appropriate folder ID for a file type
   * 
   * @param {Object} folderIds - CFS folder IDs object
   * @param {string} fileType - Type of file ('attachment', 'document', 'evidence', 'internal')
   * @returns {string} Folder ID for the file type
   */
  getFolderIdForFileType(folderIds, fileType = 'attachment') {
    if (!folderIds) {
      throw new Error('Folder IDs object is required');
    }

    // Default to attachments folder
    const folderMap = {
      'attachment': folderIds.attachmentsFolderId,
      'document': folderIds.documentsFolderId,
      'evidence': folderIds.evidenceFolderId,
      'internal': folderIds.internalFolderId,
    };

    const folderId = folderMap[fileType.toLowerCase()] || folderIds.attachmentsFolderId;

    if (!folderId) {
      throw new Error(`No folder ID found for file type: ${fileType}`);
    }

    return folderId;
  }

  /**
   * Validates presence of Case CFS folder IDs in database.
   * 
   * NOTE:
   * This does NOT validate that folders exist in Google Drive.
   * It only ensures required folder IDs are present in the Case document.
   * Drive existence checks may be added as a future enhancement.
   * 
   * @param {Object} folderIds - CFS folder IDs object
   * @returns {Promise<boolean>} True if all required folder IDs are present
   */
  async validateCFSMetadata(folderIds) {
    if (!folderIds) {
      return false;
    }

    const requiredFolders = [
      'firmRootFolderId',
      'cfsRootFolderId',
      'attachmentsFolderId',
      'documentsFolderId',
      'evidenceFolderId',
      'internalFolderId',
    ];

    // Check all required folder IDs are present
    for (const folderKey of requiredFolders) {
      if (!folderIds[folderKey]) {
        log.error(`[CFSDriveService] Missing folder ID: ${folderKey}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Create complete Client CFS folder structure
   * 
   * Creates the following structure:
   * - firm_<firmId>/client_<clientId>/cfs/
   *   - documents/
   *   - contracts/
   *   - identity/
   *   - financials/
   *   - internal/
   * 
   * @param {string} firmId - Firm identifier
   * @param {string} clientId - Client identifier (e.g., C000001)
   * @returns {Promise<Object>} Folder IDs
   * @throws {Error} If folder creation fails
   */
  async createClientCFSFolderStructure(firmId, clientId, providerInstance) {
    if (!firmId || !clientId) {
      throw new Error('Firm ID and Client ID are required');
    }

    if (!providerInstance) {
      throw new Error('Storage provider instance is required');
    }
    const provider = providerInstance;
    // Guard folder ID logging in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      log.info(`[CFSDriveService] Creating Client CFS folder structure for firm=${firmId}, client=${clientId}`);
    }

    try {
      // Step 1: Ensure firm folder exists
      const firmFolderId = await this.ensureFirmFolder(firmId, provider);

      // Step 2: Create client root folder
      const clientRootName = `client_${clientId}`;
      const clientRootFolderId = await provider.getOrCreateFolder(clientRootName, firmFolderId);

      // Step 3: Create CFS root folder for this client
      const cfsRootFolderId = await provider.getOrCreateFolder('cfs', clientRootFolderId);

      // Step 4: Create all subfolders in parallel
      const [documentsFolderId, contractsFolderId, identityFolderId, financialsFolderId, internalFolderId] = 
        await Promise.all([
          provider.getOrCreateFolder(CFSDriveService.CLIENT_CFS_SUBFOLDERS.DOCUMENTS, cfsRootFolderId),
          provider.getOrCreateFolder(CFSDriveService.CLIENT_CFS_SUBFOLDERS.CONTRACTS, cfsRootFolderId),
          provider.getOrCreateFolder(CFSDriveService.CLIENT_CFS_SUBFOLDERS.IDENTITY, cfsRootFolderId),
          provider.getOrCreateFolder(CFSDriveService.CLIENT_CFS_SUBFOLDERS.FINANCIALS, cfsRootFolderId),
          provider.getOrCreateFolder(CFSDriveService.CLIENT_CFS_SUBFOLDERS.INTERNAL, cfsRootFolderId),
        ]);

      const folderIds = {
        clientRootFolderId: clientRootFolderId,
        cfsRootFolderId: cfsRootFolderId,
        documentsFolderId: documentsFolderId,
        contractsFolderId: contractsFolderId,
        identityFolderId: identityFolderId,
        financialsFolderId: financialsFolderId,
        internalFolderId: internalFolderId,
      };

      if (isDevelopment) {
        log.info(`[CFSDriveService] Successfully created Client CFS structure for ${clientId}`);
      }

      return folderIds;
    } catch (error) {
      log.error(`[CFSDriveService] Error creating Client CFS structure:`, error.message);
      throw new Error(`Failed to create Client CFS folder structure: ${error.message}`);
    }
  }

  /**
   * Get the appropriate folder ID for a client file type
   * 
   * @param {Object} folderIds - Client CFS folder IDs object
   * @param {string} fileType - Type of file ('documents', 'contracts', 'identity', 'financials', 'internal')
   * @returns {string} Folder ID for the file type
   */
  getClientFolderIdForFileType(folderIds, fileType = 'documents') {
    if (!folderIds) {
      throw new Error('Folder IDs object is required');
    }

    // Default to documents folder
    const folderMap = {
      'documents': folderIds.documentsFolderId,
      'contracts': folderIds.contractsFolderId,
      'identity': folderIds.identityFolderId,
      'financials': folderIds.financialsFolderId,
      'internal': folderIds.internalFolderId,
    };

    // Try to get the requested folder type
    let folderId = folderMap[fileType.toLowerCase()];
    
    // If not found, try to use documents folder as default
    if (!folderId) {
      folderId = folderIds.documentsFolderId;
    }
    
    // If still no folder ID, throw error
    if (!folderId) {
      throw new Error(`No folder ID found for file type: ${fileType} and no default documents folder available`);
    }

    return folderId;
  }

  /**
   * Validates presence of Client CFS folder IDs in database.
   * 
   * NOTE:
   * This does NOT validate that folders exist in Google Drive.
   * It only ensures required folder IDs are present in the Client document.
   * Drive existence checks may be added as a future enhancement.
   * 
   * @param {Object} folderIds - Client CFS folder IDs object
   * @returns {Promise<boolean>} True if all required folder IDs are present
   */
  async validateClientCFSMetadata(folderIds) {
    if (!folderIds) {
      return false;
    }

    const requiredFolders = [
      'clientRootFolderId',
      'cfsRootFolderId',
      'documentsFolderId',
      'contractsFolderId',
      'identityFolderId',
      'financialsFolderId',
      'internalFolderId',
    ];

    // Check all required folder IDs are present
    for (const folderKey of requiredFolders) {
      if (!folderIds[folderKey]) {
        log.error(`[CFSDriveService] Missing client folder ID: ${folderKey}`);
        return false;
      }
    }

    return true;
  }

  async uploadClientCFSFile(clientId, firmId, file, options = {}) {
    if (!clientId || !firmId || !file) {
      throw new Error('clientId, firmId, and file are required');
    }

    const {
      userRole,
      userEmail = 'unknown',
      userXID = 'SYSTEM',
      userName = userEmail,
      description = 'Client Fact Sheet attachment',
      fileType = 'documents',
    } = options;

    const client = await ClientRepository.findByClientId(firmId, clientId, userRole);
    if (!client) {
      throw new Error('Client not found or access denied');
    }

    const provider = await StorageProviderFactory.getProvider(firmId);
    const isValidStructure = await this.validateClientCFSMetadata(client.drive);
    if (!isValidStructure) {
      const folderIds = await this.createClientCFSFolderStructure(
        firmId.toString(),
        clientId,
        provider
      );
      client.drive = folderIds;
      await client.save();
    }

    const folderId = this.getClientFolderIdForFileType(client.drive, fileType);
    const fileMimeType = file.mimetype || 'application/octet-stream';

    const firmIdStr = firmId.toString();
    const tmpDir = path.join(__dirname, '../../uploads/tmp', firmIdStr);
    await fs.mkdir(tmpDir, { recursive: true });
    const destPath = path.join(tmpDir, path.basename(file.path));
    await fs.rename(file.path, destPath);

    const caseFile = await CaseFile.create({
      firmId,
      clientId,
      localPath: destPath,
      originalName: file.originalname,
      mimeType: fileMimeType,
      size: file.size,
      uploadStatus: 'pending',
      description: String(description || 'Client Fact Sheet attachment').trim(),
      createdBy: userEmail,
      createdByXID: userXID,
      createdByName: userName,
      source: 'client_cfs',
    });

    await enqueueStorageJob(JOB_TYPES.UPLOAD_FILE, {
      firmId: firmIdStr,
      provider: 'google',
      folderId,
      fileId: caseFile._id,
    });

    return caseFile;
  }

  async deleteClientCFSFile(clientId, attachmentId, firmId, options = {}) {
    if (!clientId || !attachmentId || !firmId) {
      throw new Error('clientId, attachmentId, and firmId are required');
    }

    const { req, reason = 'Client CFS delete' } = options;

    const attachment = await Attachment.findOne({
      _id: attachmentId,
      firmId,
      clientId,
      source: 'client_cfs',
    });

    if (!attachment) {
      throw new Error('File not found or access denied');
    }

    const provider = await StorageProviderFactory.getProvider(firmId);

    // Reference counting: Only delete the file from the storage provider if no other active attachments or case files reference it
    if (attachment.driveFileId) {
      const duplicateCount = await Attachment.countDocuments({
        driveFileId: attachment.driveFileId,
        _id: { $ne: attachment._id },
        deletedAt: null // Ensure we only count active attachments
      });

      const caseFileCount = await CaseFile.countDocuments({
        storageFileId: attachment.driveFileId,
        $or: [
          { deletedAt: null },
          { deletedAt: { $exists: false } }
        ],
        isDeleted: { $ne: true }
      });

      if (duplicateCount === 0 && caseFileCount === 0) {
        try {
          await provider.deleteFile(attachment.driveFileId);
        } catch (error) {
          log.error('[CFSDriveService] Error deleting Drive file:', error.message);
        }
      } else {
        log.info('[CFSDriveService] Skipping Drive file deletion due to reference counting', {
          driveFileId: attachment.driveFileId,
          duplicateCount,
          caseFileCount,
        });
      }
    }

    await softDelete({
      model: Attachment,
      filter: { _id: attachment._id },
      req,
      reason,
    });

    return attachment;
  }
}

// Export singleton instance
const cfsDriveService = new CFSDriveService();

module.exports = cfsDriveService;
